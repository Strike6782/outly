// ---------------------------------------------------------------------------
// Set ENCRYPTION_KEY before any imports — the encryption module validates at
// load time and will throw if this is missing or malformed.
// ---------------------------------------------------------------------------
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the controller.
// Jest hoists jest.mock() calls above imports automatically.
// ---------------------------------------------------------------------------
jest.mock("../../config/prisma", () => ({
  prisma: {
    sender: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    emailCampaign: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../queues/emailQueue", () => ({
  emailQueue: {
    add: jest.fn(),
  },
}));

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-0001"),
}));

import * as fc from "fast-check";
import {
  createCampaign,
  getAllCampaigns,
  getCompletedCampaigns,
} from "../../controllers/campaignControllers";
import { prisma } from "../../config/prisma";
import { emailQueue } from "../../queues/emailQueue";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Helper: build mock Express req/res objects
// ---------------------------------------------------------------------------
function mockReqRes(
  body: any = {},
  user: any = { id: "user-123", email: "test@test.com" }
) {
  const req = { body, user, params: {} } as any;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return { req, res };
}


// ---------------------------------------------------------------------------
// Shared valid campaign body generator — all required fields present and valid.
// Used as a baseline by multiple properties.
// ---------------------------------------------------------------------------
function validCampaignBody(overrides: Record<string, any> = {}) {
  return {
    senderId: "sender-abc",
    subject: "Test Subject",
    body: "Test Body",
    startTime: new Date().toISOString(),
    delaySeconds: 5,
    hourlyLimit: 100,
    emails: ["a@b.com"],
    ...overrides,
  };
}

// All required campaign fields (sender is validated separately via senderIds/senderId)
const REQUIRED_FIELDS = [
  "subject",
  "body",
  "startTime",
  "delaySeconds",
  "hourlyLimit",
  "emails",
] as const;

describe("Campaign Controller — Property-Based Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Property 10: Missing Campaign Fields Return 400
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 10: Missing Campaign Fields Return 400
   *
   * For any request body missing at least one required field, createCampaign
   * returns 400 with a descriptive error message.
   *
   * Validates: Requirements 6.1, 6.2
   */
  it("Property 10: missing required campaign fields returns 400", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a non-empty subset of fields to remove
        fc.subarray(REQUIRED_FIELDS as unknown as string[], {
          minLength: 1,
          maxLength: REQUIRED_FIELDS.length,
        }),
        async (fieldsToRemove) => {
          const body = validCampaignBody();
          // Remove selected fields to simulate missing data
          for (const field of fieldsToRemove) {
            delete body[field as keyof typeof body];
          }

          const { req, res } = mockReqRes(body);
          await createCampaign(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 11: Invalid Campaign Field Values Return 400
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 11: Invalid Campaign Field Values Return 400
   *
   * Tests three sub-cases:
   *   - delaySeconds < 0 → 400
   *   - hourlyLimit <= 0 → 400
   *   - startTime that can't parse to valid Date → 400
   * All other fields are valid.
   *
   * Validates: Requirements 6.6, 6.7, 6.8
   */
  it("Property 11: invalid campaign field values return 400", async () => {
    // Sub-case 1: negative delaySeconds
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: -1 }),
        async (negativeDelay) => {
          const { req, res } = mockReqRes(
            validCampaignBody({ delaySeconds: negativeDelay })
          );
          await createCampaign(req, res);
          expect(res.status).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );

    // Sub-case 2: non-positive hourlyLimit
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ max: 0 }),
        async (badLimit) => {
          const { req, res } = mockReqRes(
            validCampaignBody({ hourlyLimit: badLimit })
          );
          await createCampaign(req, res);
          expect(res.status).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );

    // Sub-case 3: unparseable startTime
    await fc.assert(
      fc.asyncProperty(
        fc
          .string({ minLength: 1 })
          .filter((s) => isNaN(new Date(s).getTime())),
        async (badDate) => {
          const { req, res } = mockReqRes(
            validCampaignBody({ startTime: badDate })
          );
          await createCampaign(req, res);
          expect(res.status).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 12: Sender Ownership Enforced
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 12: Sender Ownership Enforced
   *
   * When prisma.sender.findFirst returns null (sender not owned by user),
   * createCampaign returns 403 and prisma.$transaction is NOT called.
   *
   * Validates: Requirements 6.9, 11.5
   */
  it("Property 12: sender not owned by user returns 403, no records created", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // arbitrary senderId
        fc.string({ minLength: 1 }), // arbitrary userId
        async (senderId, userId) => {
          jest.clearAllMocks();

          // Sender not found / not owned → findMany returns empty array
          (prisma.sender.findMany as jest.Mock).mockResolvedValue([]);

          const { req, res } = mockReqRes(
            validCampaignBody({ senderId }),
            { id: userId, email: "user@test.com" }
          );
          await createCampaign(req, res);

          expect(res.status).toHaveBeenCalledWith(403);
          expect(prisma.$transaction).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });


  // -------------------------------------------------------------------------
  // Property 13: Email Deduplication
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 13: Email Deduplication
   *
   * When the emails array contains duplicates (including case variations),
   * the number of tx.emailJob.create calls equals the number of unique
   * (lowercased, trimmed) emails.
   *
   * Validates: Requirements 6.10
   */
  it("Property 13: duplicate emails produce unique EmailJob records", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of emails with guaranteed duplicates
        fc
          .array(
            fc.constantFrom(
              "a@b.com",
              "A@B.COM",
              "c@d.com",
              "C@D.COM",
              "e@f.com",
              "E@F.COM",
              "x@y.com",
              "X@Y.COM"
            ),
            { minLength: 2, maxLength: 10 }
          )
          .filter((arr) => {
            // Ensure there is at least one duplicate after lowercasing
            const lower = arr.map((e) => e.toLowerCase().trim());
            return new Set(lower).size < lower.length;
          }),
        async (emails) => {
          jest.clearAllMocks();

          const expectedUniqueCount = new Set(
            emails.map((e) => e.toLowerCase().trim())
          ).size;

          // Mock sender ownership check — sender exists and is verified
          (prisma.sender.findMany as jest.Mock).mockResolvedValue([{
            id: "sender-abc",
            userId: "user-123",
            isVerified: true,
            dailyLimit: 500,
            email: "sender@test.com",
            name: "Test Sender",
          }]);

          // Track tx.emailJob.create calls inside the transaction callback
          const createCalls: any[] = [];
          (prisma.$transaction as jest.Mock).mockImplementation(
            async (callback: Function) => {
              const tx = {
                emailCampaign: {
                  create: jest.fn().mockResolvedValue({
                    id: "campaign-1",
                  }),
                },
                campaignSender: {
                  create: jest.fn().mockImplementation(async (args: any) => ({
                    id: "cs-1",
                    campaignId: "campaign-1",
                    senderId: args.data.senderId,
                    rotationOrder: args.data.rotationOrder,
                  })),
                },
                emailJob: {
                  create: jest.fn().mockImplementation(async (args: any) => {
                    createCalls.push(args);
                    return {
                      id: `job-${createCalls.length}`,
                      campaignId: "campaign-1",
                      toEmail: args.data.toEmail,
                      scheduledAt: args.data.scheduledAt,
                    };
                  }),
                },
              };
              return callback(tx);
            }
          );

          // Mock emailQueue.add to avoid BullMQ side effects
          (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

          const { req, res } = mockReqRes(
            validCampaignBody({ emails })
          );
          await createCampaign(req, res);

          expect(res.status).toHaveBeenCalledWith(201);
          // The number of emailJob.create calls should match unique email count
          expect(createCalls.length).toBe(expectedUniqueCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 14: Unique BullMQ Job IDs
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 14: Unique BullMQ Job IDs
   *
   * All emailQueue.add calls have unique jobId values, even when multiple
   * jobs are enqueued for the same campaign.
   *
   * Validates: Requirements 7.4, 14.6
   */
  it("Property 14: all enqueued BullMQ job IDs are unique", async () => {
    // Use an incrementing counter so each randomUUID call returns a different value
    let uuidCounter = 0;
    (crypto.randomUUID as jest.Mock).mockImplementation(
      () => `uuid-${++uuidCounter}`
    );

    await fc.assert(
      fc.asyncProperty(
        // Generate 2–20 unique emails to create multiple jobs
        fc.array(
          fc.constantFrom(
            "a@b.com",
            "c@d.com",
            "e@f.com",
            "g@h.com",
            "i@j.com",
            "k@l.com",
            "m@n.com",
            "o@p.com",
            "q@r.com",
            "s@t.com"
          ),
          { minLength: 2, maxLength: 10 }
        ),
        async (emails) => {
          jest.clearAllMocks();
          uuidCounter = 0;
          (crypto.randomUUID as jest.Mock).mockImplementation(
            () => `uuid-${++uuidCounter}`
          );

          const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase().trim()))];

          // Mock sender ownership
          (prisma.sender.findMany as jest.Mock).mockResolvedValue([{
            id: "sender-abc",
            userId: "user-123",
            isVerified: true,
            dailyLimit: 500,
            email: "sender@test.com",
            name: "Test Sender",
          }]);

          // Mock transaction — return campaign + emailJobs + campaignSenders
          let jobIndex = 0;
          (prisma.$transaction as jest.Mock).mockImplementation(
            async (callback: Function) => {
              const emailJobs: any[] = [];
              const campaignSenders: any[] = [];
              const tx = {
                emailCampaign: {
                  create: jest.fn().mockResolvedValue({ id: "campaign-1" }),
                },
                campaignSender: {
                  create: jest.fn().mockImplementation(async (args: any) => {
                    const cs = {
                      id: `cs-${campaignSenders.length + 1}`,
                      campaignId: "campaign-1",
                      senderId: args.data.senderId,
                      rotationOrder: args.data.rotationOrder,
                    };
                    campaignSenders.push(cs);
                    return cs;
                  }),
                },
                emailJob: {
                  create: jest.fn().mockImplementation(async (args: any) => {
                    jobIndex++;
                    const job = {
                      id: `job-${jobIndex}`,
                      campaignId: "campaign-1",
                      toEmail: args.data.toEmail,
                      scheduledAt: args.data.scheduledAt,
                    };
                    emailJobs.push(job);
                    return job;
                  }),
                },
              };
              const result = await callback(tx);
              return result;
            }
          );

          (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

          const { req, res } = mockReqRes(validCampaignBody({ emails }));
          await createCampaign(req, res);

          expect(res.status).toHaveBeenCalledWith(201);

          // Collect all jobId values from emailQueue.add calls
          const addCalls = (emailQueue.add as jest.Mock).mock.calls;
          expect(addCalls.length).toBe(uniqueEmails.length);

          const jobIds = addCalls.map(
            (call: any[]) => call[2]?.jobId
          );

          // All job IDs must be unique
          const uniqueJobIds = new Set(jobIds);
          expect(uniqueJobIds.size).toBe(jobIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
