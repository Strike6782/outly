export interface PoolSender {
  senderId: string;
  rotationOrder: number;
  dailyLimit?: number;
}

export interface SenderAssignment {
  emailIndex: number;
  senderId: string;
}

/**
 * Assigns senders to email indices using round-robin based on rotationOrder.
 *
 * - Sorts senders by rotationOrder
 * - Cycles through senders assigning to each email index
 * - If dailyLimit is provided on senders, does not assign more jobs to a sender than its dailyLimit
 * - For single sender: all jobs get the same sender
 * - Balanced distribution: difference in job count between any two senders is at most 1
 *   (unless constrained by dailyLimit)
 *
 * Returns one SenderAssignment per email (up to emailCount).
 */
export function assignSendersRoundRobin(
  senders: PoolSender[],
  emailCount: number
): SenderAssignment[] {
  if (senders.length === 0 || emailCount <= 0) {
    return [];
  }

  const sorted = [...senders].sort((a, b) => a.rotationOrder - b.rotationOrder);

  const hasDailyLimits = sorted.some((s) => s.dailyLimit !== undefined);

  if (!hasDailyLimits) {
    // Simple round-robin without daily limit constraints
    const assignments: SenderAssignment[] = [];
    for (let i = 0; i < emailCount; i++) {
      assignments.push({
        emailIndex: i,
        senderId: sorted[i % sorted.length].senderId,
      });
    }
    return assignments;
  }

  // Round-robin with daily limit tracking
  const assignedCount = new Map<string, number>();
  for (const s of sorted) {
    assignedCount.set(s.senderId, 0);
  }

  const assignments: SenderAssignment[] = [];
  let senderIndex = 0;

  for (let i = 0; i < emailCount; i++) {
    let assigned = false;
    let attempts = 0;

    while (!assigned && attempts < sorted.length) {
      const sender = sorted[senderIndex % sorted.length];
      const count = assignedCount.get(sender.senderId)!;
      const limit = sender.dailyLimit;

      if (limit === undefined || count < limit) {
        assignments.push({
          emailIndex: i,
          senderId: sender.senderId,
        });
        assignedCount.set(sender.senderId, count + 1);
        senderIndex = (senderIndex + 1) % sorted.length;
        assigned = true;
      } else {
        // This sender is at its limit, try the next one
        senderIndex = (senderIndex + 1) % sorted.length;
        attempts++;
      }
    }

    if (!assigned) {
      // All senders have hit their daily limits — stop assigning
      break;
    }
  }

  return assignments;
}

/**
 * Computes the combined daily limit across all senders in the pool.
 * Defaults to 500 per sender if dailyLimit is not provided.
 */
export function computeCombinedDailyLimit(senders: PoolSender[]): number {
  return senders.reduce((sum, s) => sum + (s.dailyLimit ?? 500), 0);
}

/**
 * Creates CampaignSender records data from an array of sender IDs.
 * Returns objects with senderId and sequential rotationOrder (0, 1, 2, ...).
 */
export function createCampaignSenderData(
  senderIds: string[]
): { senderId: string; rotationOrder: number }[] {
  return senderIds.map((senderId, index) => ({
    senderId,
    rotationOrder: index,
  }));
}
