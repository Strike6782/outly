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
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));

jest.mock("../../utils/encryption", () => ({
  encrypt: jest.fn(),
}));

jest.mock("../../utils/providerProfile", () => ({
  detectProvider: jest.fn().mockReturnValue(null),
}));

jest.mock("../../utils/warmupEvaluator", () => ({
  DEFAULT_WARMUP_DAILY_LIMITS: [20, 30, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 475, 500],
  isInWarmup: jest.fn().mockReturnValue(false),
}));

jest.mock("../../utils/throttleEngine", () => ({
  getEffectiveLimits: jest.fn().mockResolvedValue({ perMinute: 10, perHour: 100, perDay: 500, isThrottled: false, isWarmup: false, isCooldown: false }),
}));

jest.mock("../../utils/adaptiveThrottle", () => ({
  getAdaptiveState: jest.fn().mockResolvedValue({ errorRate: 0, bounceRate: 0, consecutiveErrors: 0, isThrottled: false, isCooldown: false, rateMultiplier: 1.0 }),
}));

jest.mock("../../utils/dailyLimitTracker", () => ({
  getSentCountToday: jest.fn().mockResolvedValue(0),
}));

import * as fc from "fast-check";
import { createSender, getSenders, getSenderEmails } from "../../controllers/senderControllers";
import { prisma } from "../../config/prisma";
import nodemailer from "nodemailer";
import { encrypt } from "../../utils/encryption";

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
// Email regex — mirrors the one in senderControllers.ts
// ---------------------------------------------------------------------------
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

describe("Sender Controller — Property-Based Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Property 5: Missing Sender Fields Return 400
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 5: Missing Sender Fields Return 400
   *
   * For any request body missing at least one of name/email/appPassword
   * (undefined, null, or empty string), createSender returns 400.
   *
   * Validates: Requirements 4.1, 4.2
   */
  it("Property 5: missing or empty name/email/appPassword returns 400", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.option(fc.string(), { nil: undefined }),
          email: fc.option(fc.string(), { nil: undefined }),
          appPassword: fc.option(fc.string(), { nil: undefined }),
        }).filter((body) => {
          // At least one field must be missing, null, undefined, or empty/whitespace
          const isMissing = (v: any) =>
            v === undefined || v === null || (typeof v === "string" && v.trim() === "");
          return isMissing(body.name) || isMissing(body.email) || isMissing(body.appPassword);
        }),
        async (body) => {
          const { req, res } = mockReqRes(body);
          await createSender(req, res);
          expect(res.status).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 6: Invalid Email Format Returns 400
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 6: Invalid Email Format Returns 400
   *
   * For any string that doesn't match the email regex, providing all three
   * required fields but with an invalid email returns 400.
   *
   * Validates: Requirements 4.3
   */
  it("Property 6: invalid email format returns 400", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1 }),
          appPassword: fc.string({ minLength: 1 }),
          email: fc.string({ minLength: 1 }).filter((s) => !EMAIL_REGEX.test(s)),
        }),
        async ({ name, appPassword, email }) => {
          const { req, res } = mockReqRes({ name, email, appPassword });
          await createSender(req, res);
          expect(res.status).toHaveBeenCalledWith(400);
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 7: SMTP Verification Failure Returns 400
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 7: SMTP Verification Failure Returns 400
   *
   * When SMTP verify() rejects, createSender returns 400 and does NOT call
   * prisma.sender.create.
   *
   * Validates: Requirements 4.6
   */
  it("Property 7: SMTP verification failure returns 400, no DB record created", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1 }),
          email: fc.constant("valid@example.com"),
          appPassword: fc.string({ minLength: 1 }),
        }),
        async ({ name, email, appPassword }) => {
          jest.clearAllMocks();
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            verify: jest.fn().mockRejectedValue(new Error("auth failed")),
          });

          const { req, res } = mockReqRes({ name, email, appPassword });
          await createSender(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(prisma.sender.create).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 8: Successful Creation Encrypts and Sets Verified
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 8: Successful Creation Encrypts and Sets Verified
   *
   * When SMTP verify() resolves, encrypt is called with the raw appPassword,
   * prisma.sender.create is called with the encrypted password and isVerified: true,
   * and the response is 201 without appPassword.
   *
   * Validates: Requirements 4.7, 4.8, 4.9
   */
  it("Property 8: successful creation encrypts password, sets isVerified, excludes appPassword from response", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Must be non-empty after trim — the controller rejects whitespace-only strings
          name: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          appPassword: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        }),
        async ({ name, appPassword }) => {
          jest.clearAllMocks();

          const encryptedValue = "abc123iv:encrypted_hex_data";
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            verify: jest.fn().mockResolvedValue(true),
          });
          (encrypt as jest.Mock).mockReturnValue(encryptedValue);

          const fakeSender = {
            id: "sender-1",
            name,
            email: "valid@example.com",
            appPassword: encryptedValue,
            isVerified: true,
            userId: "user-123",
            smtpHost: "smtp.gmail.com",
            smtpPort: 587,
            dailyLimit: 500,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          (prisma.sender.create as jest.Mock).mockResolvedValue(fakeSender);

          const { req, res } = mockReqRes({
            name,
            email: "valid@example.com",
            appPassword,
          });
          await createSender(req, res);

          // encrypt was called with the raw password
          expect(encrypt).toHaveBeenCalledWith(appPassword);

          // prisma.sender.create was called with encrypted password and isVerified: true
          expect(prisma.sender.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                appPassword: encryptedValue,
                isVerified: true,
              }),
            })
          );

          // Response is 201
          expect(res.status).toHaveBeenCalledWith(201);

          // Response body must NOT contain appPassword
          const responseBody = res.json.mock.calls[0][0];
          expect(responseBody).not.toHaveProperty("appPassword");
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 9: API Responses Exclude App Password
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 9: API Responses Exclude App Password
   *
   * getSenders and getSenderEmails never include appPassword in their responses.
   *
   * Validates: Requirements 4.9, 5.1, 5.2
   */
  it("Property 9: getSenders and getSenderEmails responses exclude appPassword", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1 }),
            email: fc.string({ minLength: 1 }),
            name: fc.string(),
            userId: fc.constant("user-123"),
            smtpHost: fc.constant("smtp.gmail.com"),
            smtpPort: fc.constant(587),
            isVerified: fc.boolean(),
            dailyLimit: fc.nat(),
            createdAt: fc.constant(new Date()),
            updatedAt: fc.constant(new Date()),
          }),
          { minLength: 0, maxLength: 5 }
        ),
        async (senders) => {
          jest.clearAllMocks();

          // getSenders — Prisma select already excludes appPassword, so mock returns without it
          (prisma.sender.findMany as jest.Mock).mockResolvedValue(senders);

          const { req: req1, res: res1 } = mockReqRes();
          await getSenders(req1, res1);

          expect(res1.status).toHaveBeenCalledWith(200);
          const getSendersBody = res1.json.mock.calls[0][0];
          if (Array.isArray(getSendersBody)) {
            for (const s of getSendersBody) {
              expect(s).not.toHaveProperty("appPassword");
            }
          }

          // getSenderEmails — returns email strings only
          jest.clearAllMocks();
          const emailOnlySenders = senders.map((s) => ({ email: s.email }));
          (prisma.sender.findMany as jest.Mock).mockResolvedValue(emailOnlySenders);

          const { req: req2, res: res2 } = mockReqRes();
          await getSenderEmails(req2, res2);

          expect(res2.status).toHaveBeenCalledWith(200);
          const getEmailsBody = res2.json.mock.calls[0][0];
          if (Array.isArray(getEmailsBody)) {
            for (const item of getEmailsBody) {
              // Items should be strings (emails), not objects with appPassword
              if (typeof item === "object" && item !== null) {
                expect(item).not.toHaveProperty("appPassword");
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 21: Sender Operations Scoped to Authenticated User
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 21: Sender Operations Scoped to Authenticated User
   *
   * createSender stores userId matching req.user.id; getSenders queries
   * with where: { userId: req.user.id }.
   *
   * Validates: Requirements 11.1, 11.2
   */
  it("Property 21: sender operations are scoped to the authenticated user", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (userId) => {
          jest.clearAllMocks();

          // --- createSender scoping ---
          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            verify: jest.fn().mockResolvedValue(true),
          });
          (encrypt as jest.Mock).mockReturnValue("iv:encrypted");

          const fakeSender = {
            id: "s-1",
            name: "Test",
            email: "a@b.com",
            appPassword: "iv:encrypted",
            isVerified: true,
            userId,
            smtpHost: "smtp.gmail.com",
            smtpPort: 587,
            dailyLimit: 500,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          (prisma.sender.create as jest.Mock).mockResolvedValue(fakeSender);

          const { req: reqCreate, res: resCreate } = mockReqRes(
            { name: "Test", email: "a@b.com", appPassword: "pass123" },
            { id: userId, email: "user@test.com" }
          );
          await createSender(reqCreate, resCreate);

          expect(prisma.sender.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({ userId }),
            })
          );

          // --- getSenders scoping ---
          jest.clearAllMocks();
          (prisma.sender.findMany as jest.Mock).mockResolvedValue([]);

          const { req: reqGet, res: resGet } = mockReqRes(
            {},
            { id: userId, email: "user@test.com" }
          );
          await getSenders(reqGet, resGet);

          expect(prisma.sender.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { userId },
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // -------------------------------------------------------------------------
  // Property 24: Error Responses Do Not Expose Stack Traces
  // -------------------------------------------------------------------------

  /**
   * Feature: backend-smtp-email-sending, Property 24: Error Responses Do Not Expose Stack Traces
   *
   * When prisma.sender.create throws a generic Error with a stack trace,
   * the 500 response message must not contain file paths, "at ", or "Error:" patterns.
   *
   * Validates: Requirements 4.11
   */
  it("Property 24: error responses do not expose stack traces", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (errorMessage) => {
          jest.clearAllMocks();

          (nodemailer.createTransport as jest.Mock).mockReturnValue({
            verify: jest.fn().mockResolvedValue(true),
          });
          (encrypt as jest.Mock).mockReturnValue("iv:encrypted");

          const error = new Error(errorMessage);
          // Ensure the error has a realistic stack trace
          error.stack = `Error: ${errorMessage}\n    at Object.<anonymous> (/app/server/src/controllers/senderControllers.ts:42:15)\n    at Module._compile (node:internal/modules/cjs/loader:1376:14)`;
          (prisma.sender.create as jest.Mock).mockRejectedValue(error);

          const { req, res } = mockReqRes({
            name: "Test",
            email: "a@b.com",
            appPassword: "pass123",
          });
          await createSender(req, res);

          expect(res.status).toHaveBeenCalledWith(500);

          const responseBody = res.json.mock.calls[0][0];
          const msg = JSON.stringify(responseBody);

          // Must not contain file paths, "at " stack frames, or raw "Error:" prefix
          expect(msg).not.toMatch(/\/[a-zA-Z].*\.(ts|js)/); // file paths
          expect(msg).not.toMatch(/at\s+/);                  // stack trace frames
          expect(msg).not.toMatch(/Error:/);                 // raw error prefix
        }
      ),
      { numRuns: 100 }
    );
  });
});
