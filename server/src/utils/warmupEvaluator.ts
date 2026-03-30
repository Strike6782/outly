import { prisma } from "../config/prisma";

/**
 * Default daily send limits for the 14-day warmup ramp-up period.
 * Each index corresponds to a warmup day (0-indexed).
 */
export const DEFAULT_WARMUP_DAILY_LIMITS = [
  20, 30, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 475, 500,
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the warmup daily limit for the sender's current warmup day,
 * or `null` if the sender is not in an active warmup.
 *
 * Returns `null` when:
 * - No WarmupSchedule exists for the sender
 * - The schedule has `optedOut === true`
 * - The schedule has `isActive === false`
 * - The warmup period has completed (current day >= durationDays)
 */
export async function getWarmupDayLimit(
  senderId: string
): Promise<number | null> {
  const schedule = await prisma.warmupSchedule.findUnique({
    where: { senderId },
  });

  if (!schedule) {
    return null;
  }

  if (schedule.optedOut || !schedule.isActive) {
    return null;
  }

  const now = Date.now();
  const startTime = new Date(schedule.startDate).getTime();
  const currentDay = Math.floor((now - startTime) / MS_PER_DAY);

  if (currentDay >= schedule.durationDays) {
    return null;
  }

  const dailyLimits = schedule.dailyLimits as number[];
  return dailyLimits[currentDay] ?? null;
}

/**
 * Returns `true` if the sender is currently in an active warmup period.
 */
export async function isInWarmup(senderId: string): Promise<boolean> {
  const limit = await getWarmupDayLimit(senderId);
  return limit !== null;
}
