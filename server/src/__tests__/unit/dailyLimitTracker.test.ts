import * as fc from "fast-check";

// Mock prisma before importing the module under test
jest.mock("../../config/prisma", () => ({
  prisma: {
    emailJob: {
      count: jest.fn(),
    },
    sender: {
      findUnique: jest.fn(),
    },
    providerProfile: {
      findFirst: jest.fn(),
    },
    warmupSchedule: {
      findUnique: jest.fn(),
    },
    senderCooldown: {
      findUnique: jest.fn(),
    },
    rateLimitCounter: {
      findUnique: jest.fn(),
    },
  },
}));

import * as dailyLimitTracker from "../../utils/dailyLimitTracker";
import { prisma } from "../../config/prisma";

const mockedCount = prisma.emailJob.count as jest.Mock;

describe("Daily Limit Tracker — Property-Based Tests", () => {
  /**
   * Feature: sender-rotation, Property 7: Daily capacity check consistency
   * Validates: Requirements 4.1
   *
   * For any sender with a dailyLimit D and a current sent count C (where C >= 0),
   * hasDailyCapacity should return true if and only if C < D.
   */

  afterEach(() => {
    mockedCount.mockReset();
  });

  it("Property 7a: hasDailyCapacity returns true iff sentCount < dailyLimit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        async (senderId, dailyLimit, sentCount) => {
          mockedCount.mockResolvedValue(sentCount);

          const result = await dailyLimitTracker.hasDailyCapacity(senderId, dailyLimit);

          expect(result).toBe(sentCount < dailyLimit);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 7b: hasDailyCapacity returns false when sentCount equals dailyLimit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 1000 }),
        async (senderId, dailyLimit) => {
          mockedCount.mockResolvedValue(dailyLimit);

          const result = await dailyLimitTracker.hasDailyCapacity(senderId, dailyLimit);

          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 7c: hasDailyCapacity returns false when sentCount exceeds dailyLimit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 500 }),
        async (senderId, dailyLimit, excess) => {
          const sentCount = dailyLimit + excess;
          mockedCount.mockResolvedValue(sentCount);

          const result = await dailyLimitTracker.hasDailyCapacity(senderId, dailyLimit);

          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 7d: hasDailyCapacity returns true when sentCount is zero and dailyLimit is positive", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 1000 }),
        async (senderId, dailyLimit) => {
          mockedCount.mockResolvedValue(0);

          const result = await dailyLimitTracker.hasDailyCapacity(senderId, dailyLimit);

          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Daily Limit Tracker — Property 8: Find available sender", () => {
  /**
   * Feature: sender-rotation, Property 8: Find available sender returns a sender with remaining capacity or null
   * Validates: Requirements 4.2
   *
   * For any list of campaign senders with known daily limits and sent counts,
   * findAvailableSender should return a senderId where the sender's sent count
   * is below its daily limit, or null if all senders have reached their limits.
   * The returned sender (if any) must be a member of the input pool.
   */

  beforeEach(() => {
    mockedCount.mockReset();
  });

  afterEach(() => {
    mockedCount.mockReset();
  });
  const campaignSendersArb = fc
    .array(
      fc.record({
        dailyLimit: fc.integer({ min: 1, max: 200 }),
        sentCount: fc.integer({ min: 0, max: 200 }),
      }),
      { minLength: 1, maxLength: 10 }
    )
    .map((entries) =>
      entries.map((e, i) => ({
        senderId: `sender-${i}`,
        rotationOrder: i,
        _dailyLimit: e.dailyLimit,
        _sentCount: e.sentCount,
      }))
    );

  /**
   * Mock prisma.emailJob.count to return the _sentCount for each sender.
   * This is necessary because findAvailableSender -> hasDailyCapacity -> getSentCountToday
   * all live in the same module, so jest.spyOn on the exported getSentCountToday won't
   * intercept internal calls. We mock at the prisma layer instead.
   */
  function mockSentCounts(
    senders: { senderId: string; _sentCount: number }[]
  ) {
    const sentCountMap = new Map(
      senders.map((s) => [s.senderId, s._sentCount])
    );
    // Clear all mock state including any queued return values from prior tests
    mockedCount.mockReset();
    mockedCount.mockClear();
    mockedCount.mockImplementation((args: any) => {
      const sid = args?.where?.senderId;
      return Promise.resolve(sentCountMap.get(sid) ?? 0);
    });
  }

  /** Build a limit resolver from the test data */
  function makeLimitResolver(
    senders: { senderId: string; _dailyLimit: number }[]
  ) {
    const limitMap = new Map(
      senders.map((s) => [s.senderId, s._dailyLimit])
    );
    return async (sid: string) => limitMap.get(sid) ?? 500;
  }

  it("Property 8a: returned sender is a pool member with remaining capacity, or null if all exhausted", async () => {
    await fc.assert(
      fc.asyncProperty(campaignSendersArb, async (senders) => {
        mockSentCounts(senders);
        const limitResolver = makeLimitResolver(senders);

        const pool = senders.map(({ _sentCount, _dailyLimit, ...rest }) => rest);
        const result = await dailyLimitTracker.findAvailableSender(pool, limitResolver);

        const hasAvailable = senders.some(
          (s) => s._sentCount < s._dailyLimit
        );

        if (hasAvailable) {
          expect(result).not.toBeNull();
          expect(senders.map((s) => s.senderId)).toContain(result);
          const chosen = senders.find((s) => s.senderId === result)!;
          expect(chosen._sentCount).toBeLessThan(chosen._dailyLimit);
        } else {
          expect(result).toBeNull();
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Property 8b: returned sender respects rotationOrder (first available by order)", async () => {
    await fc.assert(
      fc.asyncProperty(campaignSendersArb, async (senders) => {
        mockSentCounts(senders);
        const limitResolver = makeLimitResolver(senders);

        const pool = senders.map(({ _sentCount, _dailyLimit, ...rest }) => rest);
        const result = await dailyLimitTracker.findAvailableSender(pool, limitResolver);

        if (result !== null) {
          const sorted = [...senders].sort(
            (a, b) => a.rotationOrder - b.rotationOrder
          );
          const firstAvailable = sorted.find(
            (s) => s._sentCount < s._dailyLimit
          );
          expect(result).toBe(firstAvailable?.senderId);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("Property 8c: returns null when all senders are at or over their daily limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(fc.integer({ min: 1, max: 100 }), {
            minLength: 1,
            maxLength: 10,
          })
          .map((limits) =>
            limits.map((limit, i) => ({
              senderId: `sender-${i}`,
              rotationOrder: i,
              _dailyLimit: limit,
              _sentCount: limit,
            }))
          ),
        async (senders) => {
          mockSentCounts(senders);
          const limitResolver = makeLimitResolver(senders);

          const pool = senders.map(({ _sentCount, _dailyLimit, ...rest }) => rest);
          const result = await dailyLimitTracker.findAvailableSender(pool, limitResolver);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
