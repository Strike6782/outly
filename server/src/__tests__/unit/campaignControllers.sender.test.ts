// ---------------------------------------------------------------------------
// Set ENCRYPTION_KEY before any imports — the encryption module validates at
// load time and will throw if this is missing or malformed.
// ---------------------------------------------------------------------------
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the controller.
// ---------------------------------------------------------------------------
jest.mock("../../config/prisma", () => ({
  prisma: {
    sender: { findMany: jest.fn() },
    emailCampaign: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../../queues/emailQueue", () => ({
  emailQueue: { add: jest.fn() },
}));

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-0001"),
}));

jest.mock("../../utils/throttleEngine", () => ({
  getEffectiveLimits: jest.fn().mockResolvedValue({ perMinute: 10, perHour: 100, perDay: 500, isThrottled: false, isWarmup: false, isCooldown: false }),
  computeJitteredDelay: jest.fn((v: number) => v),
}));

jest.mock("../../utils/warmupEvaluator", () => ({
  isInWarmup: jest.fn().mockReturnValue(false),
  DEFAULT_WARMUP_DAILY_LIMITS: [20, 30, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 475, 500],
}));

jest.mock("../../utils/adaptiveThrottle", () => ({
  getAdaptiveState: jest.fn().mockResolvedValue({ errorRate: 0, bounceRate: 0, consecutiveErrors: 0, isThrottled: false, isCooldown: false, rateMultiplier: 1.0 }),
}));

jest.mock("../../utils/dailyLimitTracker", () => ({
  getSentCountToday: jest.fn().mockResolvedValue(0),
}));

import {
  createCampaign,
  getCampaignById,
} from "../../controllers/campaignControllers";
import { prisma } from "../../config/prisma";
import { emailQueue } from "../../queues/emailQueue";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReqRes(
  body: any = {},
  user: any = { id: "user-1", email: "u@test.com" },
  params: any = {}
) {
  const req = { body, user, params } as any;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

function baseCampaignBody(overrides: Record<string, any> = {}) {
  return {
    subject: "Hello",
    body: "World",
    startTime: new Date().toISOString(),
    delaySeconds: 5,
    hourlyLimit: 100,
    emails: ["a@b.com", "c@d.com", "e@f.com"],
    ...overrides,
  };
}


/** Helper: build a mock sender record */
function makeSender(id: string, overrides: Record<string, any> = {}) {
  return {
    id,
    userId: "user-1",
    email: `${id}@test.com`,
    name: `Sender ${id}`,
    dailyLimit: 500,
    isVerified: true,
    ...overrides,
  };
}

/**
 * Helper: set up prisma.$transaction mock that tracks all create calls.
 * Returns an object with arrays that accumulate created records.
 */
function mockTransaction() {
  const created = {
    campaign: null as any,
    campaignSenders: [] as any[],
    emailJobs: [] as any[],
  };

  (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
    let jobIdx = 0;
    const tx = {
      emailCampaign: {
        create: jest.fn().mockImplementation(async (args: any) => {
          created.campaign = { id: "campaign-1", ...args.data };
          return created.campaign;
        }),
      },
      campaignSender: {
        create: jest.fn().mockImplementation(async (args: any) => {
          const cs = {
            id: `cs-${created.campaignSenders.length}`,
            campaignId: "campaign-1",
            ...args.data,
          };
          created.campaignSenders.push(cs);
          return cs;
        }),
      },
      emailJob: {
        create: jest.fn().mockImplementation(async (args: any) => {
          const job = {
            id: `job-${jobIdx++}`,
            campaignId: "campaign-1",
            ...args.data,
          };
          created.emailJobs.push(job);
          return job;
        }),
      },
    };
    return cb(tx);
  });

  return created;
}

// ===========================================================================
// Tests: Campaign API sender validation and response shape
// Requirements: 8.1–8.6, 9.1–9.3
// ===========================================================================
describe("Campaign Controller — Sender Rotation", () => {
  beforeEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // Test: creation with multiple senderIds creates CampaignSender records
  // and assigns EmailJobs via round-robin
  // Requirements: 8.1, 8.2
  // -----------------------------------------------------------------------
  it("creates CampaignSender records and round-robin assigns EmailJobs for multiple senderIds", async () => {
    const senderA = makeSender("s-a");
    const senderB = makeSender("s-b");
    const senderC = makeSender("s-c");

    (prisma.sender.findMany as jest.Mock).mockResolvedValue([senderA, senderB, senderC]);
    (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

    const created = mockTransaction();

    const { req, res } = mockReqRes(
      baseCampaignBody({ senderIds: ["s-a", "s-b", "s-c"] })
    );
    await createCampaign(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    // 3 CampaignSender records with sequential rotationOrder
    expect(created.campaignSenders).toHaveLength(3);
    expect(created.campaignSenders.map((cs) => cs.rotationOrder)).toEqual([0, 1, 2]);
    expect(created.campaignSenders.map((cs) => cs.senderId)).toEqual(["s-a", "s-b", "s-c"]);

    // 3 emails → round-robin across 3 senders: s-a, s-b, s-c
    expect(created.emailJobs).toHaveLength(3);
    expect(created.emailJobs[0].senderId).toBe("s-a");
    expect(created.emailJobs[1].senderId).toBe("s-b");
    expect(created.emailJobs[2].senderId).toBe("s-c");

    // Response includes senderPool
    const responseBody = res.json.mock.calls[0][0];
    expect(responseBody.senderPool).toHaveLength(3);
    expect(responseBody.senderPool[0]).toMatchObject({
      senderId: "s-a",
      email: "s-a@test.com",
      rotationOrder: 0,
    });
  });

  // -----------------------------------------------------------------------
  // Test: creation with legacy single senderId wraps into array
  // Requirements: 10.3
  // -----------------------------------------------------------------------
  it("wraps legacy single senderId into a one-element sender pool", async () => {
    const sender = makeSender("s-legacy");
    (prisma.sender.findMany as jest.Mock).mockResolvedValue([sender]);
    (emailQueue.add as jest.Mock).mockResolvedValue(undefined);

    const created = mockTransaction();

    const { req, res } = mockReqRes(
      baseCampaignBody({ senderId: "s-legacy" })
    );
    await createCampaign(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    // Single CampaignSender record
    expect(created.campaignSenders).toHaveLength(1);
    expect(created.campaignSenders[0].senderId).toBe("s-legacy");
    expect(created.campaignSenders[0].rotationOrder).toBe(0);

    // All email jobs assigned to the single sender
    for (const job of created.emailJobs) {
      expect(job.senderId).toBe("s-legacy");
    }

    // Legacy senderId set on campaign record
    expect(created.campaign.senderId).toBe("s-legacy");
  });

  // -----------------------------------------------------------------------
  // Test: empty senderIds returns 400
  // Requirements: 8.5
  // -----------------------------------------------------------------------
  it("returns 400 when senderIds is an empty array", async () => {
    const { req, res } = mockReqRes(
      baseCampaignBody({ senderIds: [] })
    );
    await createCampaign(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "At least one sender is required" })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test: no senderId or senderIds returns 400
  // Requirements: 8.5
  // -----------------------------------------------------------------------
  it("returns 400 when neither senderIds nor senderId is provided", async () => {
    const { req, res } = mockReqRes(baseCampaignBody());
    await createCampaign(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "At least one sender is required" })
    );
  });

  // -----------------------------------------------------------------------
  // Test: unverified sender returns 400
  // Requirements: 8.4
  // -----------------------------------------------------------------------
  it("returns 400 when any sender is not verified", async () => {
    const verified = makeSender("s-ok");
    const unverified = makeSender("s-bad", { isVerified: false });

    (prisma.sender.findMany as jest.Mock).mockResolvedValue([verified, unverified]);

    const { req, res } = mockReqRes(
      baseCampaignBody({ senderIds: ["s-ok", "s-bad"] })
    );
    await createCampaign(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "All senders must be verified" })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test: unauthorized sender returns 403
  // Requirements: 8.3
  // -----------------------------------------------------------------------
  it("returns 403 when a senderId does not belong to the user", async () => {
    // findMany returns only 1 of the 2 requested senders (the other isn't owned)
    (prisma.sender.findMany as jest.Mock).mockResolvedValue([
      makeSender("s-mine"),
    ]);

    const { req, res } = mockReqRes(
      baseCampaignBody({ senderIds: ["s-mine", "s-not-mine"] })
    );
    await createCampaign(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Sender not found or not owned by you" })
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Test: GET /campaigns/:id includes senderPool and senderStats
  // Requirements: 9.1, 9.2, 9.3
  // -----------------------------------------------------------------------
  it("GET detail includes senderPool and senderStats with correct aggregation", async () => {
    const campaignData = {
      id: "camp-1",
      userId: "user-1",
      senderId: "s-a",
      sender: { id: "s-a", email: "a@test.com", name: "A", isVerified: true },
      campaignSenders: [
        {
          rotationOrder: 0,
          sender: { id: "s-a", email: "a@test.com", name: "A", dailyLimit: 100 },
        },
        {
          rotationOrder: 1,
          sender: { id: "s-b", email: "b@test.com", name: "B", dailyLimit: 200 },
        },
      ],
      emails: [
        { id: "j1", senderId: "s-a", status: "SENT", scheduledAt: new Date() },
        { id: "j2", senderId: "s-a", status: "SENT", scheduledAt: new Date() },
        { id: "j3", senderId: "s-b", status: "SENT", scheduledAt: new Date() },
        { id: "j4", senderId: "s-b", status: "FAILED", scheduledAt: new Date() },
        { id: "j5", senderId: "s-a", status: "PENDING", scheduledAt: new Date() },
      ],
    };

    (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue(campaignData);

    const { req, res } = mockReqRes({}, undefined, { id: "camp-1" });
    req.user = { id: "user-1" };
    await getCampaignById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const body = res.json.mock.calls[0][0];

    // senderPool has both senders in rotationOrder
    expect(body.senderPool).toHaveLength(2);
    expect(body.senderPool[0]).toMatchObject({ senderId: "s-a", rotationOrder: 0 });
    expect(body.senderPool[1]).toMatchObject({ senderId: "s-b", rotationOrder: 1 });

    // senderStats aggregation
    const statsA = body.senderStats.find((s: any) => s.senderId === "s-a");
    expect(statsA).toMatchObject({ sent: 2, failed: 0, pending: 1 });

    const statsB = body.senderStats.find((s: any) => s.senderId === "s-b");
    expect(statsB).toMatchObject({ sent: 1, failed: 1, pending: 0 });

    // _count totals
    expect(body._count).toMatchObject({
      sent: 3,
      failed: 1,
      pending: 1,
      sending: 0,
      cancelled: 0,
    });
  });

  // -----------------------------------------------------------------------
  // Test: GET detail for legacy campaign falls back to campaign.sender
  // Requirements: 10.1, 10.2
  // -----------------------------------------------------------------------
  it("GET detail falls back to campaign.sender when no campaignSenders exist", async () => {
    const campaignData = {
      id: "camp-legacy",
      userId: "user-1",
      senderId: "s-old",
      sender: { id: "s-old", email: "old@test.com", name: "Old", isVerified: true },
      campaignSenders: [],
      emails: [
        { id: "j1", senderId: null, status: "SENT", scheduledAt: new Date() },
        { id: "j2", senderId: null, status: "PENDING", scheduledAt: new Date() },
      ],
    };

    (prisma.emailCampaign.findUnique as jest.Mock).mockResolvedValue(campaignData);

    const { req, res } = mockReqRes({}, undefined, { id: "camp-legacy" });
    req.user = { id: "user-1" };
    await getCampaignById(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    const body = res.json.mock.calls[0][0];

    // Falls back to single sender in senderPool
    expect(body.senderPool).toHaveLength(1);
    expect(body.senderPool[0]).toMatchObject({
      senderId: "s-old",
      email: "old@test.com",
    });
  });
});
