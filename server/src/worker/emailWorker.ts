import { Worker, Job } from "bullmq";
import nodemailer, { Transporter } from "nodemailer";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { redisConnection, redis } from "../config/redis";
import { emailQueue } from "../queues/emailQueue";
import { decrypt } from "../utils/encryption";
import { hasDailyCapacity, findAvailableSender } from "../utils/dailyLimitTracker";
import { canSend, recordSendResult, computeJitteredDelay, getEffectiveLimits } from "../utils/throttleEngine";
import { preprocessEmailHtml } from "../utils/emailPreprocessor";
import { resolveForRecipient } from "../utils/variableResolver";

// ---------------------------------------------------------------------------
// Helper: Truncate a Date to the start of its hour
// ---------------------------------------------------------------------------
// Used for rate-limit counter bucketing. All emails sent between 14:00:00
// and 14:59:59 share the same hourWindow key, so the counter accurately
// reflects the sender's hourly throughput.
// ---------------------------------------------------------------------------

export const toHourWindow = (date: Date): Date => {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    0,
    0,
    0,
  );
};

// ---------------------------------------------------------------------------
// Helper: Create a per-job SMTP transporter
// ---------------------------------------------------------------------------
// WHY per-job transporter: Each sender has unique SMTP credentials (email +
// app password). A shared global transporter would use the wrong credentials
// for every sender except the one it was initialized with. Creating a fresh
// transporter per job ensures the correct credentials are always used.
// ---------------------------------------------------------------------------

export function createSmtpTransporter(sender: {
  smtpHost: string;
  smtpPort: number;
  email: string;
  decryptedPassword: string;
}): Transporter {
  // Use secure connection (TLS) for port 465, typical for Gmail and secure SMTPs
  const isSecure = sender.smtpPort === 465;

  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: isSecure,
    auth: {
      user: sender.email,
      pass: sender.decryptedPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// Main job handler
// ---------------------------------------------------------------------------
// This function implements the full email-sending pipeline:
//   1. Fetch job + campaign + sender from DB
//   2. Idempotency checks (skip SENT, skip non-PENDING)
//   3. Claim lock (PENDING → SENDING) to prevent duplicate sends
//   4. Validate sender exists and is verified
//   5. Rate-limit check (reschedule if over hourly limit)
//   6. Decrypt credentials, create transporter, send email
//   7. Atomic SENT + counter increment on success
//   8. Campaign completion check
//
// Error handling distinguishes permanent vs transient failures:
//   - Permanent (catch → mark FAILED): bad credentials, missing sender, etc.
//   - Transient (throw → BullMQ retry): DB timeouts, Redis errors
// ---------------------------------------------------------------------------

export async function processEmailJob(job: Job): Promise<void> {
  const { emailJobId } = job.data;

  // 1. Fetch EmailJob with Campaign and Sender includes
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: {
      campaign: {
        include: { sender: true, attachments: true, sequenceSteps: true },
      },
      sender: true,
      sequenceStep: true,
    },
  });

  // If EmailJob not found → log warning, return (skip)
  if (!emailJob) {
    console.warn(`EmailJob not found, skipping: ${emailJobId}`);
    return;
  }

  const { campaign } = emailJob;

  // If Campaign not found → log warning, return (skip)
  if (!campaign) {
    console.warn(`Campaign not found for EmailJob ${emailJobId}, skipping`);
    return;
  }

  // ---------------------------------------------------------------------------
  // Campaign state check — respect pause/cancel
  // ---------------------------------------------------------------------------

  if (campaign.status === "PAUSED") {
    console.log(`Campaign ${campaign.id} is PAUSED, skipping EmailJob ${emailJobId}`);
    return;
  }

  if (campaign.status === "CANCELLED") {
    console.log(`Campaign ${campaign.id} is CANCELLED, skipping EmailJob ${emailJobId}`);
    return;
  }

  // ---------------------------------------------------------------------------
  // Idempotency checks
  // ---------------------------------------------------------------------------

  // If EmailJob status is SENT → already processed, skip (idempotent)
  if (emailJob.status === "SENT") {
    console.log(`EmailJob ${emailJobId} already SENT, skipping`);
    // Still perform completion check in case this was the last job and worker crashed before check
    await checkCampaignCompletion(campaign.id);
    return;
  }

  // If EmailJob status is CANCELLED → stale queue entry from cancel operation
  if (emailJob.status === "CANCELLED") {
    console.log(`EmailJob ${emailJobId} already CANCELLED (stale queue entry), skipping`);
    return;
  }

  // If EmailJob status is not PENDING → another worker claimed it, skip
  if (emailJob.status !== "PENDING") {
    console.log(
      `EmailJob ${emailJobId} status is ${emailJob.status}, not PENDING — skipping`,
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Claim lock: PENDING → SENDING
  // ---------------------------------------------------------------------------
  // WHY claim lock: Under concurrent workers, multiple workers could read the
  // same job as PENDING simultaneously. By using updateMany with a WHERE clause
  // on status=PENDING, only ONE worker's update will match (the first to run).
  // If count === 0, another worker already claimed it — we skip gracefully.
  // This prevents duplicate email sends without needing an external distributed lock.
  // ---------------------------------------------------------------------------

  const claimResult = await prisma.emailJob.updateMany({
    where: { id: emailJobId, status: "PENDING" },
    data: { status: "SENDING" },
  });

  if (claimResult.count === 0) {
    console.log(`EmailJob ${emailJobId} already claimed by another worker, skipping`);
    return;
  }

  // ---------------------------------------------------------------------------
  // SCHEDULED → SENDING transition on first job processing
  // ---------------------------------------------------------------------------
  if (campaign.status === "SCHEDULED") {
    try {
      await prisma.emailCampaign.updateMany({
        where: { id: campaign.id, status: "SCHEDULED" },
        data: { status: "SENDING" },
      });
    } catch {
      // Ignore — another worker may have already transitioned it
    }
  }

  // ---------------------------------------------------------------------------
  // Sender resolution — per-job sender with legacy fallback
  // ---------------------------------------------------------------------------
  // New multi-sender campaigns assign senderId directly on each EmailJob.
  // Legacy campaigns have senderId only on the campaign. We resolve the
  // sender from the job first, falling back to the campaign's sender.
  // ---------------------------------------------------------------------------

  const resolvedSenderId = emailJob.senderId ?? campaign.senderId;

  let sender = emailJob.sender ?? campaign.sender;

  // If the job has a senderId but the include didn't populate it, fetch separately
  if (!sender && resolvedSenderId) {
    sender = await prisma.sender.findUnique({
      where: { id: resolvedSenderId },
    });
  }

  if (!sender) {
    // Sender was deleted mid-campaign — mark FAILED
    await markFailed(emailJobId, "Sender not found");
    return;
  }

  if (!sender.isVerified) {
    // Sender exists but SMTP credentials were never verified
    await markFailed(emailJobId, "Sender not verified for SMTP");
    return;
  }

  // ---------------------------------------------------------------------------
  // Daily limit enforcement
  // ---------------------------------------------------------------------------
  // Before sending, check if the assigned sender has remaining daily capacity.
  // If not, attempt to reassign to the next available sender in the pool.
  // If all senders are exhausted, pause the campaign.
  // ---------------------------------------------------------------------------

  const senderLimits = await getEffectiveLimits(sender.id);
  const hasCapacity = await hasDailyCapacity(sender.id, senderLimits.perDay);
  if (!hasCapacity) {
    // Sender at daily limit — try to reassign to another sender in the pool
    const campaignSenders = await prisma.campaignSender.findMany({
      where: { campaignId: campaign.id },
      orderBy: { rotationOrder: "asc" },
    });

    if (campaignSenders.length > 0) {
      const availableSenderId = await findAvailableSender(
        campaignSenders,
        async (sid) => (await getEffectiveLimits(sid)).perDay
      );

      if (availableSenderId) {
        // Reassign to available sender, reset to PENDING, re-enqueue
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { senderId: availableSenderId, status: "PENDING" },
        });
        await emailQueue.add("send-email", { emailJobId }, { delay: 1000 });
        console.log(`EmailJob ${emailJobId} reassigned from ${sender.id} to ${availableSenderId}`);
        return;
      } else {
        // All senders exhausted — leave as PENDING, pause campaign
        await prisma.emailJob.update({
          where: { id: emailJobId },
          data: { status: "PENDING" },
        });
        await prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: "SENDING" },
          data: { status: "PAUSED", pauseReason: "ALL_SENDERS_EXHAUSTED" },
        });
        console.warn(`All senders exhausted for campaign ${campaign.id}, pausing`);
        return;
      }
    } else {
      // Legacy campaign with no sender pool — just leave as PENDING
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "PENDING" },
      });
      console.warn(`Sender ${sender.id} at daily limit, no pool available for campaign ${campaign.id}`);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Throttle Engine check (per-minute, per-hour, per-day, cooldown)
  // ---------------------------------------------------------------------------

  const throttleDecision = await canSend(sender.id, campaign.hourlyLimit);

  if (!throttleDecision.allowed) {
    // Throttle Engine rejected — reset to PENDING and re-enqueue with jittered delay
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: "PENDING" },
    });

    const baseDelayMs = throttleDecision.retryAfterMs ?? 60_000;
    const jitteredDelaySec = computeJitteredDelay(baseDelayMs / 1000);
    const delay = Math.max(0, Math.round(jitteredDelaySec * 1000));

    await emailQueue.add(
      "send-email",
      { emailJobId },
      {
        jobId: `${emailJobId}-${crypto.randomUUID()}`,
        delay,
      },
    );

    console.log(
      `EmailJob ${emailJobId} throttled (${throttleDecision.reason}), rescheduled with ${delay}ms delay`,
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Decrypt sender credentials
  // ---------------------------------------------------------------------------

  let decryptedPassword: string;
  try {
    decryptedPassword = decrypt(sender.appPassword);
  } catch (err) {
    // Corrupted ciphertext or key mismatch — permanent failure
    await markFailed(emailJobId, "Failed to decrypt sender credentials");
    return;
  }

  // ---------------------------------------------------------------------------
  // Create per-job transporter and send email
  // ---------------------------------------------------------------------------

  try {
    const transporter = createSmtpTransporter({
      smtpHost: sender.smtpHost,
      smtpPort: sender.smtpPort,
      email: sender.email,
      decryptedPassword,
    });

    // ---------------------------------------------------------------------------
    // Download attachments from Cloudinary (if any)
    // ---------------------------------------------------------------------------
    // WHY download at send time: Attachments are stored in Cloudinary, not locally.
    // We download them into memory as Buffers and pass them to Nodemailer.
    // This keeps the worker stateless — no local file storage needed.
    // ---------------------------------------------------------------------------

    const campaignAttachments = (campaign as any).attachments || [];
    const nodemailerAttachments: { filename: string; content: Buffer }[] = [];

    for (const attachment of campaignAttachments) {
      try {
        console.log(`Downloading attachment: ${attachment.filename}`);
        const response = await fetch(attachment.url);
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status} ${response.statusText} — ${body}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        nodemailerAttachments.push({
          filename: attachment.filename,
          content: Buffer.from(arrayBuffer),
        });
      } catch (downloadErr: any) {
        console.error(`Attachment download error for ${attachment.filename}:`, downloadErr.message);
        await markFailed(
          emailJobId,
          `Failed to download attachment: ${attachment.filename}`,
        );
        return;
      }
    }

    // Determine subject/body — use sequence step if this is a follow-up job
    const rawSubject = emailJob.sequenceStep?.subject ?? campaign.subject;
    const rawBody = emailJob.sequenceStep?.body ?? campaign.body;

    // Resolve template variables ({{Name}}, {{Company}}, etc.) using per-recipient columnData
    const recipientColumnData = (emailJob.columnData as Record<string, string>) ?? {};
    const resolved = resolveForRecipient(rawSubject, rawBody, {
      email: emailJob.toEmail,
      columnData: { ...recipientColumnData, email: emailJob.toEmail },
    });
    const emailSubject = resolved.subject;
    const emailBody = resolved.body;

    // Preprocess HTML for tracking (pixel injection + link rewriting)
    // TRACKING_BASE_URL should be set to the public API URL in production
    // (e.g., https://outly-api.onrender.com). 
    let trackingBaseUrl = process.env.TRACKING_BASE_URL;
    
    // If no tracking base URL is defined in env, try to construct one.
    // WARNING: localhost links in emails cause instant spam filtering.
    // If we are falling back to localhost, we intentionally disable tracking.
    if (!trackingBaseUrl) {
      console.warn(`WARNING: No TRACKING_BASE_URL provided in environment. Tracking is DISABLED for ${emailJobId} to prevent spam penalties.`);
    }

    const processedBody = trackingBaseUrl ? preprocessEmailHtml(
      emailBody,
      {
        emailJobId,
        trackingBaseUrl,
        trackOpens: (campaign as any).trackOpens ?? true,
        trackClicks: (campaign as any).trackClicks ?? true,
      }
    ) : emailBody; // Skip tracking injection if no safe URL is available

    // Strip HTML tags to create a plain text version for SpamAssassin
    // Spam filters heavily penalize HTML-only emails without a text fallback
    const plainTextBody = emailBody.replace(/<[^>]*>?/gm, '');

    await transporter.sendMail({
      from: sender.name ? `"${sender.name}" <${sender.email}>` : sender.email,
      to: emailJob.toEmail,
      subject: emailSubject,
      text: plainTextBody,
      html: processedBody,
      attachments: nodemailerAttachments,
    });

    // ---------------------------------------------------------------------------
    // Success: Re-read status, then atomic SENT + counter increment
    // ---------------------------------------------------------------------------

    const currentJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      select: { status: true },
    });

    // If status was changed to CANCELLED by a concurrent cancel, don't overwrite
    if (currentJob && currentJob.status === "CANCELLED") {
      console.log(`EmailJob ${emailJobId} was CANCELLED during send, skipping SENT update`);
    } else {
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "SENT", sentAt: new Date() },
      });
    }

    console.log(`EmailJob ${emailJobId} sent successfully to ${emailJob.toEmail}`);

    // Record successful send for adaptive throttle tracking
    await recordSendResult(sender.id, true, false);

    // Update RecipientSequenceState if this is a sequence job
    if (emailJob.sequenceStepId) {
      try {
        const state = await prisma.recipientSequenceState.findFirst({
          where: { campaignId: campaign.id, recipientEmail: emailJob.toEmail },
        });
        if (state) {
          const statuses = state.stepStatuses as any[];
          const stepIdx = statuses.findIndex(
            (s: any) => s.emailJobId === emailJobId || s.stepNumber === state.currentStep
          );
          if (stepIdx >= 0) {
            statuses[stepIdx] = { ...statuses[stepIdx], status: "SENT", sentAt: new Date().toISOString() };
            await prisma.recipientSequenceState.update({
              where: { id: state.id },
              data: { stepStatuses: statuses },
            });
          }
        }
      } catch (seqErr) {
        console.error(`Error updating sequence state for ${emailJobId}:`, seqErr);
      }
    }
  } catch (smtpError: any) {
    // Determine if this is a bounce (5xx SMTP response code)
    const errorMsg = (smtpError.message || "").toLowerCase();
    const isBounce =
      /5\d{2}/.test(errorMsg) ||
      errorMsg.includes("bounce");

    // Record failed send for adaptive throttle tracking
    await recordSendResult(sender.id, false, isBounce);

    // Permanent SMTP failure — mark FAILED with error message
    await markFailed(emailJobId, smtpError.message || "SMTP send failed");

    // Update RecipientSequenceState on failure
    if (emailJob.sequenceStepId) {
      try {
        const state = await prisma.recipientSequenceState.findFirst({
          where: { campaignId: campaign.id, recipientEmail: emailJob.toEmail },
        });
        if (state) {
          const statuses = state.stepStatuses as any[];
          const stepIdx = statuses.findIndex(
            (s: any) => s.emailJobId === emailJobId || s.stepNumber === state.currentStep
          );
          if (stepIdx >= 0) {
            statuses[stepIdx] = { ...statuses[stepIdx], status: "FAILED", error: smtpError.message || "SMTP send failed" };
            await prisma.recipientSequenceState.update({
              where: { id: state.id },
              data: { stepStatuses: statuses },
            });
          }
        }
      } catch (seqErr) {
        console.error(`Error updating sequence state for ${emailJobId}:`, seqErr);
      }
    }

    // Don't return here — fall through to the campaign completion check below
  }

  // ---------------------------------------------------------------------------
  // Campaign completion check
  // ---------------------------------------------------------------------------
  await checkCampaignCompletion(campaign.id);
}

/**
 * Helper: Checks if a campaign has finished all its current tasks.
 * For normal campaigns, it marks them COMPLETED when all jobs are terminal.
 * For sequence campaigns, it leaves the status as SENDING so the scheduler
 * can handle follow-up steps.
 */
async function checkCampaignCompletion(campaignId: string): Promise<void> {
  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: { sequenceSteps: true },
    });

    if (!campaign) return;

    // Skip completion detection for PAUSED or CANCELLED campaigns
    if (campaign.status === "PAUSED" || campaign.status === "CANCELLED" || campaign.status === "COMPLETED") {
      return;
    }

    // IMPORTANT: If this is a sequence campaign, the worker should NOT mark it completed.
    // The sequenceScheduler handles marking sequence campaigns as COMPLETED after all
    // recipients have finished all steps.
    if (campaign.sequenceSteps.length > 0) {
      return;
    }

    const nonTerminalCount = await prisma.emailJob.count({
      where: {
        campaignId: campaignId,
        status: { notIn: ["SENT", "FAILED", "CANCELLED"] },
      },
    });

    if (nonTerminalCount === 0) {
      await prisma.emailCampaign.updateMany({
        where: { id: campaignId, status: "SENDING" },
        data: { status: "COMPLETED" },
      });
      console.log(`Campaign ${campaignId} completed — all jobs terminal`);
    }
  } catch (err) {
    console.error(`Error checking campaign completion for ${campaignId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Helper: Mark an EmailJob as FAILED
// ---------------------------------------------------------------------------
// WHY separate helper: Multiple code paths need to mark a job as FAILED
// (missing sender, bad credentials, SMTP error). Centralizing this logic
// ensures consistent error handling — if the status update itself fails
// (e.g., DB connection lost), we log the error but don't crash the worker.
// ---------------------------------------------------------------------------

async function markFailed(emailJobId: string, errorMessage: string): Promise<void> {
  try {
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: "FAILED", error: errorMessage },
    });
    console.log(`EmailJob ${emailJobId} marked FAILED: ${errorMessage}`);
  } catch (err) {
    // If marking FAILED itself throws (e.g., DB connection lost), log but don't crash.
    // The job will remain in SENDING state and be recovered by the startup sweep.
    console.error(
      `Failed to mark EmailJob ${emailJobId} as FAILED (${errorMessage}):`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// Worker configuration
// ---------------------------------------------------------------------------
// WHY stalledInterval (60s): Detects workers that took a job but crashed
// without completing or failing it. BullMQ checks every 60s for jobs whose
// lock has expired and moves them back to the queue.
//
// WHY lockDuration (120s): Each job holds a lock while processing. The lock
// must be long enough to cover the full SMTP send + DB update cycle. SMTP
// servers can be slow (connection timeout 15s + greeting 15s + send time),
// plus DB writes. 120s provides comfortable headroom.
//
// WHY limiter (max 1, duration from env): Rate-limits how fast the worker
// pulls jobs from the queue, preventing burst sends that could trigger
// provider rate limits.
// ---------------------------------------------------------------------------

export const emailWorker = new Worker(
  "email-queue",
  processEmailJob,
  {
    connection: redisConnection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
    stalledInterval: 60000,
    lockDuration: 120000,
    limiter: {
      max: 1,
      duration: Number(process.env.MIN_DELAY_MS || 2000),
    },
  },
);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
// WHY graceful shutdown: Without it, a SIGTERM (e.g., during deploy) would
// kill the process immediately, leaving in-flight jobs stuck in SENDING state.
// By calling worker.close() first, we wait for in-flight jobs to finish their
// current send cycle, then cleanly disconnect from Prisma and Redis.
// The startup recovery sweep (in worker/index.ts) handles the case where
// the process is killed before graceful shutdown completes.
// ---------------------------------------------------------------------------

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await emailWorker.close();
  await prisma.$disconnect();
  await redis.quit();
  console.log("Graceful shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Global error handlers
// ---------------------------------------------------------------------------
// WHY catch uncaughtException/unhandledRejection: Without these handlers,
// an unexpected error would crash the entire worker process, taking down
// ALL in-flight jobs. By logging and continuing, individual job failures
// don't bring down the whole worker.
// ---------------------------------------------------------------------------

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception in worker:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection in worker:", reason);
});
