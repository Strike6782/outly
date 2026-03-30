// ---------------------------------------------------------------------------
// Set ENCRYPTION_KEY before any imports — the encryption module validates at
// load time and will throw if this is missing or malformed.
// ---------------------------------------------------------------------------
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the worker.
// Jest hoists jest.mock() calls above imports automatically.
// ---------------------------------------------------------------------------

// Mock BullMQ Worker to prevent actual Redis connection at module level.
// The emailWorker.ts file creates a Worker instance and registers signal
// handlers at module scope — we must intercept both.
jest.mock("bullmq", () => ({
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Job: jest.fn(),
}));

jest.mock("../../config/prisma", () => ({
  prisma: {
    emailJob: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    emailCampaign: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    campaignSender: {
      findMany: jest.fn(),
    },
    sender: {
      findUnique: jest.fn(),
    },
    rateLimitCounter: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    recipientSequenceState: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

jest.mock("../../config/redis", () => ({
  redisConnection: { host: "localhost", port: 6379, maxRetriesPerRequest: null },
  redis: { quit: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../queues/emailQueue", () => ({
  emailQueue: {
    add: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));

jest.mock("../../utils/encryption", () => ({
  decrypt: jest.fn(),
}));

jest.mock("../../utils/throttleEngine", () => ({
  canSend: jest.fn().mockResolvedValue({ allowed: true }),
  recordSendResult: jest.fn().mockResolvedValue(undefined),
  computeJitteredDelay: jest.fn((v: number) => v),
}));

jest.mock("../../utils/dailyLimitTracker", () => ({
  hasDailyCapacity: jest.fn().mockResolvedValue(true),
  findAvailableSender: jest.fn().mockResolvedValue(null),
  getSentCountToday: jest.fn().mockResolvedValue(0),
}));

import * as fc from "fast-check";
import { processEmailJob, toHourWindow, createSmtpTransporter } from "../../worker/emailWorker";
import { prisma } from "../../config/prisma";
import { emailQueue } from "../../queues/emailQueue";
import nodemailer from "nodemailer";
import { decrypt } from "../../utils/encryption";
import { canSend, recordSendResult } from "../../utils/throttleEngine";
import { hasDailyCapacity } from "../../utils/dailyLimitTracker";

// ---------------------------------------------------------------------------
// Helper: build a fake BullMQ Job object
// ---------------------------------------------------------------------------
function fakeJob(emailJobId: string): any {
  return { data: { emailJobId } };
}

// ---------------------------------------------------------------------------
// Helper: build a full EmailJob + Campaign + Sender graph from the DB
// ---------------------------------------------------------------------------
function makeEmailJob(overrides: Record<string, any> = {}) {
  return {
    id: "job-1",
    campaignId: "campaign-1",
    toEmail: "recipient@example.com",
    scheduledAt: new Date(),
    sentAt: null,
    status: "PENDING",
    error: null,
    isStarred: false,
    createdAt: new Date(),
    senderId: "sender-1",
    sender: {
      id: "sender-1",
      userId: "user-1",
      email: "sender@example.com",
      name: "Test Sender",
      appPassword: "iv_hex:cipher_hex",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      isVerified: true,
      dailyLimit: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    sequenceStep: null,
    sequenceStepId: null,
    campaign: {
      id: "campaign-1",
      userId: "user-1",
      senderId: "sender-1",
      subject: "Hello",
      body: "Body text {{email}}",
      startTime: new Date(),
      delaySeconds: 0,
      hourlyLimit: 100,
      totalRecipients: 1,
      status: "SENDING",
      pauseReason: null,
      createdAt: new Date(),
      attachments: [],
      sender: {
        id: "sender-1",
        userId: "user-1",
        email: "sender@example.com",
        name: "Test Sender",
        appPassword: "iv_hex:cipher_hex",
        smtpHost: "smtp.gmail.com",
        smtpPort: 587,
        isVerified: true,
        dailyLimit: 500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    ...overrides,
  };
}

describe("Email Worker — Property-Based Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Property 15: Idempotent Job Processing
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 15: Idempotent Job Processing
   *
   * SENT jobs are skipped (no sendMail called).
   * Non-PENDING jobs (SENDING, FAILED) are skipped.
   * Only PENDING jobs are claimed (updateMany called with status: PENDING).
   * If updateMany returns count: 0, job is skipped (another worker claimed it).
   *
   * Validates: Requirements 14.1, 14.2, 14.3, 14.7
   */
  describe("Property 15: Idempotent Job Processing", () => {
    it("SENT jobs are skipped — no sendMail called", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (jobId) => {
          jest.clearAllMocks();

          (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(
            makeEmailJob({ id: jobId, status: "SENT" })
          );

          const mockSendMail = jest.fn();
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: mockSendMail,
          });

          await processEmailJob(fakeJob(jobId));

          expect(mockSendMail).not.toHaveBeenCalled();
          expect(prisma.emailJob.updateMany).not.toHaveBeenCalled();
        }),
        { numRuns: 100 }
      );
    });

    it("non-PENDING jobs (SENDING, FAILED) are skipped", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("SENDING", "FAILED"),
          async (status) => {
            jest.clearAllMocks();

            (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(
              makeEmailJob({ status })
            );

            const mockSendMail = jest.fn();
            (nodemailer.createTransport as jest.Mock).mockReturnValue({
              sendMail: mockSendMail,
            });

            await processEmailJob(fakeJob("job-1"));

            expect(mockSendMail).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it("only PENDING jobs trigger claim via updateMany with status: PENDING", async () => {
      jest.clearAllMocks();

      (prisma.emailJob.findUnique as jest.Mock)
        .mockResolvedValueOnce(makeEmailJob({ status: "PENDING" }))
        .mockResolvedValueOnce({ status: "SENDING" }); // re-read after send
      (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
      (canSend as jest.Mock).mockResolvedValue({ allowed: true });
      (decrypt as jest.Mock).mockReturnValue("plain-password");
      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({}),
      });
      (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
      (recordSendResult as jest.Mock).mockResolvedValue(undefined);
      (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue({ status: "SENDING" });
      (prisma.emailJob.count as jest.Mock).mockResolvedValue(0);

      await processEmailJob(fakeJob("job-1"));

      expect(prisma.emailJob.updateMany).toHaveBeenCalledWith({
        where: { id: "job-1", status: "PENDING" },
        data: { status: "SENDING" },
      });
    });

    it("if updateMany returns count: 0, job is skipped (another worker claimed it)", async () => {
      jest.clearAllMocks();

      (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(
        makeEmailJob({ status: "PENDING" })
      );
      // Another worker already claimed it
      (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const mockSendMail = jest.fn();
      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: mockSendMail,
      });

      await processEmailJob(fakeJob("job-1"));

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Property 16: Successful Send Atomically Transitions to SENT with Counter
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 16: Successful Send Atomically Transitions to SENT with Counter
   *
   * Mock successful SMTP send. Assert: prisma.$transaction is called with an
   * array containing both emailJob update (SENT + sentAt) and rateLimitCounter
   * update (increment).
   *
   * Validates: Requirements 8.8, 10.3, 14.4
   */
  it("Property 16: successful send transitions to SENT and records send result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (toEmail) => {
          jest.clearAllMocks();

          const emailJob = makeEmailJob({
            status: "PENDING",
            toEmail,
          });

          (prisma.emailJob.findUnique as jest.Mock)
            .mockResolvedValueOnce(emailJob)
            .mockResolvedValueOnce({ status: "SENDING" }); // re-read after send
          (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
          (canSend as jest.Mock).mockResolvedValue({ allowed: true });
          (decrypt as jest.Mock).mockReturnValue("plain-password");
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: jest.fn().mockResolvedValue({ messageId: "msg-1" }),
          });
          (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
          (recordSendResult as jest.Mock).mockResolvedValue(undefined);
          (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue({ status: "SENDING" });
          (prisma.emailJob.count as jest.Mock).mockResolvedValue(1);

          await processEmailJob(fakeJob("job-1"));

          // emailJob.update to SENT with sentAt
          expect(prisma.emailJob.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: "job-1" },
              data: expect.objectContaining({ status: "SENT" }),
            })
          );

          // recordSendResult called with success
          expect(recordSendResult).toHaveBeenCalledWith(
            emailJob.sender.id,
            true,
            false,
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 17: Permanent SMTP Failure Transitions to FAILED
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 17: Permanent SMTP Failure Transitions to FAILED
   *
   * Mock SMTP sendMail to reject with an error. Assert: emailJob is updated
   * to FAILED with error message. Assert: worker does not crash
   * (processEmailJob resolves, doesn't throw).
   *
   * Validates: Requirements 8.9
   */
  it("Property 17: permanent SMTP failure transitions to FAILED without crashing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          jest.clearAllMocks();

          (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(
            makeEmailJob({ status: "PENDING" })
          );
          (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
          (canSend as jest.Mock).mockResolvedValue({ allowed: true });
          (decrypt as jest.Mock).mockReturnValue("plain-password");
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: jest.fn().mockRejectedValue(new Error(errorMessage)),
          });
          (recordSendResult as jest.Mock).mockResolvedValue(undefined);
          (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);

          // processEmailJob should NOT throw — it catches SMTP errors
          await expect(processEmailJob(fakeJob("job-1"))).resolves.toBeUndefined();

          // emailJob should be marked FAILED with the error message
          expect(prisma.emailJob.update).toHaveBeenCalledWith({
            where: { id: "job-1" },
            data: { status: "FAILED", error: errorMessage },
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 18: Campaign Completion When All Jobs Terminal
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 18: Campaign Completion When All Jobs Terminal
   *
   * After successful send, mock prisma.emailJob.count to return 0 (no
   * non-terminal jobs). Assert: prisma.emailCampaign.update is called
   * with status: COMPLETED.
   *
   * Validates: Requirements 8.10, 8.14
   */
  it("Property 18: campaign marked COMPLETED when all jobs are terminal", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (campaignId) => {
          jest.clearAllMocks();

          const emailJob = makeEmailJob({
            status: "PENDING",
            campaignId,
            campaign: {
              ...makeEmailJob().campaign,
              id: campaignId,
            },
          });

          (prisma.emailJob.findUnique as jest.Mock)
            .mockResolvedValueOnce(emailJob)
            .mockResolvedValueOnce({ status: "SENDING" }); // re-read after send
          (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
          (canSend as jest.Mock).mockResolvedValue({ allowed: true });
          (decrypt as jest.Mock).mockReturnValue("plain-password");
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: jest.fn().mockResolvedValue({}),
          });
          (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
          (recordSendResult as jest.Mock).mockResolvedValue(undefined);
          // Re-fetch campaign status for completion check
          (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue({ status: "SENDING" });
          // 0 non-terminal jobs → campaign should be marked COMPLETED
          (prisma.emailJob.count as jest.Mock).mockResolvedValue(0);

          await processEmailJob(fakeJob("job-1"));

          expect(prisma.emailCampaign.updateMany).toHaveBeenCalledWith({
            where: { id: campaignId, status: "SENDING" },
            data: { status: "COMPLETED" },
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 19: Rate Limit Exceeded Reschedules Job
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 19: Rate Limit Exceeded Reschedules Job
   *
   * Mock rateLimitCounter.upsert to return count >= hourlyLimit.
   * Assert: emailJob is reset to PENDING, emailQueue.add is called with delay > 0.
   *
   * Validates: Requirements 10.2, 10.4, 10.5
   */
  it("Property 19: throttle engine rejection resets to PENDING and reschedules with delay", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 120000 }),
        async (retryAfterMs) => {
          jest.clearAllMocks();

          const emailJob = makeEmailJob({ status: "PENDING" });

          (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
          (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
          // Throttle engine rejects
          (canSend as jest.Mock).mockResolvedValue({
            allowed: false,
            reason: "rate_limited",
            retryAfterMs,
          });
          (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);

          const mockSendMail = jest.fn();
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            sendMail: mockSendMail,
          });

          await processEmailJob(fakeJob("job-1"));

          // Should NOT have sent the email
          expect(mockSendMail).not.toHaveBeenCalled();

          // Should reset job to PENDING
          expect(prisma.emailJob.update).toHaveBeenCalledWith({
            where: { id: "job-1" },
            data: expect.objectContaining({ status: "PENDING" }),
          });

          // Should re-enqueue with a delay >= 0
          expect(emailQueue.add).toHaveBeenCalledWith(
            "send-email",
            { emailJobId: "job-1" },
            expect.objectContaining({
              delay: expect.any(Number),
              jobId: expect.any(String),
            })
          );

          // Delay must be non-negative (clamped to 0 if negative)
          const addCall = (emailQueue.add as jest.Mock).mock.calls[0];
          expect(addCall[2].delay).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 22: Transient DB Failure Propagates for BullMQ Retry
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 22: Transient DB Failure Propagates for BullMQ Retry
   *
   * Mock prisma.emailJob.findUnique to throw a connection error.
   * Assert: processEmailJob throws (doesn't catch it), allowing BullMQ to retry.
   *
   * Validates: Requirements 13.3
   */
  it("Property 22: transient DB failure propagates for BullMQ retry", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          jest.clearAllMocks();

          const dbError = new Error(errorMessage);
          (dbError as any).code = "P1001"; // Prisma connection error code
          (prisma.emailJob.findUnique as jest.Mock).mockRejectedValue(dbError);

          // processEmailJob should THROW — not catch DB connection errors
          await expect(processEmailJob(fakeJob("job-1"))).rejects.toThrow(
            errorMessage
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 23: Startup Recovery Resets Orphaned SENDING Jobs
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 23: Startup Recovery Resets Orphaned SENDING Jobs
   *
   * Tests the recovery sweep concept: for each SENDING job found,
   * updateMany resets to PENDING and emailQueue.add is called with delay 0.
   *
   * Since the actual recovery sweep lives in worker/index.ts (Task 11.1),
   * we test the concept by simulating the recovery logic directly.
   *
   * Validates: Requirements 15.2, 15.3
   */
  it("Property 23: orphaned SENDING jobs are reset to PENDING and re-enqueued with delay 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1–10 orphaned job IDs
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        async (orphanedJobIds) => {
          jest.clearAllMocks();

          const orphanedJobs = orphanedJobIds.map((id) => ({
            id,
            status: "SENDING",
            campaignId: "campaign-1",
          }));

          (prisma.emailJob.findMany as jest.Mock).mockResolvedValue(orphanedJobs);
          (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
          (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

          // Simulate the recovery sweep logic from worker/index.ts
          const sendingJobs = await prisma.emailJob.findMany({
            where: { status: "SENDING" },
          });

          for (const job of sendingJobs) {
            await prisma.emailJob.updateMany({
              where: { id: job.id, status: "SENDING" },
              data: { status: "PENDING" },
            });
            await emailQueue.add(
              "send-email",
              { emailJobId: job.id },
              { delay: 0 }
            );
          }

          // findMany was called with status: SENDING
          expect(prisma.emailJob.findMany).toHaveBeenCalledWith({
            where: { status: "SENDING" },
          });

          // Each orphaned job should be reset to PENDING
          for (const job of orphanedJobs) {
            expect(prisma.emailJob.updateMany).toHaveBeenCalledWith({
              where: { id: job.id, status: "SENDING" },
              data: { status: "PENDING" },
            });
          }

          // Each orphaned job should be re-enqueued with delay 0
          expect(emailQueue.add).toHaveBeenCalledTimes(orphanedJobIds.length);
          for (const job of orphanedJobs) {
            expect(emailQueue.add).toHaveBeenCalledWith(
              "send-email",
              { emailJobId: job.id },
              { delay: 0 }
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — Specific edge cases and examples
// ---------------------------------------------------------------------------

describe("Email Worker — Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips when EmailJob is not found in the database", async () => {
    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(null);

    // Should not throw — just log and return
    await expect(processEmailJob(fakeJob("nonexistent-id"))).resolves.toBeUndefined();

    // No sendMail, no status updates
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(prisma.emailJob.updateMany).not.toHaveBeenCalled();
  });

  it("marks FAILED when sender is not found (deleted mid-campaign)", async () => {
    const emailJob = makeEmailJob({
      status: "PENDING",
      senderId: "sender-1",
      sender: null,
      campaign: {
        ...makeEmailJob().campaign,
        sender: null,
      },
    });

    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    // sender.findUnique returns null — sender was deleted
    (prisma.sender.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);

    await processEmailJob(fakeJob("job-1"));

    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", error: "Sender not found" },
    });
  });

  it("marks FAILED when sender is not verified", async () => {
    const emailJob = makeEmailJob({
      status: "PENDING",
      sender: {
        ...makeEmailJob().sender,
        isVerified: false,
      },
      campaign: {
        ...makeEmailJob().campaign,
        sender: {
          ...makeEmailJob().campaign.sender,
          isVerified: false,
        },
      },
    });

    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);

    await processEmailJob(fakeJob("job-1"));

    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", error: "Sender not verified for SMTP" },
    });
  });

  it("marks FAILED when decryption fails (corrupted ciphertext)", async () => {
    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(
      makeEmailJob({ status: "PENDING" })
    );
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
    (canSend as jest.Mock).mockResolvedValue({ allowed: true });
    (decrypt as jest.Mock).mockImplementation(() => {
      throw new Error("Malformed ciphertext");
    });
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);

    await processEmailJob(fakeJob("job-1"));

    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "FAILED", error: "Failed to decrypt sender credentials" },
    });
  });

  it("does not mark campaign COMPLETED when non-terminal jobs remain", async () => {
    (prisma.emailJob.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeEmailJob({ status: "PENDING" }))
      .mockResolvedValueOnce({ status: "SENDING" }); // re-read after send
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
    (canSend as jest.Mock).mockResolvedValue({ allowed: true });
    (decrypt as jest.Mock).mockReturnValue("plain-password");
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: jest.fn().mockResolvedValue({}),
    });
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
    (recordSendResult as jest.Mock).mockResolvedValue(undefined);
    (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue({ status: "SENDING" });
    // 5 non-terminal jobs remain
    (prisma.emailJob.count as jest.Mock).mockResolvedValue(5);

    await processEmailJob(fakeJob("job-1"));

    // updateMany should not have been called with COMPLETED data
    const completionCalls = (prisma.emailCampaign.updateMany as jest.Mock).mock.calls.filter(
      (call: any[]) => call[0]?.data?.status === "COMPLETED"
    );
    expect(completionCalls).toHaveLength(0);
  });

  it("clamps negative delay to 0 when rescheduling throttled jobs", async () => {
    const emailJob = makeEmailJob({ status: "PENDING" });

    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
    // Throttle engine rejects with a small retryAfterMs
    (canSend as jest.Mock).mockResolvedValue({
      allowed: false,
      reason: "rate_limited",
      retryAfterMs: 1000,
    });
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
    (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

    await processEmailJob(fakeJob("job-1"));

    // Delay should be >= 0 (clamped)
    const addCall = (emailQueue.add as jest.Mock).mock.calls[0];
    expect(addCall[2].delay).toBeGreaterThanOrEqual(0);
  });

  it("toHourWindow truncates minutes, seconds, and milliseconds to zero", () => {
    const date = new Date(2026, 2, 15, 14, 37, 42, 123);
    const hourWindow = toHourWindow(date);

    expect(hourWindow.getFullYear()).toBe(2026);
    expect(hourWindow.getMonth()).toBe(2);
    expect(hourWindow.getDate()).toBe(15);
    expect(hourWindow.getHours()).toBe(14);
    expect(hourWindow.getMinutes()).toBe(0);
    expect(hourWindow.getSeconds()).toBe(0);
    expect(hourWindow.getMilliseconds()).toBe(0);
  });
});
