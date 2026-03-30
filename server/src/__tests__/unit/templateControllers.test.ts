jest.mock("../../config/prisma", () => ({
  prisma: {
    emailTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import * as fc from "fast-check";
import {
  createTemplate,
  getTemplates,
  updateTemplate,
  deleteTemplate,
} from "../../controllers/templateControllers";
import { prisma } from "../../config/prisma";

function mockReqRes(
  body: any = {},
  user: any = { id: "user-123", email: "test@test.com" },
  params: any = {}
) {
  const req = { body, user, params } as any;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
  return { req, res };
}

describe("Template Controller — Unit Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // --- createTemplate ---

  it("creates a template successfully", async () => {
    const template = { id: "t1", userId: "user-123", name: "Intro", subject: "Hi", body: "<p>Hello</p>" };
    (prisma.emailTemplate.create as jest.Mock).mockResolvedValue(template);

    const { req, res } = mockReqRes({ name: "Intro", subject: "Hi", body: "<p>Hello</p>" });
    await createTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(template);
  });

  it("rejects create with empty name (400)", async () => {
    const { req, res } = mockReqRes({ name: "  ", subject: "Hi", body: "<p>Hello</p>" });
    await createTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects create with missing name (400)", async () => {
    const { req, res } = mockReqRes({ subject: "Hi", body: "<p>Hello</p>" });
    await createTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects create with missing subject (400)", async () => {
    const { req, res } = mockReqRes({ name: "Test", body: "<p>Hello</p>" });
    await createTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects create with missing body (400)", async () => {
    const { req, res } = mockReqRes({ name: "Test", subject: "Hi" });
    await createTemplate(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 on duplicate name", async () => {
    (prisma.emailTemplate.create as jest.Mock).mockRejectedValue({ code: "P2002" });

    const { req, res } = mockReqRes({ name: "Dup", subject: "Hi", body: "<p>B</p>" });
    await createTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "A template with this name already exists" });
  });

  // --- getTemplates ---

  it("returns templates ordered by updatedAt desc", async () => {
    const templates = [
      { id: "t2", name: "B", updatedAt: new Date("2026-02-01") },
      { id: "t1", name: "A", updatedAt: new Date("2026-01-01") },
    ];
    (prisma.emailTemplate.findMany as jest.Mock).mockResolvedValue(templates);

    const { req, res } = mockReqRes();
    await getTemplates(req, res);

    expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      orderBy: { updatedAt: "desc" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(templates);
  });

  // --- updateTemplate ---

  it("updates a template successfully", async () => {
    const existing = { id: "t1", userId: "user-123", name: "Old" };
    const updated = { ...existing, name: "New" };
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.emailTemplate.update as jest.Mock).mockResolvedValue(updated);

    const { req, res } = mockReqRes({ name: "New" }, undefined, { id: "t1" });
    await updateTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it("returns 404 when updating non-existent template", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(null);

    const { req, res } = mockReqRes({ name: "X" }, undefined, { id: "nope" });
    await updateTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when updating another user's template", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "other-user",
    });

    const { req, res } = mockReqRes({ name: "X" }, undefined, { id: "t1" });
    await updateTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects update with empty name (400)", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "user-123",
    });

    const { req, res } = mockReqRes({ name: "" }, undefined, { id: "t1" });
    await updateTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 on duplicate name during update", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "user-123",
    });
    (prisma.emailTemplate.update as jest.Mock).mockRejectedValue({ code: "P2002" });

    const { req, res } = mockReqRes({ name: "Dup" }, undefined, { id: "t1" });
    await updateTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  // --- deleteTemplate ---

  it("deletes a template successfully", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "user-123",
    });
    (prisma.emailTemplate.delete as jest.Mock).mockResolvedValue({});

    const { req, res } = mockReqRes({}, undefined, { id: "t1" });
    await deleteTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(prisma.emailTemplate.delete).toHaveBeenCalledWith({ where: { id: "t1" } });
  });

  it("returns 404 when deleting non-existent template", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(null);

    const { req, res } = mockReqRes({}, undefined, { id: "nope" });
    await deleteTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when deleting another user's template", async () => {
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "other-user",
    });

    const { req, res } = mockReqRes({}, undefined, { id: "t1" });
    await deleteTemplate(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("Template Controller — Property-Based Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  /**
   * Feature: email-templates, Property 7: Empty name rejection
   * Validates: Requirements 1.4
   */
  it("Property 7: whitespace-only names are rejected with 400", async () => {
    const whitespaceArb = fc
      .array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 0, maxLength: 10 })
      .map((chars: string[]) => chars.join(""));

    await fc.assert(
      fc.asyncProperty(whitespaceArb, async (name) => {
        const { req, res } = mockReqRes({ name, subject: "S", body: "<p>B</p>" });
        await createTemplate(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-templates, Property 12: Access control returns correct HTTP status
   * Validates: Requirements 10.5, 10.6
   */
  it("Property 12: 404 for non-existent, 403 for wrong owner on update", async () => {
    // Non-existent → 404
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(null);
    const { req: req1, res: res1 } = mockReqRes({ name: "X" }, undefined, { id: "missing" });
    await updateTemplate(req1, res1);
    expect(res1.status).toHaveBeenCalledWith(404);

    // Wrong owner → 403
    jest.clearAllMocks();
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue({
      id: "t1",
      userId: "someone-else",
    });
    const { req: req2, res: res2 } = mockReqRes({ name: "X" }, undefined, { id: "t1" });
    await updateTemplate(req2, res2);
    expect(res2.status).toHaveBeenCalledWith(403);
  });
});
