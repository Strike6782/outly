import { prisma } from "../config/prisma";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ERROR_RATE_THRESHOLD = 0.1; // 10%
export const BOUNCE_RATE_THRESHOLD = 0.05; // 5%
export const CONSECUTIVE_ERROR_LIMIT = 3;
export const COOLDOWN_DURATION_MS = parseInt(
  process.env.COOLDOWN_DURATION_MS || "300000",
  10
); // default 5 minutes

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdaptiveState {
  errorRate: number;
  bounceRate: number;
  consecutiveErrors: number;
  isThrottled: boolean;
  isCooldown: boolean;
  cooldownExpiresAt?: Date;
  rateMultiplier: number;
}

// ─── Functions ───────────────────────────────────────────────────────────────

/**
 * Computes the adaptive throttle state for a sender by querying EmailJob
 * records within a rolling 1-hour window and checking SenderCooldown state.
 *
 * - errorRate: ratio of FAILED jobs to total completed jobs (SENT + FAILED)
 * - bounceRate: ratio of bounce-like failures (error message containing "bounce"
 *   or a 5xx status code pattern) to total completed jobs
 * - isThrottled: true if errorRate > ERROR_RATE_THRESHOLD OR bounceRate > BOUNCE_RATE_THRESHOLD
 * - rateMultiplier: 0.5 when throttled, 1.0 otherwise (not stacked)
 * - isCooldown: true if the sender's cooldownUntil is in the future
 */
export async function getAdaptiveState(
  senderId: string
): Promise<AdaptiveState> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Query completed email jobs (SENT or FAILED) within the rolling 1-hour window
  const recentJobs = await prisma.emailJob.findMany({
    where: {
      senderId,
      status: { in: ["SENT", "FAILED"] },
      createdAt: { gte: oneHourAgo },
    },
    select: { status: true, error: true },
  });

  const totalCount = recentJobs.length;
  const failedJobs = recentJobs.filter((j) => j.status === "FAILED");
  const failedCount = failedJobs.length;

  // Detect bounces: FAILED jobs whose error message contains "bounce" or a 5xx code
  const bouncedCount = failedJobs.filter((j) => {
    if (!j.error) return false;
    const lower = j.error.toLowerCase();
    return lower.includes("bounce") || /5\d{2}/.test(lower);
  }).length;

  const errorRate = totalCount > 0 ? failedCount / totalCount : 0;
  const bounceRate = totalCount > 0 ? bouncedCount / totalCount : 0;

  // Fetch cooldown record
  const cooldown = await prisma.senderCooldown.findUnique({
    where: { senderId },
  });

  const consecutiveErrors = cooldown?.consecutiveErrors ?? 0;
  const now = new Date();
  const isCooldown = cooldown?.cooldownUntil != null && cooldown.cooldownUntil > now;
  const cooldownExpiresAt = isCooldown ? cooldown!.cooldownUntil! : undefined;

  const isThrottled =
    errorRate > ERROR_RATE_THRESHOLD || bounceRate > BOUNCE_RATE_THRESHOLD;
  const rateMultiplier = isThrottled ? 0.5 : 1.0;

  return {
    errorRate,
    bounceRate,
    consecutiveErrors,
    isThrottled,
    isCooldown,
    cooldownExpiresAt,
    rateMultiplier,
  };
}

/**
 * Records a consecutive SMTP error for the sender.
 * Upserts the SenderCooldown record, incrementing consecutiveErrors.
 * If consecutiveErrors reaches CONSECUTIVE_ERROR_LIMIT, sets cooldownUntil
 * to now + COOLDOWN_DURATION_MS.
 */
export async function recordConsecutiveError(
  senderId: string
): Promise<void> {
  const existing = await prisma.senderCooldown.findUnique({
    where: { senderId },
  });

  const newCount = (existing?.consecutiveErrors ?? 0) + 1;
  const cooldownUntil =
    newCount >= CONSECUTIVE_ERROR_LIMIT
      ? new Date(Date.now() + COOLDOWN_DURATION_MS)
      : existing?.cooldownUntil ?? null;

  await prisma.senderCooldown.upsert({
    where: { senderId },
    create: {
      senderId,
      consecutiveErrors: newCount,
      cooldownUntil,
    },
    update: {
      consecutiveErrors: newCount,
      cooldownUntil,
    },
  });
}

/**
 * Resets consecutive errors and cooldown for the sender.
 * Called after a successful send to restore normal operation.
 */
export async function resetConsecutiveErrors(
  senderId: string
): Promise<void> {
  await prisma.senderCooldown.upsert({
    where: { senderId },
    create: {
      senderId,
      consecutiveErrors: 0,
      cooldownUntil: null,
    },
    update: {
      consecutiveErrors: 0,
      cooldownUntil: null,
    },
  });
}
