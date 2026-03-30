import { prisma } from "../config/prisma";

/**
 * Returns the number of SENT emails for a sender today (UTC).
 * Counts EmailJob records where status = SENT and sentAt is within the current UTC day.
 */
export async function getSentCountToday(senderId: string): Promise<number> {
  const now = new Date();
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const dayEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );

  return prisma.emailJob.count({
    where: {
      senderId,
      status: "SENT",
      sentAt: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
  });
}

/**
 * Returns true if the sender has remaining daily capacity.
 * Uses the provided effective daily limit (which accounts for provider,
 * warmup, and adaptive throttle limits).
 */
export async function hasDailyCapacity(
  senderId: string,
  effectiveDailyLimit: number
): Promise<boolean> {
  const count = await getSentCountToday(senderId);
  return count < effectiveDailyLimit;
}

/**
 * Finds the next sender in the pool that has remaining daily capacity.
 * Iterates by rotationOrder. Returns the senderId or null if all exhausted.
 *
 * Accepts a function to resolve the effective daily limit for each sender,
 * avoiding a circular dependency with throttleEngine.
 */
export async function findAvailableSender(
  campaignSenders: {
    senderId: string;
    rotationOrder: number;
  }[],
  getEffectiveDailyLimit: (senderId: string) => Promise<number>
): Promise<string | null> {
  const sorted = [...campaignSenders].sort(
    (a, b) => a.rotationOrder - b.rotationOrder
  );

  for (const cs of sorted) {
    const effectiveLimit = await getEffectiveDailyLimit(cs.senderId);
    const available = await hasDailyCapacity(cs.senderId, effectiveLimit);
    if (available) {
      return cs.senderId;
    }
  }

  return null;
}
