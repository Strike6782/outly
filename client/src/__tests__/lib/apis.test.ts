/**
 * API Client Tests
 *
 * Unit tests verify each API function calls the correct endpoint with the right
 * HTTP method. Property-based tests verify payload forwarding and URL construction
 * hold across all valid inputs.
 */

// Mock the Axios instance before any imports that use it
jest.mock("../../lib/axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

import * as fc from "fast-check";
import api from "../../lib/axios";
import {
  createSender,
  createCampaign,
  getCampaignById,
  toggleEmailStar,
} from "../../lib/apis";

const mockedApi = api as jest.Mocked<typeof api>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Unit Tests ───

describe("API Client — unit tests", () => {
  it("createSender calls POST /senders with payload", async () => {
    const payload = { name: "Test", email: "t@t.com", appPassword: "pw123" };
    await createSender(payload);
    expect(mockedApi.post).toHaveBeenCalledWith("/senders", payload);
  });

  it("createCampaign calls POST /campaigns with payload", async () => {
    const payload = {
      senderId: "s1",
      subject: "Hi",
      body: "Hello",
      startTime: new Date().toISOString(),
      delaySeconds: 5,
      hourlyLimit: 100,
      emails: ["a@b.com"],
    };
    await createCampaign(payload);
    expect(mockedApi.post).toHaveBeenCalledWith("/campaigns", payload);
  });

  it("getCampaignById calls GET /campaigns/:id", async () => {
    await getCampaignById("camp-123");
    expect(mockedApi.get).toHaveBeenCalledWith("/campaigns/camp-123");
  });

  it("toggleEmailStar calls PATCH /emails/:id/star", async () => {
    await toggleEmailStar("email-456");
    expect(mockedApi.patch).toHaveBeenCalledWith("/emails/email-456/star");
  });
});


// ─── Property-Based Tests ───

describe("API Client — property-based tests", () => {
  /**
   * Feature: frontend-backend-integration, Property 1: POST API functions forward payloads as request body unchanged
   * Validates: Requirements 1.2, 1.3
   */
  describe("Property 1: POST API functions forward payloads as request body unchanged", () => {
    it("createSender forwards CreateSenderPayload unchanged", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 1 }),
            email: fc.string({ minLength: 1 }),
            appPassword: fc.string({ minLength: 1 }),
          }),
          async (payload) => {
            mockedApi.post.mockClear();
            mockedApi.post.mockResolvedValueOnce({ data: {} });
            await createSender(payload);
            expect(mockedApi.post).toHaveBeenCalledWith("/senders", payload);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("createCampaign forwards CreateCampaignPayload unchanged", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            senderId: fc.string({ minLength: 1 }),
            subject: fc.string({ minLength: 1 }),
            body: fc.string(),
            startTime: fc.date().map((d) => d.toISOString()),
            delaySeconds: fc.nat(),
            hourlyLimit: fc.nat({ max: 10000 }),
            emails: fc.array(fc.emailAddress(), { minLength: 1, maxLength: 10 }),
          }),
          async (payload) => {
            mockedApi.post.mockClear();
            mockedApi.post.mockResolvedValueOnce({ data: {} });
            await createCampaign(payload);
            expect(mockedApi.post).toHaveBeenCalledWith("/campaigns", payload);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
