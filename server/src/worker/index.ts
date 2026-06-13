import "dotenv/config";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/emailQueue";
import { processSchedulerJob } from "./sequenceScheduler";
import { autoResumePausedCampaigns } from "./autoResumeJob";
import { runReplyDetection } from "./replyDetector";
import { Queue, Worker } from "bullmq";
import { redis } from "../config/redis";
import { checkHealth } from "../utils/healthCheck";
import { startHeartbeat } from "../utils/heartbeat";

/**
 * Startup Recovery Sweep
 * 
 * WHY: If the worker process crashes while processing a job, that job's
 * status will be stuck in SENDING forever — it was claimed but never
 * completed. This sweep runs BEFORE the worker starts accepting new jobs,
 * resetting all orphaned SENDING jobs back to PENDING so BullMQ can
 * re-process them.
 * 
 * This is safe to run on every startup because:
 * - If there are no SENDING jobs, it's a no-op
 * - The updateMany WHERE clause ensures we only reset SENDING jobs
 * - Re-enqueuing with delay 0 means they're picked up immediately
 */
async function recoverOrphanedJobs(): Promise<void> {
  const orphanedJobs = await prisma.emailJob.findMany({
    where: { status: "SENDING" },
    select: { id: true },
  });

  if (orphanedJobs.length === 0) {
    console.log("📋 Startup recovery: No orphaned SENDING jobs found");
    return;
  }

  console.log(`📋 Startup recovery: Found ${orphanedJobs.length} orphaned SENDING jobs`);

  for (const job of orphanedJobs) {
    await prisma.emailJob.updateMany({
      where: { id: job.id, status: "SENDING" },
      data: { status: "PENDING" },
    });

    await emailQueue.add(
      "send-email",
      { emailJobId: job.id },
      {
        jobId: `${job.id}-recovery-${crypto.randomUUID()}`,
        delay: 0,
      },
    );
  }

  console.log(`✅ Startup recovery: Recovered ${orphanedJobs.length} orphaned jobs`);
}

/**
 * Periodic Stale-Job Sweep
 *
 * WHY: If an SMTP call hangs or the worker encounters an unhandled error
 * mid-send, a job can remain stuck in SENDING indefinitely — even while
 * the worker process is still alive. The startup sweep only catches these
 * on restart. This periodic sweep finds jobs that have been in SENDING
 * for longer than STALE_SENDING_THRESHOLD_MS (default 5 min) and resets
 * them back to PENDING so they get retried automatically.
 */
const STALE_SENDING_THRESHOLD_MS = parseInt(
  process.env.STALE_SENDING_THRESHOLD_MS || "300000", // 5 minutes
  10,
);
const STALE_SWEEP_INTERVAL_MS = parseInt(
  process.env.STALE_SWEEP_INTERVAL_MS || "120000", // 2 minutes
  10,
);

async function sweepStaleSendingJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SENDING_THRESHOLD_MS);

  const staleJobs = await prisma.emailJob.findMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (staleJobs.length === 0) return;

  console.log(`🔍 Stale sweep: Found ${staleJobs.length} SENDING jobs older than ${STALE_SENDING_THRESHOLD_MS / 1000}s`);

  for (const job of staleJobs) {
    await prisma.emailJob.updateMany({
      where: { id: job.id, status: "SENDING" },
      data: { status: "PENDING" },
    });

    await emailQueue.add(
      "send-email",
      { emailJobId: job.id },
      {
        jobId: `${job.id}-stale-recovery-${crypto.randomUUID()}`,
        delay: 0,
      },
    );
  }

  console.log(`✅ Stale sweep: Recovered ${staleJobs.length} jobs`);
}

/**
 * Stuck Campaign Cleanup Sweep
 * 
 * WHY: This is the failsafe for the "stuck in Sending" bug. 
 * If a worker crashes at the exact moment a campaign finishes, or if a
 * sequence scheduler tick is missed, the campaign stays in SENDING forever.
 * This sweep finds all SENDING campaigns and checks if they SHOULD be COMPLETED.
 */
async function sweepStuckCampaigns(): Promise<void> {
  const sendingCampaigns = await prisma.emailCampaign.findMany({
    where: { status: "SENDING" },
    include: { sequenceSteps: { select: { id: true } } },
  });

  if (sendingCampaigns.length === 0) return;

  for (const campaign of sendingCampaigns) {
    try {
      const nonTerminalCount = await prisma.emailJob.count({
        where: {
          campaignId: campaign.id,
          status: { notIn: ["SENT", "FAILED", "CANCELLED"] },
        },
      });

      // If there are still pending or sending jobs, it's not finished
      if (nonTerminalCount > 0) continue;

      const isSequence = campaign.sequenceSteps.length > 0;
      
      if (isSequence) {
        // For sequence campaigns, also ensure every recipient has finished the sequence
        const activeStatesCount = await prisma.recipientSequenceState.count({
          where: {
            campaignId: campaign.id,
            completed: false,
            paused: false,
            replied: false,
          },
        });
        if (activeStatesCount > 0) continue;
      }

      // If we got here, there are no jobs left AND (if sequence) no active recipients.
      // Mark as COMPLETED.
      const result = await prisma.emailCampaign.updateMany({
        where: { id: campaign.id, status: "SENDING" },
        data: { status: "COMPLETED" },
      });
      
      if (result.count > 0) {
        console.log(`🧹 Stuck Campaign sweep: Marked campaign ${campaign.id} as COMPLETED`);
      }
    } catch (err) {
      console.error(`Error sweeping stuck campaign ${campaign.id}:`, err);
    }
  }
}

async function main(): Promise<void> {
  await recoverOrphanedJobs();
  await sweepStuckCampaigns(); // Run once at startup to fix any existing stuck campaigns
  
  // Import the worker module AFTER recovery completes.
  // This ensures orphaned jobs are reset before the worker starts polling.
  await import("./emailWorker");
  
  console.log("📨 Email worker started and accepting jobs");

  // Start sequence scheduler as a repeatable job
  const schedulerInterval = parseInt(process.env.SEQUENCE_SCHEDULER_INTERVAL_MS || "900000", 10); // 15 min default
  const schedulerQueue = new Queue("sequence-scheduler", { connection: redis });

  // Remove any existing repeatable jobs to avoid duplicates on restart
  const existing = await schedulerQueue.getRepeatableJobs();
  for (const job of existing) {
    await schedulerQueue.removeRepeatableByKey(job.key);
  }

  await schedulerQueue.add("run-scheduler", {}, {
    repeat: { every: schedulerInterval },
  });

  new Worker("sequence-scheduler", async () => {
    await processSchedulerJob();
  }, { connection: redis });

  console.log(`📅 Sequence scheduler started (interval: ${schedulerInterval}ms)`);

  // Start auto-resume job for paused campaigns (configurable interval, default: every 1 hour)
  const autoResumeInterval = parseInt(process.env.AUTO_RESUME_INTERVAL_MS || "3600000", 10);
  const autoResumeQueue = new Queue("auto-resume", { connection: redis });

  const existingAutoResume = await autoResumeQueue.getRepeatableJobs();
  for (const job of existingAutoResume) {
    await autoResumeQueue.removeRepeatableByKey(job.key);
  }

  await autoResumeQueue.add("resume-paused-campaigns", {}, {
    repeat: { every: autoResumeInterval },
  });

  new Worker("auto-resume", async () => {
    await autoResumePausedCampaigns();
  }, { connection: redis });

  console.log(`🔄 Auto-resume scheduler started (interval: ${autoResumeInterval}ms)`);

  // Start periodic stale-SENDING sweep
  setInterval(() => {
    sweepStaleSendingJobs().catch((err) =>
      console.error("❌ Stale sweep error:", err),
    );
  }, STALE_SWEEP_INTERVAL_MS);

  console.log(`🔍 Stale-SENDING sweep started (interval: ${STALE_SWEEP_INTERVAL_MS / 1000}s, threshold: ${STALE_SENDING_THRESHOLD_MS / 1000}s)`);

  // Start periodic stuck-campaign sweep (every 5 minutes)
  const STUCK_CAMPAIGN_INTERVAL_MS = 300000;
  setInterval(() => {
    sweepStuckCampaigns().catch((err) =>
      console.error("❌ Stuck campaign sweep error:", err),
    );
  }, STUCK_CAMPAIGN_INTERVAL_MS);

  console.log(`🧹 Stuck-campaign sweep started (interval: ${STUCK_CAMPAIGN_INTERVAL_MS / 1000}s)`);

  // Poll sender inboxes for prospect replies (default: every 15 minutes)
  const replyDetectorInterval = parseInt(
    process.env.REPLY_DETECTOR_INTERVAL_MS || "900000",
    10,
  );

  setInterval(() => {
    runReplyDetection().catch((err) =>
      console.error("❌ Reply detector error:", err),
    );
  }, replyDetectorInterval);

  runReplyDetection().catch((err) =>
    console.error("❌ Reply detector initial run error:", err),
  );

  console.log(`📬 Reply detector started (interval: ${replyDetectorInterval / 1000}s)`);

  // Dead man's switch: ping Healthchecks.io while worker + dependencies are healthy.
  startHeartbeat(async () => (await checkHealth()).ok);
}

main().catch((err) => {
  console.error("❌ Failed to start email worker:", err);
  process.exit(1);
});
