import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/emailQueue";
import { getEarliestResumeTime, computeJitteredDelay } from "../utils/throttleEngine";

/**
 * Deletes RateLimitCounter rows older than 2 hours.
 * Counters are only relevant for the current minute/hour window — stale rows
 * accumulate indefinitely without cleanup and slow down unique constraint lookups.
 */
export async function cleanupStaleRateLimitCounters(): Promise<void> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const { count } = await prisma.rateLimitCounter.deleteMany({
    where: { hourWindow: { lt: twoHoursAgo } },
  });
  if (count > 0) {
    console.log(`Cleaned up ${count} stale rate limit counter(s)`);
  }
}

/**
 * Deletes revoked or expired refresh tokens older than 7 days.
 * Without cleanup, the RefreshToken table grows indefinitely as tokens
 * are rotated on every refresh.
 */
export async function cleanupExpiredRefreshTokens(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { revoked: true, createdAt: { lt: sevenDaysAgo } },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });
  if (count > 0) {
    console.log(`Cleaned up ${count} expired/revoked refresh token(s)`);
  }
}

/**
 * Auto-resume campaigns that were paused due to all senders being exhausted.
 * Runs on a configurable interval (default: every 1 hour) via a repeatable BullMQ job.
 *
 * For each paused campaign:
 * 1. Calculate the earliest time any sender regains capacity
 * 2. If that time is now or in the past, resume immediately
 * 3. If in the future, skip — the next interval run will pick it up
 * 4. Re-enqueue PENDING jobs with jittered delays to avoid burst sends
 */
export async function autoResumePausedCampaigns(): Promise<void> {
  const pausedCampaigns = await prisma.emailCampaign.findMany({
    where: {
      status: "PAUSED",
      pauseReason: "ALL_SENDERS_EXHAUSTED",
    },
    include: {
      emails: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
  });

  const now = new Date();

  for (const campaign of pausedCampaigns) {
    try {
      const earliestResume = await getEarliestResumeTime(campaign.id);

      if (earliestResume > now) {
        console.log(
          `Skipping campaign ${campaign.id} — earliest resume at ${earliestResume.toISOString()}`
        );
        continue;
      }

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: "SENDING", pauseReason: null },
      });

      for (const emailJob of campaign.emails) {
        const delaySeconds = computeJitteredDelay(1);
        await emailQueue.add(
          "send-email",
          { emailJobId: emailJob.id },
          { delay: Math.round(delaySeconds * 1000) }
        );
      }

      console.log(
        `Auto-resumed campaign ${campaign.id} with ${campaign.emails.length} pending jobs (jittered delays)`
      );
    } catch (err) {
      // Campaign may have been deleted between findMany and processing —
      // log and continue to avoid crashing the entire auto-resume sweep.
      console.error(`Error processing paused campaign ${campaign.id}, skipping:`, err);
    }
  }

  // Piggyback cleanup on the same scheduled interval to avoid needing a separate job
  await cleanupStaleRateLimitCounters();
  await cleanupExpiredRefreshTokens();
}
