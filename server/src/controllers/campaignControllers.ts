import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/emailQueue";
import { resolveForRecipient } from "../utils/variableResolver";
import { parseVariables } from "../utils/templateParser";
import { isValidTransition } from "../utils/campaignStateMachine";
import { validateSequenceSteps, SequenceStepInput } from "../utils/sequenceValidation";
import { assignSendersRoundRobin, createCampaignSenderData } from "../utils/senderRotation";
import { getEffectiveLimits } from "../utils/throttleEngine";
import { isInWarmup } from "../utils/warmupEvaluator";
import { getAdaptiveState } from "../utils/adaptiveThrottle";
import { getSentCountToday } from "../utils/dailyLimitTracker";

/**
 * createCampaign — Creates an email campaign with full input validation,
 * sender ownership verification, email deduplication, transactional DB writes,
 * and BullMQ enqueue after commit.
 */
export const createCampaign = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      senderIds: rawSenderIds,
      senderId: legacySenderId,
      subject,
      body,
      startTime,
      delaySeconds,
      hourlyLimit,
      emails,
      attachments,
      steps,
      trackOpens: rawTrackOpens,
      trackClicks: rawTrackClicks,
    } = req.body;

    const trackOpens = rawTrackOpens !== false; // default true
    const trackClicks = rawTrackClicks !== false; // default true

    // --- Step 1: Resolve senderIds (new array or legacy single) ---
    // WHY: Backward compatibility — accept either senderIds[] or legacy senderId.
    // senderIds takes precedence when both are provided.
    let senderIds: string[];
    if (Array.isArray(rawSenderIds)) {
      senderIds = rawSenderIds;
    } else if (typeof legacySenderId === "string" && legacySenderId) {
      senderIds = [legacySenderId];
    } else {
      res.status(400).json({
        message: "At least one sender is required",
      });
      return;
    }

    if (senderIds.length === 0) {
      res.status(400).json({
        message: "At least one sender is required",
      });
      return;
    }

    // --- Step 2: Required field presence check ---
    // WHY: Reject early before any DB work if the request is incomplete.
    const requiredFields: Record<string, unknown> = {
      subject,
      body,
      startTime,
      delaySeconds,
      hourlyLimit,
      emails,
    };
    const missingFields = Object.entries(requiredFields)
      .filter(([, value]) => value === undefined || value === null)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
      return;
    }

    // --- Step 3: Type and range validation ---
    // WHY: Prevents invalid data from corrupting the DB or crashing the worker.
    if (!Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({
        message: "At least one recipient email is required",
      });
      return;
    }

    if (typeof subject !== "string" || subject.trim() === "") {
      res.status(400).json({ message: "Subject must be a non-empty string" });
      return;
    }

    if (typeof body !== "string" || body.trim() === "") {
      res.status(400).json({ message: "Body must be a non-empty string" });
      return;
    }

    if (typeof delaySeconds !== "number" || delaySeconds < 0) {
      res.status(400).json({
        message: "delaySeconds must be a number >= 0",
      });
      return;
    }

    if (typeof hourlyLimit !== "number" || hourlyLimit <= 0) {
      res.status(400).json({
        message: "hourlyLimit must be a number > 0",
      });
      return;
    }

    if (isNaN(new Date(startTime).getTime())) {
      res.status(400).json({
        message: "startTime must be a valid date",
      });
      return;
    }

    // --- Step 4: Sender ownership + verification check ---
    // WHY: Ensures users can only create campaigns with their own verified senders,
    // preventing unauthorized use of another user's SMTP credentials.
    const senders = await prisma.sender.findMany({
      where: { id: { in: senderIds }, userId: req.user!.id },
    });

    if (senders.length !== senderIds.length) {
      res.status(403).json({
        message: "Sender not found or not owned by you",
      });
      return;
    }

    const unverifiedSenders = senders.filter((s) => !s.isVerified);
    if (unverifiedSenders.length > 0) {
      res.status(400).json({
        message: "All senders must be verified",
      });
      return;
    }

    // --- Step 4: Email deduplication + columnData extraction ---
    // Support both plain string emails and objects with columnData for template variables.
    interface RecipientEntry { email: string; columnData?: Record<string, string> }
    const seen = new Set<string>();
    const recipients: RecipientEntry[] = [];
    for (const entry of emails) {
      const email = (typeof entry === "string" ? entry : entry.email).toLowerCase().trim();
      if (!seen.has(email)) {
        seen.add(email);
        recipients.push({
          email,
          columnData: typeof entry === "object" ? entry.columnData : undefined,
        });
      }
    }

    const scheduledAt = new Date(startTime);

    // Check if template variables exist in subject/body
    const hasVariables = parseVariables(subject).length > 0 || parseVariables(body).length > 0;

    // --- Step 4b: Attachment size validation ---
    // WHY validate here too (not just at upload): The upload endpoint validates
    // per-request, but a user could make multiple upload requests and then
    // reference all of them in a single campaign. This check ensures the
    // campaign-level 25 MB total is enforced.
    const MAX_TOTAL_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const totalAttachmentSize = attachments.reduce(
        (sum: number, a: { size: number }) => sum + a.size,
        0,
      );
      if (totalAttachmentSize > MAX_TOTAL_ATTACHMENT_SIZE) {
        res.status(400).json({
          message: "Total attachment size exceeds the 25 MB limit",
        });
        return;
      }
    }

    // --- Step 4c: Sequence step validation ---
    const hasSequence = Array.isArray(steps) && steps.length > 0;
    if (hasSequence) {
      const validation = validateSequenceSteps(steps as SequenceStepInput[]);
      if (!validation.valid) {
        res.status(400).json({ message: validation.message });
        return;
      }
    }

    // --- Step 5: Transactional creation ---
    // WHY: Wrapping campaign + all email jobs in a single transaction prevents
    // orphaned EmailJob records if creation fails partway through. If any
    // insert fails, the entire batch rolls back cleanly.

    // Build the sender pool for round-robin assignment
    const campaignSenderData = createCampaignSenderData(senderIds);
    const poolSenders = campaignSenderData.map((cs) => {
      const sender = senders.find((s) => s.id === cs.senderId)!;
      return {
        senderId: cs.senderId,
        rotationOrder: cs.rotationOrder,
        dailyLimit: sender.dailyLimit,
      };
    });
    const senderAssignments = assignSendersRoundRobin(poolSenders, recipients.length);

    const { campaign, emailJobs, campaignSenders } = await prisma.$transaction(async (tx) => {
      const campaign = await tx.emailCampaign.create({
        data: {
          userId: req.user!.id,
          senderId: senderIds[0],
          subject,
          body,
          startTime: scheduledAt,
          delaySeconds,
          hourlyLimit,
          totalRecipients: recipients.length,
          trackOpens,
          trackClicks,
        },
      });

      // Create CampaignSender join records with sequential rotationOrder
      const campaignSenders = [];
      for (const csData of campaignSenderData) {
        const cs = await tx.campaignSender.create({
          data: {
            campaignId: campaign.id,
            senderId: csData.senderId,
            rotationOrder: csData.rotationOrder,
          },
        });
        campaignSenders.push(cs);
      }

      // Build a lookup from emailIndex → senderId from round-robin assignments
      const assignmentMap = new Map<number, string>();
      for (const assignment of senderAssignments) {
        assignmentMap.set(assignment.emailIndex, assignment.senderId);
      }

      const emailJobs = [];

      // Compute human-like scheduling with random jitter.
      // Instead of rigid fixed-interval spacing, we derive the average gap
      // from the hourly limit and apply ±40% randomness so the send pattern
      // looks like a human, not a bot.
      const senderCount = senderIds.length;
      const combinedHourlyCapacity = hourlyLimit * senderCount;
      const avgGapSeconds = 3600 / combinedHourlyCapacity;
      const delayIsBottleneck = delaySeconds > avgGapSeconds;

      let cumulativeOffsetMs = 0;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];

        if (i > 0) {
          let gap: number;
          if (delayIsBottleneck) {
            // User's delay is slower than the hourly-limit-derived gap.
            // Use the delay with light ±20% jitter.
            gap = delaySeconds * (0.8 + Math.random() * 0.4);
          } else {
            // Hourly limit is the bottleneck. Use hourly-derived spacing
            // with ±40% jitter, floored at the user's minimum delay.
            gap = avgGapSeconds * (0.6 + Math.random() * 0.8);
            gap = Math.max(gap, delaySeconds);
          }
          cumulativeOffsetMs += gap * 1000;
        }

        const jobScheduledAt = new Date(scheduledAt.getTime() + cumulativeOffsetMs);

        // Resolve template variables per recipient if variables exist and columnData is provided
        let resolvedSubject = subject;
        let resolvedBody = body;
        if (hasVariables && recipient.columnData && Object.keys(recipient.columnData).length > 0) {
          const resolved = resolveForRecipient(subject, body, {
            email: recipient.email,
            columnData: recipient.columnData,
          });
          resolvedSubject = resolved.subject;
          resolvedBody = resolved.body;
        }

        const emailJob = await tx.emailJob.create({
          data: {
            campaignId: campaign.id,
            toEmail: recipient.email,
            senderId: assignmentMap.get(i) ?? senderIds[0],
            scheduledAt: jobScheduledAt,
            columnData: recipient.columnData ?? undefined,
          },
        });

        emailJobs.push(emailJob);
      }

      // Create Attachment records if provided — linked to the campaign
      // WHY inside transaction: If attachment creation fails, the entire
      // campaign + jobs + attachments roll back together.
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const attachment of attachments) {
          await tx.attachment.create({
            data: {
              campaignId: campaign.id,
              url: attachment.url,
              filename: attachment.filename,
              size: attachment.size,
              mimeType: attachment.mimeType,
            },
          });
        }
      }

      // --- Step 5c: Create sequence steps and recipient states (if sequence present) ---
      if (hasSequence) {
        const typedSteps = steps as SequenceStepInput[];

        // Create step 0 (initial email) from campaign subject/body
        const step0 = await tx.sequenceStep.create({
          data: {
            campaignId: campaign.id,
            stepNumber: 0,
            subject,
            body,
            waitDays: 0,
          },
        });

        // Link step 0 to all initial email jobs
        for (const job of emailJobs) {
          await tx.emailJob.update({
            where: { id: job.id },
            data: { sequenceStepId: step0.id },
          });
        }

        // Create follow-up steps (1–N)
        for (let s = 0; s < typedSteps.length; s++) {
          await tx.sequenceStep.create({
            data: {
              campaignId: campaign.id,
              stepNumber: s + 1,
              subject: typedSteps[s].subject,
              body: typedSteps[s].body,
              waitDays: typedSteps[s].waitDays,
            },
          });
        }

        // Create RecipientSequenceState for each recipient
        const totalSteps = typedSteps.length + 1; // step 0 + follow-ups
        for (const recipient of recipients) {
          const stepStatuses = Array.from({ length: totalSteps }, (_, i) => ({
            stepNumber: i,
            status: "PENDING",
            sentAt: null,
            error: null,
            emailJobId: null,
          }));

          await tx.recipientSequenceState.create({
            data: {
              campaignId: campaign.id,
              recipientEmail: recipient.email,
              currentStep: 0,
              stepStatuses,
            },
          });
        }
      }

      return { campaign, emailJobs, campaignSenders };
    });

    // --- Step 6: BullMQ enqueue AFTER transaction commits ---
    // WHY: Enqueuing after commit prevents BullMQ from referencing
    // non-existent DB records if the transaction were to roll back.
    // WHY unique job IDs with UUID suffix: Prevents BullMQ jobId collision
    // when the same EmailJob is re-enqueued after rate limit rescheduling.
    for (const emailJob of emailJobs) {
      const delay = Math.max(
        0,
        new Date(emailJob.scheduledAt).getTime() - Date.now(),
      );

      await emailQueue.add(
        "send-email",
        { emailJobId: emailJob.id },
        {
          jobId: `${emailJob.id}-${crypto.randomUUID()}`,
          delay,
        },
      );
    }

    // Build senderPool for the response
    const senderPool = campaignSenders.map((cs) => {
      const sender = senders.find((s) => s.id === cs.senderId)!;
      return {
        senderId: cs.senderId,
        email: sender.email,
        name: sender.name,
        dailyLimit: sender.dailyLimit,
        rotationOrder: cs.rotationOrder,
      };
    });

    res.status(201).json({
      message: "Campaign scheduled successfully",
      campaignId: campaign.id,
      senderPool,
    });
  } catch (error: unknown) {
    // --- Step 7: Error handling ---
    // WHY: Generic message prevents leaking internal details to the client.
    res.status(500).json({
      message: "Error creating campaign",
    });
  }
};

export const getAllCampaigns = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId: req.user!.id },
      // WHY select on sender instead of include: Prevents leaking the encrypted
      // appPassword field to the client. include: { sender: true } would return
      // the full Sender object including sensitive credentials.
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(campaigns);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching campaigns",
    });
  }
};

export const getCompletedCampaigns = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const campaigns = await prisma.emailCampaign.findMany({
      where: {
        userId: req.user!.id,
        status: "COMPLETED",
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            name: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(campaigns);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching completed campaigns",
    });
  }
};


/**
 * PATCH /campaigns/:id/pause — Pause a SCHEDULED or SENDING campaign.
 * Uses optimistic concurrency via WHERE clause on expected status.
 */
export const pauseCampaign = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: { sender: { select: { id: true, email: true, name: true, isVerified: true } } },
    });

    if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (campaign.userId !== req.user!.id) { res.status(403).json({ message: "Forbidden" }); return; }
    if (!isValidTransition(campaign.status, "PAUSED")) {
      res.status(409).json({ message: `Cannot pause campaign in ${campaign.status} state` });
      return;
    }

    const result = await prisma.emailCampaign.updateMany({
      where: { id, status: campaign.status },
      data: { status: "PAUSED" },
    });

    if (result.count === 0) {
      res.status(409).json({ message: "Campaign state has changed, please retry" });
      return;
    }

    res.status(200).json({ ...campaign, status: "PAUSED" });
  } catch (error: any) {
    res.status(500).json({ message: "Error pausing campaign" });
  }
};

/**
 * PATCH /campaigns/:id/resume — Resume a PAUSED campaign.
 * Reschedules PENDING jobs if their scheduledAt is in the past.
 */
export const resumeCampaign = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, email: true, name: true, isVerified: true } },
        emails: true,
      },
    });

    if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (campaign.userId !== req.user!.id) { res.status(403).json({ message: "Forbidden" }); return; }
    if (campaign.status !== "PAUSED") {
      res.status(409).json({ message: "Only paused campaigns can be resumed" });
      return;
    }

    const pendingJobs = campaign.emails.filter((e) => e.status === "PENDING");
    const sendingJobs = campaign.emails.filter((e) => e.status === "SENDING");
    const terminalJobs = campaign.emails.filter((e) =>
      ["SENT", "FAILED", "CANCELLED"].includes(e.status)
    );

    // All jobs terminal (including case where all FAILED) → COMPLETED
    if (pendingJobs.length === 0 && sendingJobs.length === 0) {
      const result = await prisma.emailCampaign.updateMany({
        where: { id, status: "PAUSED" },
        data: { status: "COMPLETED" },
      });
      if (result.count === 0) {
        res.status(409).json({ message: "Campaign state has changed, please retry" });
        return;
      }
      res.status(200).json({ ...campaign, status: "COMPLETED" });
      return;
    }

    // Check if any PENDING job has scheduledAt in the past → reschedule
    const now = new Date();
    const needsReschedule = pendingJobs.some((j) => new Date(j.scheduledAt) < now);

    if (needsReschedule && pendingJobs.length > 0) {
      // Sort by original scheduledAt to preserve order
      const sorted = [...pendingJobs].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );

      for (let i = 0; i < sorted.length; i++) {
        const newScheduledAt = new Date(now.getTime() + i * campaign.delaySeconds * 1000);
        await prisma.emailJob.update({
          where: { id: sorted[i].id },
          data: { scheduledAt: newScheduledAt },
        });

        // Re-enqueue in BullMQ
        const delay = Math.max(0, newScheduledAt.getTime() - Date.now());
        await emailQueue.add(
          "send-email",
          { emailJobId: sorted[i].id },
          { jobId: `${sorted[i].id}-${crypto.randomUUID()}`, delay }
        );
      }
    }

    const result = await prisma.emailCampaign.updateMany({
      where: { id, status: "PAUSED" },
      data: { status: "SENDING" },
    });

    if (result.count === 0) {
      res.status(409).json({ message: "Campaign state has changed, please retry" });
      return;
    }

    res.status(200).json({ ...campaign, status: "SENDING" });
  } catch (error: any) {
    res.status(500).json({ message: "Error resuming campaign" });
  }
};

/**
 * PATCH /campaigns/:id/cancel — Cancel a campaign.
 * Transactionally updates campaign status and all PENDING emails to CANCELLED.
 */
export const cancelCampaign = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: { sender: { select: { id: true, email: true, name: true, isVerified: true } } },
    });

    if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (campaign.userId !== req.user!.id) { res.status(403).json({ message: "Forbidden" }); return; }
    if (!isValidTransition(campaign.status, "CANCELLED")) {
      res.status(409).json({ message: `Cannot cancel campaign in ${campaign.status} state` });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.emailCampaign.updateMany({
        where: { id, status: campaign.status },
        data: { status: "CANCELLED" },
      });

      if (updated.count === 0) return null;

      await tx.emailJob.updateMany({
        where: { campaignId: id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      return updated;
    });

    if (!result) {
      res.status(409).json({ message: "Campaign state has changed, please retry" });
      return;
    }

    res.status(200).json({ ...campaign, status: "CANCELLED" });
  } catch (error: any) {
    res.status(500).json({ message: "Error cancelling campaign" });
  }
};

/**
 * GET /campaigns/:id — Get campaign detail with email jobs and status counts.
 */
export const getCampaignById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, email: true, name: true, isVerified: true } },
        emails: {
          orderBy: { scheduledAt: "asc" },
          include: { sender: { select: { id: true, email: true, name: true } } },
        },
        campaignSenders: {
          orderBy: { rotationOrder: "asc" },
          include: { sender: { select: { id: true, email: true, name: true, dailyLimit: true } } },
        },
      },
    });

    if (!campaign) { res.status(404).json({ message: "Campaign not found" }); return; }
    if (campaign.userId !== req.user!.id) { res.status(403).json({ message: "Forbidden" }); return; }

    const _count = {
      pending: campaign.emails.filter((e) => e.status === "PENDING").length,
      sending: campaign.emails.filter((e) => e.status === "SENDING").length,
      sent: campaign.emails.filter((e) => e.status === "SENT").length,
      failed: campaign.emails.filter((e) => e.status === "FAILED").length,
      cancelled: campaign.emails.filter((e) => e.status === "CANCELLED").length,
    };

    // Build senderPool from campaignSenders
    let senderPool = campaign.campaignSenders.map(cs => ({
      senderId: cs.sender.id,
      email: cs.sender.email,
      name: cs.sender.name,
      dailyLimit: cs.sender.dailyLimit,
      rotationOrder: cs.rotationOrder,
    }));

    // Handle legacy campaigns: if no campaignSenders, fall back to campaign.sender
    if (senderPool.length === 0 && campaign.sender) {
      senderPool = [{
        senderId: campaign.sender.id,
        email: campaign.sender.email,
        name: campaign.sender.name,
        dailyLimit: 0,
        rotationOrder: 0,
      }];
    }

    // Build senderStats by aggregating email jobs per sender
    const senderStatsMap = new Map<string, { sent: number; failed: number; pending: number }>();
    for (const s of senderPool) {
      senderStatsMap.set(s.senderId, { sent: 0, failed: 0, pending: 0 });
    }
    for (const email of campaign.emails) {
      const sid = email.senderId;
      if (!sid) continue;
      const stats = senderStatsMap.get(sid);
      if (!stats) continue;
      if (email.status === "SENT") stats.sent++;
      else if (email.status === "FAILED") stats.failed++;
      else if (email.status === "PENDING" || email.status === "SENDING") stats.pending++;
    }
    const senderStats = senderPool.map(s => ({
      ...s,
      ...senderStatsMap.get(s.senderId)!,
    }));

    // Compute throttle state for the campaign
    let effectiveSendRate = 0;
    const activeThrottleReasons: string[] = [];

    for (const s of senderPool) {
      const limits = await getEffectiveLimits(s.senderId);
      effectiveSendRate += limits.perMinute;

      if (limits.isThrottled && !activeThrottleReasons.includes("error-throttled")) {
        activeThrottleReasons.push("error-throttled");
      }
      if (limits.isWarmup && !activeThrottleReasons.includes("warmup")) {
        activeThrottleReasons.push("warmup");
      }
      if (limits.isCooldown && !activeThrottleReasons.includes("rate-limited")) {
        activeThrottleReasons.push("rate-limited");
      }
    }

    // Check if any sender is rate-limited (hourly/minute/daily exhausted)
    const pendingCount = _count.pending + _count.sending;
    const estimatedCompletionTime =
      effectiveSendRate > 0 ? Math.ceil(pendingCount / effectiveSendRate) : null;

    res.status(200).json({
      ...campaign,
      senderPool,
      senderStats,
      _count,
      effectiveSendRate,
      activeThrottleReasons,
      estimatedCompletionTime,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error fetching campaign" });
  }
};


/**
 * GET /campaigns/:id/throttle-status — Per-sender throttle states for a campaign.
 */
export const getCampaignThrottleStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        campaignSenders: {
          orderBy: { rotationOrder: "asc" },
          include: {
            sender: {
              select: { id: true, email: true, name: true, dailyLimit: true },
            },
          },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }
    if (campaign.userId !== req.user!.id) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const senderStates = [];

    for (const cs of campaign.campaignSenders) {
      const senderId = cs.sender.id;
      const limits = await getEffectiveLimits(senderId);
      const warmupActive = await isInWarmup(senderId);
      const adaptiveState = await getAdaptiveState(senderId);
      const dailyCount = await getSentCountToday(senderId);

      // Get current hourly count — aggregate all minute-window rows for this hour
      const now = new Date();
      const hourWindow = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0)
      );
      const hourlyAggregate = await prisma.rateLimitCounter.aggregate({
        where: { senderId, hourWindow },
        _sum: { count: true },
      });
      const currentHourlyCount = hourlyAggregate._sum.count ?? 0;

      // Determine warmup status: active, inactive, or opted-out
      const warmupSchedule = await prisma.warmupSchedule.findUnique({
        where: { senderId },
      });
      let warmupStatus: string;
      if (warmupSchedule?.optedOut) {
        warmupStatus = "opted-out";
      } else if (warmupActive) {
        warmupStatus = "active";
      } else {
        warmupStatus = "inactive";
      }

      senderStates.push({
        senderId,
        email: cs.sender.email,
        name: cs.sender.name,
        currentHourlyCount,
        currentDailyCount: dailyCount,
        effectiveLimits: {
          perMinute: limits.perMinute,
          perHour: limits.perHour,
          perDay: limits.perDay,
        },
        warmupStatus,
        cooldownState: {
          status: adaptiveState.isCooldown ? "active" : "inactive",
          expiresAt: adaptiveState.cooldownExpiresAt ?? null,
        },
      });
    }

    res.status(200).json({
      campaignId: id,
      senders: senderStates,
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error fetching throttle status" });
  }
};


import {
  validateSearchQuery,
  validateStatusParam,
  validateDateRange,
} from "../utils/searchValidation";

const CAMPAIGN_STATUS_VALUES = ["SCHEDULED", "SENDING", "PAUSED", "CANCELLED", "COMPLETED"];

/**
 * GET /campaigns/search — Server-side campaign search with combinable filters.
 */
export const searchCampaigns = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const q = req.query.q as string | undefined;
    const status = req.query.status as string | undefined;
    const senderId = req.query.senderId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    for (const check of [
      validateSearchQuery(q),
      validateStatusParam(status, CAMPAIGN_STATUS_VALUES),
      validateDateRange(dateFrom, dateTo),
    ]) {
      if (!check.valid) {
        res.status(check.error!.status).json({ message: check.error!.message });
        return;
      }
    }

    const where: any = {
      userId,
      AND: [] as any[],
    };

    if (q) {
      where.AND.push({
        OR: [
          { subject: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    if (status) where.AND.push({ status });
    if (senderId) where.AND.push({ senderId });
    if (dateFrom) where.AND.push({ createdAt: { gte: new Date(dateFrom) } });
    if (dateTo) where.AND.push({ createdAt: { lte: new Date(dateTo) } });

    if (where.AND.length === 0) delete where.AND;

    const [results, total] = await Promise.all([
      prisma.emailCampaign.findMany({
        where,
        include: {
          sender: { select: { id: true, email: true, name: true, isVerified: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailCampaign.count({ where }),
    ]);

    res.status(200).json({
      results,
      total,
      filters: { q, status, senderId, dateFrom, dateTo },
    });
  } catch (error: any) {
    res.status(500).json({ message: "An error occurred while searching" });
  }
};
