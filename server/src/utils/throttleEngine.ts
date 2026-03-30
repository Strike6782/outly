import { prisma } from "../config/prisma";
import { getEffectiveProviderLimits } from "./providerProfile";
import { getWarmupDayLimit } from "./warmupEvaluator";
import {
  getAdaptiveState,
  recordConsecutiveError,
  resetConsecutiveErrors,
} from "./adaptiveThrottle";
import { getSentCountToday } from "./dailyLimitTracker";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThrottleDecision {
  allowed: boolean;
  reason?:
    | "rate-limited-minute"
    | "rate-limited-hour"
    | "daily-limit"
    | "cooldown"
    | "warmup-limit";
  retryAfterMs?: number;
}

export interface EffectiveLimits {
  perMinute: number;
  perHour: number;
  perDay: number;
  isThrottled: boolean;
  isWarmup: boolean;
  isCooldown: boolean;
  cooldownExpiresAt?: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns a Date truncated to the start of the current minute. */
export function getCurrentMinuteWindow(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      0,
      0
    )
  );
}

/** Returns a Date truncated to the start of the current hour. */
export function getCurrentHourWindow(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0
    )
  );
}

// ─── Task 6.1: getEffectiveLimits ────────────────────────────────────────────

/**
 * Computes the effective rate limits for a sender by taking the minimum of
 * provider limits, user-configured limits, and warmup limits for each
 * granularity, then applying the adaptive throttle rate multiplier.
 */
export async function getEffectiveLimits(
  senderId: string
): Promise<EffectiveLimits> {
  const providerLimits = await getEffectiveProviderLimits(senderId);

  const sender = await prisma.sender.findUnique({
    where: { id: senderId },
    select: { hourlyLimit: true, dailyLimit: true },
  });

  const warmupDayLimit = await getWarmupDayLimit(senderId);
  const adaptiveState = await getAdaptiveState(senderId);

  const userDailyLimit = sender?.dailyLimit ?? providerLimits.perDay;
  const userHourlyLimit = sender?.hourlyLimit ?? providerLimits.perHour;

  // Compute effective limits: Math.min(providerLimit, userLimit) per granularity
  let perMinute = providerLimits.perMinute;
  let perHour = Math.min(providerLimits.perHour, userHourlyLimit);
  let perDay = Math.min(providerLimits.perDay, userDailyLimit);

  // For perDay: also consider warmup limit if active
  if (warmupDayLimit !== null) {
    perDay = Math.min(perDay, warmupDayLimit);
  }

  // Apply adaptive rateMultiplier (floor to at least 1 to avoid permanently blocking sends)
  perMinute = Math.max(1, Math.floor(perMinute * adaptiveState.rateMultiplier));
  perHour = Math.max(1, Math.floor(perHour * adaptiveState.rateMultiplier));
  perDay = Math.max(1, Math.floor(perDay * adaptiveState.rateMultiplier));

  return {
    perMinute,
    perHour,
    perDay,
    isThrottled: adaptiveState.isThrottled,
    isWarmup: warmupDayLimit !== null,
    isCooldown: adaptiveState.isCooldown,
    cooldownExpiresAt: adaptiveState.cooldownExpiresAt,
  };
}

// ─── Task 6.2: canSend ───────────────────────────────────────────────────────

/**
 * Determines whether a sender is allowed to send right now.
 * Checks cooldown, per-minute, per-hour, and per-day limits in order.
 * Returns a ThrottleDecision with the reason and retry delay if blocked.
 *
 * @param campaignHourlyLimit — optional campaign-level hourly cap set by the user
 *   in the compose form. When provided, the effective hourly limit is
 *   Math.min(senderLimit, campaignHourlyLimit).
 */
export async function canSend(
  senderId: string,
  campaignHourlyLimit?: number
): Promise<ThrottleDecision> {
  const limits = await getEffectiveLimits(senderId);
  const now = new Date();

  // Apply campaign-level hourly cap if provided
  const effectivePerHour = campaignHourlyLimit
    ? Math.min(limits.perHour, campaignHourlyLimit)
    : limits.perHour;

  // Check cooldown first
  if (limits.isCooldown && limits.cooldownExpiresAt) {
    const retryAfterMs = limits.cooldownExpiresAt.getTime() - now.getTime();
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Check per-minute limit
  const minuteWindow = getCurrentMinuteWindow();
  const minuteCounter = await prisma.rateLimitCounter.findUnique({
    where: { senderId_minuteWindow: { senderId, minuteWindow } },
  });
  if (minuteCounter && minuteCounter.count >= limits.perMinute) {
    const nextMinute = new Date(minuteWindow.getTime() + 60 * 1000);
    return {
      allowed: false,
      reason: "rate-limited-minute",
      retryAfterMs: Math.max(0, nextMinute.getTime() - now.getTime()),
    };
  }

  // Check per-hour limit — aggregate all minute-window rows for this hour
  const hourWindow = getCurrentHourWindow();
  const hourlyAggregate = await prisma.rateLimitCounter.aggregate({
    where: { senderId, hourWindow },
    _sum: { count: true },
  });
  const hourlyCount = hourlyAggregate._sum.count ?? 0;
  if (hourlyCount >= effectivePerHour) {
    const nextHour = new Date(hourWindow.getTime() + 60 * 60 * 1000);
    return {
      allowed: false,
      reason: "rate-limited-hour",
      retryAfterMs: Math.max(0, nextHour.getTime() - now.getTime()),
    };
  }

  // Check per-day limit
  const sentToday = await getSentCountToday(senderId);
  if (sentToday >= limits.perDay) {
    // Calculate ms until midnight UTC
    const tomorrow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    return {
      allowed: false,
      reason: "daily-limit",
      retryAfterMs: Math.max(0, tomorrow.getTime() - now.getTime()),
    };
  }

  return { allowed: true };
}

// ─── Task 6.3: recordSendResult ──────────────────────────────────────────────

/**
 * Records the result of a send attempt by incrementing the rate limit counter
 * for the current minute window and updating adaptive throttle state.
 *
 * Each counter row stores both minuteWindow and hourWindow. The per-hour count
 * is derived by aggregating all rows sharing the same (senderId, hourWindow).
 * This avoids the previous bug where separate minute and hour rows caused
 * the hourly count to be split across two records.
 */
export async function recordSendResult(
  senderId: string,
  success: boolean,
  _isBounce: boolean
): Promise<void> {
  const minuteWindow = getCurrentMinuteWindow();
  const hourWindow = getCurrentHourWindow();

  // Single upsert per send — one row per (senderId, minuteWindow).
  // The hourWindow is stored on the same row so we can aggregate for hourly checks.
  await prisma.rateLimitCounter.upsert({
    where: { senderId_minuteWindow: { senderId, minuteWindow } },
    create: { senderId, hourWindow, minuteWindow, count: 1 },
    update: { count: { increment: 1 } },
  });

  // Update adaptive throttle state
  if (!success) {
    await recordConsecutiveError(senderId);
  } else {
    await resetConsecutiveErrors(senderId);
  }
}

// ─── Task 6.4: computeJitteredDelay ──────────────────────────────────────────

/**
 * Applies ±30% random jitter to a base delay and clamps to a minimum of 1 second.
 * Returns the jittered delay in seconds.
 */
export function computeJitteredDelay(baseDelaySeconds: number): number {
  // ±30% jitter: multiply by a random factor in [0.7, 1.3]
  const jittered = baseDelaySeconds * (0.7 + Math.random() * 0.6);
  return Math.max(1, jittered);
}

// ─── Task 6.5: getEarliestResumeTime ─────────────────────────────────────────

/**
 * Calculates the earliest time any sender in a campaign's pool regains capacity.
 * Checks daily, hourly, minute, and cooldown windows for each sender.
 * Returns the minimum (earliest) resume time across all senders.
 */
export async function getEarliestResumeTime(
  campaignId: string
): Promise<Date> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      campaignSenders: {
        include: {
          sender: {
            select: {
              id: true,
              dailyLimit: true,
              hourlyLimit: true,
              providerProfile: true,
            },
          },
        },
      },
    },
  });

  if (!campaign || campaign.campaignSenders.length === 0) {
    return new Date();
  }

  const now = new Date();
  let earliestResume = new Date(
    now.getTime() + 24 * 60 * 60 * 1000
  ); // default: 24h from now

  for (const cs of campaign.campaignSenders) {
    const senderId = cs.senderId;
    const limits = await getEffectiveLimits(senderId);

    // Check cooldown
    if (limits.isCooldown && limits.cooldownExpiresAt) {
      if (limits.cooldownExpiresAt < earliestResume) {
        earliestResume = limits.cooldownExpiresAt;
      }
      continue; // sender is in cooldown, skip rate limit checks
    }

    // Check daily limit
    const sentToday = await getSentCountToday(senderId);
    if (sentToday >= limits.perDay) {
      const tomorrow = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + 1
        )
      );
      if (tomorrow < earliestResume) {
        earliestResume = tomorrow;
      }
      continue; // daily exhausted, skip finer-grained checks
    }

    // Check hourly limit — aggregate all minute-window rows for this hour
    const hourWindow = getCurrentHourWindow();
    const hourlyAggregate = await prisma.rateLimitCounter.aggregate({
      where: { senderId, hourWindow },
      _sum: { count: true },
    });
    const hourlyCount = hourlyAggregate._sum.count ?? 0;
    if (hourlyCount >= limits.perHour) {
      const nextHour = new Date(hourWindow.getTime() + 60 * 60 * 1000);
      if (nextHour < earliestResume) {
        earliestResume = nextHour;
      }
      continue; // hourly exhausted, skip minute check
    }

    // Check minute limit
    const minuteWindow = getCurrentMinuteWindow();
    const minuteCounter = await prisma.rateLimitCounter.findUnique({
      where: { senderId_minuteWindow: { senderId, minuteWindow } },
    });
    if (minuteCounter && minuteCounter.count >= limits.perMinute) {
      const nextMinute = new Date(minuteWindow.getTime() + 60 * 1000);
      if (nextMinute < earliestResume) {
        earliestResume = nextMinute;
      }
      continue;
    }

    // Sender has capacity right now
    return now;
  }

  return earliestResume;
}
