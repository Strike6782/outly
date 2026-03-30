import * as fc from "fast-check";
import {
  assignSendersRoundRobin,
  createCampaignSenderData,
  PoolSender,
} from "../../utils/senderRotation";

// Arbitrary: generate a non-empty array of unique senders with sequential rotationOrder
const sendersArb = (min = 1, max = 10): fc.Arbitrary<PoolSender[]> =>
  fc
    .uniqueArray(fc.uuid(), { minLength: min, maxLength: max })
    .map((ids) =>
      ids.map((id, i) => ({ senderId: id, rotationOrder: i }))
    );

const emailCountArb = fc.integer({ min: 1, max: 200 });

describe("Sender Rotation — Property-Based Tests", () => {
  /**
   * Feature: sender-rotation, Property 1: Round-robin produces balanced, ordered assignments
   * Validates: Requirements 3.1, 3.2
   */

  it("Property 1a: assigns senders in cyclic rotationOrder sequence", () => {
    fc.assert(
      fc.property(sendersArb(), emailCountArb, (senders, emailCount) => {
        const assignments = assignSendersRoundRobin(senders, emailCount);
        const sorted = [...senders].sort(
          (a, b) => a.rotationOrder - b.rotationOrder
        );

        // Each assignment should follow the cyclic pattern of sorted senders
        for (let i = 0; i < assignments.length; i++) {
          expect(assignments[i].senderId).toBe(
            sorted[i % sorted.length].senderId
          );
          expect(assignments[i].emailIndex).toBe(i);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Property 1b: difference in assignment count between any two senders is at most 1", () => {
    fc.assert(
      fc.property(sendersArb(), emailCountArb, (senders, emailCount) => {
        const assignments = assignSendersRoundRobin(senders, emailCount);

        // Count assignments per sender
        const counts = new Map<string, number>();
        for (const a of assignments) {
          counts.set(a.senderId, (counts.get(a.senderId) ?? 0) + 1);
        }

        const values = [...counts.values()];
        if (values.length > 0) {
          const maxCount = Math.max(...values);
          const minCount = Math.min(...values);
          expect(maxCount - minCount).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Property 1c: total assignments equals emailCount", () => {
    fc.assert(
      fc.property(sendersArb(), emailCountArb, (senders, emailCount) => {
        const assignments = assignSendersRoundRobin(senders, emailCount);
        expect(assignments.length).toBe(emailCount);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 1d: single sender gets all assignments", () => {
    fc.assert(
      fc.property(fc.uuid(), emailCountArb, (senderId, emailCount) => {
        const senders: PoolSender[] = [{ senderId, rotationOrder: 0 }];
        const assignments = assignSendersRoundRobin(senders, emailCount);

        expect(assignments.length).toBe(emailCount);
        for (const a of assignments) {
          expect(a.senderId).toBe(senderId);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns empty array for empty senders or zero emailCount", () => {
    expect(assignSendersRoundRobin([], 5)).toEqual([]);
    expect(
      assignSendersRoundRobin(
        [{ senderId: "s1", rotationOrder: 0 }],
        0
      )
    ).toEqual([]);
    expect(assignSendersRoundRobin([], 0)).toEqual([]);
  });
});

describe("Sender Rotation — Referential Integrity", () => {
  /**
   * Feature: sender-rotation, Property 2: EmailJob sender referential integrity
   * Validates: Requirements 1.5
   *
   * For any campaign with a sender pool of size ≥ 1 and any number of email jobs,
   * every EmailJob's senderId produced by assignSendersRoundRobin must reference
   * a sender that exists in the campaign's CampaignSender pool.
   */

  it("Property 2: every assigned senderId exists in the input sender pool", () => {
    fc.assert(
      fc.property(sendersArb(), emailCountArb, (senders, emailCount) => {
        const assignments = assignSendersRoundRobin(senders, emailCount);
        const poolIds = new Set(senders.map((s) => s.senderId));

        for (const a of assignments) {
          expect(poolIds.has(a.senderId)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Property 2b: referential integrity holds with daily-limited senders", () => {
    const limitedSendersArb = fc
      .uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 })
      .map((ids) =>
        ids.map((id, i) => ({
          senderId: id,
          rotationOrder: i,
          dailyLimit: fc.sample(fc.integer({ min: 1, max: 50 }), 1)[0],
        }))
      );

    fc.assert(
      fc.property(limitedSendersArb, emailCountArb, (senders, emailCount) => {
        const assignments = assignSendersRoundRobin(senders, emailCount);
        const poolIds = new Set(senders.map((s) => s.senderId));

        for (const a of assignments) {
          expect(poolIds.has(a.senderId)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Property 2c: no assignments reference senders outside the pool", () => {
    fc.assert(
      fc.property(
        sendersArb(2, 8),
        emailCountArb,
        fc.uuid(),
        (senders, emailCount, outsiderId) => {
          // Ensure outsiderId is not in the pool
          fc.pre(!senders.some((s) => s.senderId === outsiderId));

          const assignments = assignSendersRoundRobin(senders, emailCount);

          for (const a of assignments) {
            expect(a.senderId).not.toBe(outsiderId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe("Sender Rotation — Daily Limit Respect", () => {
  /**
   * Feature: sender-rotation, Property 3: Assignment respects per-sender daily limits
   * Validates: Requirements 3.5
   *
   * For any set of senders with varying dailyLimit values and any number of email
   * recipients, the round-robin assignment should not assign more jobs to any sender
   * than that sender's dailyLimit.
   */

  // Arbitrary: senders with explicit daily limits
  const limitedSendersArb = fc
    .uniqueArray(fc.uuid(), { minLength: 1, maxLength: 10 })
    .chain((ids) =>
      fc
        .tuple(
          ...ids.map(() => fc.integer({ min: 1, max: 50 }))
        )
        .map((limits) =>
          ids.map((id, i) => ({
            senderId: id,
            rotationOrder: i,
            dailyLimit: limits[i],
          }))
        )
    );

  it("Property 3a: no sender is assigned more jobs than its dailyLimit", () => {
    fc.assert(
      fc.property(
        limitedSendersArb,
        fc.integer({ min: 1, max: 300 }),
        (senders, emailCount) => {
          const assignments = assignSendersRoundRobin(senders, emailCount);

          const counts = new Map<string, number>();
          for (const a of assignments) {
            counts.set(a.senderId, (counts.get(a.senderId) ?? 0) + 1);
          }

          for (const s of senders) {
            const assigned = counts.get(s.senderId) ?? 0;
            expect(assigned).toBeLessThanOrEqual(s.dailyLimit!);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3b: total assignments equals min(emailCount, sum of all dailyLimits)", () => {
    fc.assert(
      fc.property(
        limitedSendersArb,
        fc.integer({ min: 1, max: 300 }),
        (senders, emailCount) => {
          const assignments = assignSendersRoundRobin(senders, emailCount);
          const totalCapacity = senders.reduce(
            (sum, s) => sum + s.dailyLimit!,
            0
          );

          expect(assignments.length).toBe(Math.min(emailCount, totalCapacity));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 3c: when emailCount <= combined capacity, all emails are assigned", () => {
    fc.assert(
      fc.property(limitedSendersArb, (senders) => {
        const totalCapacity = senders.reduce(
          (sum, s) => sum + s.dailyLimit!,
          0
        );
        // Pick an emailCount that fits within capacity
        const emailCount = Math.max(
          1,
          Math.floor(totalCapacity * 0.8)
        );
        const assignments = assignSendersRoundRobin(senders, emailCount);

        expect(assignments.length).toBe(emailCount);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 3d: when emailCount exceeds combined capacity, assignments are capped", () => {
    fc.assert(
      fc.property(limitedSendersArb, (senders) => {
        const totalCapacity = senders.reduce(
          (sum, s) => sum + s.dailyLimit!,
          0
        );
        const emailCount = totalCapacity + 50;
        const assignments = assignSendersRoundRobin(senders, emailCount);

        expect(assignments.length).toBe(totalCapacity);
      }),
      { numRuns: 100 }
    );
  });
});



describe("Sender Rotation — Sequential rotationOrder", () => {
  /**
   * Feature: sender-rotation, Property 11: CampaignSender rotationOrder is sequential
   * Validates: Requirements 8.2
   *
   * For any array of sender IDs of length N, the created CampaignSender records
   * should have rotationOrder values forming the sequence 0, 1, 2, ..., N-1,
   * with each sender ID appearing exactly once.
   */

  it("Property 11a: rotationOrder forms a 0-based sequential sequence", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 20 }),
        (senderIds) => {
          const records = createCampaignSenderData(senderIds);

          for (let i = 0; i < records.length; i++) {
            expect(records[i].rotationOrder).toBe(i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 11b: output length equals input length", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 20 }),
        (senderIds) => {
          const records = createCampaignSenderData(senderIds);
          expect(records.length).toBe(senderIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 11c: each sender ID appears exactly once and order is preserved", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 20 }),
        (senderIds) => {
          const records = createCampaignSenderData(senderIds);

          const outputIds = records.map((r) => r.senderId);
          expect(outputIds).toEqual(senderIds);

          // Verify uniqueness
          const unique = new Set(outputIds);
          expect(unique.size).toBe(senderIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 11d: empty input produces empty output", () => {
    const records = createCampaignSenderData([]);
    expect(records).toEqual([]);
  });
});
