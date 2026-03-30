// ---------------------------------------------------------------------------
// Set ENCRYPTION_KEY before any imports — the encryption module validates at
// load time and will throw if this is missing or malformed.
// ---------------------------------------------------------------------------
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the worker.
// ---------------------------------------------------------------------------

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
    rateLimitCounter: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    sender: {
      findUnique: jest.fn(),
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

jest.mock("../../utils/dailyLimitTracker", () => ({
  hasDailyCapacity: jest.fn(),
  findAvailableSender: jest.fn(),
  getSentCountToday: jest.fn().mockResolvedValue(0),
}));

jest.mock("../../utils/throttleEngine", () => ({
  canSend: jest.fn().mockResolvedValue({ allowed: true }),
  recordSendResult: jest.fn().mockResolvedValue(undefined),
  computeJitteredDelay: jest.fn((v: number) => v),
}));

import { processEmailJob } from "../../worker/emailWorker";
import { prisma } from "../../config/prisma";
import { emailQueue } from "../../queues/emailQueue";
import nodemailer from "nodemailer";
import { decrypt } from "../../utils/encryption";
import { hasDailyCapacity, findAvailableSender } from "../../utils/dailyLimitTracker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeJob(emailJobId: string): any {
  return { data: { emailJobId } };
}

function makeSender(overrides: Record<string, any> = {}) {
  return {
    id: "sender-1",
    userId: "user-1",
    email: "sender1@example.com",
    name: "Sender One",
    appPassword: "iv_hex:cipher_hex",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    isVerified: true,
    dailyLimit: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEmailJob(overrides: Record<string, any> = {}) {
  const sender = makeSender();
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
    sender,
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
      sender,
      attachments: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Worker daily limit enforcement and sender reassignment
// Feature: sender-rotation
// Validates: Requirements 4.1, 4.2, 4.3, 5.1
// ---------------------------------------------------------------------------

describe("Email Worker — Sender Rotation: Daily Limit Enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test: worker sends when sender under daily limit
  // Validates: Requirement 4.1
  // -------------------------------------------------------------------------
  it("sends email when assigned sender is under daily limit", async () => {
    const emailJob = makeEmailJob();

    (prisma.emailJob.findUnique as jest.Mock)
      .mockResolvedValueOnce(emailJob)
      .mockResolvedValueOnce({ status: "SENDING" }); // re-read after send
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (hasDailyCapacity as jest.Mock).mockResolvedValue(true);
    (decrypt as jest.Mock).mockReturnValue("plain-password");

    const mockSendMail = jest.fn().mockResolvedValue({ messageId: "msg-1" });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
    (prisma.emailJob.count as jest.Mock).mockResolvedValue(1);
    (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue({ status: "SENDING" });

    await processEmailJob(fakeJob("job-1"));

    // hasDailyCapacity was checked for the assigned sender
    expect(hasDailyCapacity).toHaveBeenCalledWith("sender-1", 500);

    // Email was actually sent
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    // Job transitioned to SENT via direct update
    expect(prisma.emailJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "SENT" }),
      })
    );
  });

  // -------------------------------------------------------------------------
  // Test: worker reassigns job when assigned sender at daily limit
  // Validates: Requirements 4.2, 4.3
  // -------------------------------------------------------------------------
  it("reassigns job to next available sender when assigned sender is at daily limit", async () => {
    const sender1 = makeSender({ id: "sender-1", email: "s1@example.com", dailyLimit: 100 });
    const sender2 = makeSender({ id: "sender-2", email: "s2@example.com", dailyLimit: 200 });

    const emailJob = makeEmailJob({
      senderId: "sender-1",
      sender: sender1,
      campaign: {
        id: "campaign-1",
        userId: "user-1",
        senderId: "sender-1",
        subject: "Hello",
        body: "Body",
        startTime: new Date(),
        delaySeconds: 0,
        hourlyLimit: 100,
        totalRecipients: 10,
        status: "SENDING",
        pauseReason: null,
        createdAt: new Date(),
        sender: sender1,
        attachments: [],
      },
    });

    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    // Assigned sender is at daily limit
    (hasDailyCapacity as jest.Mock).mockResolvedValue(false);

    // Campaign has a sender pool
    (prisma.campaignSender.findMany as jest.Mock).mockResolvedValue([
      { senderId: "sender-1", rotationOrder: 0, sender: { id: "sender-1", dailyLimit: 100 } },
      { senderId: "sender-2", rotationOrder: 1, sender: { id: "sender-2", dailyLimit: 200 } },
    ]);

    // findAvailableSender returns the next sender with capacity
    (findAvailableSender as jest.Mock).mockResolvedValue("sender-2");

    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
    (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

    await processEmailJob(fakeJob("job-1"));

    // Should NOT have sent the email
    expect(nodemailer.createTransport).not.toHaveBeenCalled();

    // Job reassigned to sender-2 and reset to PENDING
    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { senderId: "sender-2", status: "PENDING" },
    });

    // Job re-enqueued
    expect(emailQueue.add).toHaveBeenCalledWith(
      "send-email",
      { emailJobId: "job-1" },
      { delay: 1000 },
    );
  });

  // -------------------------------------------------------------------------
  // Test: worker pauses campaign when all senders exhausted
  // Validates: Requirement 5.1
  // -------------------------------------------------------------------------
  it("pauses campaign when all senders in pool are exhausted", async () => {
    const emailJob = makeEmailJob();

    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    // Assigned sender at daily limit
    (hasDailyCapacity as jest.Mock).mockResolvedValue(false);

    // Campaign has a sender pool but all exhausted
    (prisma.campaignSender.findMany as jest.Mock).mockResolvedValue([
      { senderId: "sender-1", rotationOrder: 0, sender: { id: "sender-1", dailyLimit: 100 } },
      { senderId: "sender-2", rotationOrder: 1, sender: { id: "sender-2", dailyLimit: 200 } },
    ]);

    // No available sender — all exhausted
    (findAvailableSender as jest.Mock).mockResolvedValue(null);

    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await processEmailJob(fakeJob("job-1"));

    // Should NOT have sent the email
    expect(nodemailer.createTransport).not.toHaveBeenCalled();

    // Job reset to PENDING (not failed — will resume next day)
    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "PENDING" },
    });

    // Campaign paused with reason
    expect(prisma.emailCampaign.updateMany).toHaveBeenCalledWith({
      where: { id: "campaign-1", status: "SENDING" },
      data: { status: "PAUSED", pauseReason: "ALL_SENDERS_EXHAUSTED" },
    });

    // Job was NOT re-enqueued (paused, will resume at midnight)
    expect(emailQueue.add).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test: worker falls back to campaign.senderId for legacy jobs
  // Validates: Requirement 4.1 (legacy path)
  // -------------------------------------------------------------------------
  it("falls back to campaign.senderId when EmailJob has no senderId (legacy)", async () => {
    const sender = makeSender({ id: "legacy-sender" });

    const emailJob = makeEmailJob({
      senderId: null,
      sender: null,
      campaign: {
        id: "campaign-1",
        userId: "user-1",
        senderId: "legacy-sender",
        subject: "Hello",
        body: "Body text {{email}}",
        startTime: new Date(),
        delaySeconds: 0,
        hourlyLimit: 100,
        totalRecipients: 1,
        status: "SENDING",
        pauseReason: null,
        createdAt: new Date(),
        sender,
        attachments: [],
      },
    });

    (prisma.emailJob.findUnique as jest.Mock)
      .mockResolvedValueOnce(emailJob)
      .mockResolvedValueOnce({ status: "SENDING" }); // re-read after send
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.emailCampaign.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    // Legacy sender has capacity
    (hasDailyCapacity as jest.Mock).mockResolvedValue(true);

    (decrypt as jest.Mock).mockReturnValue("plain-password");

    const mockSendMail = jest.fn().mockResolvedValue({ messageId: "msg-1" });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);
    (prisma.emailJob.count as jest.Mock).mockResolvedValue(1);
    (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue({ status: "SENDING" });

    await processEmailJob(fakeJob("job-1"));

    // hasDailyCapacity checked with the legacy campaign sender
    expect(hasDailyCapacity).toHaveBeenCalledWith("legacy-sender", 500);

    // Email was sent using the campaign's sender
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.stringContaining("sender1@example.com"),
        to: "recipient@example.com",
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Test: legacy campaign with no pool — sender at limit leaves job PENDING
  // -------------------------------------------------------------------------
  it("leaves job PENDING when legacy campaign sender is at limit (no pool)", async () => {
    const emailJob = makeEmailJob({
      senderId: null,
      sender: null,
    });

    (prisma.emailJob.findUnique as jest.Mock).mockResolvedValue(emailJob);
    (prisma.emailJob.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    // Sender at daily limit
    (hasDailyCapacity as jest.Mock).mockResolvedValue(false);

    // No campaign sender pool (legacy)
    (prisma.campaignSender.findMany as jest.Mock).mockResolvedValue([]);

    (prisma.emailJob.update as jest.Mock).mockResolvedValue(undefined);

    await processEmailJob(fakeJob("job-1"));

    // Job reset to PENDING
    expect(prisma.emailJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "PENDING" },
    });

    // Campaign NOT paused (no pool to exhaust)
    expect(prisma.emailCampaign.updateMany).not.toHaveBeenCalled();

    // Job NOT re-enqueued
    expect(emailQueue.add).not.toHaveBeenCalled();
  });
});
