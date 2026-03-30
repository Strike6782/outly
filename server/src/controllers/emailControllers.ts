import { Request, Response } from "express";
import { prisma } from "../config/prisma";

// ---------------------------------------------------------------------------
// WHY generic error messages: Internal error details (DB connection strings,
// Prisma error codes, stack traces) must never be exposed to the client.
// ---------------------------------------------------------------------------

export const toggleStar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const emailId = req.params.emailId as string;

    const email = await prisma.emailJob.findFirst({
      where: { id: emailId, campaign: { userId } },
    });

    if (!email) {
      res.status(404).json({ message: "Email not found" });
      return;
    }

    const updated = await prisma.emailJob.update({
      where: { id: emailId as string },
      data: { isStarred: !email.isStarred },
    });

    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ message: "Failed to toggle star" });
  }
};

export const scheduledEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const take = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = parseInt(req.query.offset as string) || 0;

    const emails = await prisma.emailJob.findMany({
      where: {
        status: "PENDING",
        campaign: { userId },
      },
      orderBy: { scheduledAt: "asc" },
      take,
      skip,
    });

    res.status(200).json(emails);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching scheduled emails",
    });
  }
};

export const sentEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const take = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = parseInt(req.query.offset as string) || 0;

    const emails = await prisma.emailJob.findMany({
      where: {
        status: "SENT",
        campaign: { userId },
      },
      orderBy: { sentAt: "desc" },
      take,
      skip,
    });

    res.status(200).json(emails);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching sent emails",
    });
  }
};

export const getEmailsBySender = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const senderId = req.params.senderId as string;

    const emails = await prisma.emailJob.findMany({
      where: {
        senderId,
        campaign: {
          userId,
        },
      },
      select: {
        id: true,
        campaignId: true,
        toEmail: true,
        scheduledAt: true,
        sentAt: true,
        status: true,
        error: true,
        createdAt: true,
        campaign: {
          select: {
            subject: true,
            body: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(emails);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching emails",
    });
  }
};


/**
 * PATCH /emails/:emailId/replied — Toggle the isReplied flag on a sent email.
 * Only SENT emails can be marked as replied.
 * If the campaign has a sequence, also updates RecipientSequenceState.replied.
 */
export const toggleReplied = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const emailId = req.params.emailId as string;

    const email = await prisma.emailJob.findFirst({
      where: { id: emailId, campaign: { userId } },
      include: { campaign: { select: { id: true } } },
    });

    if (!email) {
      res.status(404).json({ message: "Email not found" });
      return;
    }

    if (email.status !== "SENT") {
      res.status(409).json({ message: "Only sent emails can be marked as replied" });
      return;
    }

    const newReplied = !email.isReplied;

    const updated = await prisma.emailJob.update({
      where: { id: emailId },
      data: { isReplied: newReplied },
    });

    // If campaign has a sequence, update RecipientSequenceState.replied too
    try {
      await prisma.recipientSequenceState.updateMany({
        where: {
          campaignId: email.campaign.id,
          recipientEmail: email.toEmail,
        },
        data: { replied: newReplied },
      });
    } catch {
      // Sequence state may not exist for single-step campaigns — that's fine
    }

    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ message: "Failed to toggle replied status" });
  }
};


import {
  validateSearchQuery,
  validateStatusParam,
  validateDateRange,
  validateDateField,
} from "../utils/searchValidation";

const EMAIL_STATUS_VALUES = ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"];

/**
 * GET /emails/search — Server-side email search with combinable filters.
 */
export const searchEmails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const q = req.query.q as string | undefined;
    const status = req.query.status as string | undefined;
    const senderId = req.query.senderId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const dateField = (req.query.dateField as string) || "createdAt";
    const starred = req.query.starred as string | undefined;

    // Validate params
    for (const check of [
      validateSearchQuery(q),
      validateStatusParam(status, EMAIL_STATUS_VALUES),
      validateDateRange(dateFrom, dateTo),
      validateDateField(dateField),
    ]) {
      if (!check.valid) {
        res.status(check.error!.status).json({ message: check.error!.message });
        return;
      }
    }

    // Verify sender ownership if provided
    if (senderId) {
      const sender = await prisma.sender.findFirst({ where: { id: senderId, userId } });
      if (!sender) {
        const exists = await prisma.sender.findUnique({ where: { id: senderId } });
        res.status(exists ? 403 : 404).json({ message: exists ? "Forbidden" : "Sender not found" });
        return;
      }
    }

    // Build where clause
    const where: any = {
      campaign: { userId },
      AND: [] as any[],
    };

    if (q) {
      // Use raw SQL to cleanly search within the JSON columnData as text,
      // as well as the standard toEmail, subject, and body fields, avoiding HTML false positives if possible, 
      // but primarily ensuring we find deeply nested data like "ACME".
      const rawMatches = await prisma.$queryRaw<{ id: string }[]>`
        SELECT j."id"
        FROM "EmailJob" j
        JOIN "EmailCampaign" c ON j."campaignId" = c."id"
        WHERE c."userId" = ${userId}
        AND (
          j."toEmail" ILIKE ${'%' + q + '%'}
          OR (j."columnData")::text ILIKE ${'%' + q + '%'}
          OR c."subject" ILIKE ${'%' + q + '%'}
          OR c."body" ILIKE ${'%' + q + '%'}
        )
      `;
      const matchingIds = rawMatches.map((m) => m.id);
      
      if (matchingIds.length === 0) {
        res.status(200).json({
          results: [],
          total: 0,
          filters: { q, status, senderId, dateFrom, dateTo, dateField },
        });
        return;
      }
      
      where.AND.push({ id: { in: matchingIds } });
    }

    if (status) where.AND.push({ status });
    if (starred === "true") where.AND.push({ isStarred: true });
    if (senderId) where.AND.push({ senderId });
    // Use explicit field mapping to prevent dynamic key injection into Prisma where clause
    const SAFE_DATE_FIELDS: Record<string, string> = {
      createdAt: "createdAt",
      scheduledAt: "scheduledAt",
      sentAt: "sentAt",
    };
    const safeDateField = SAFE_DATE_FIELDS[dateField];
    if (safeDateField && dateFrom) where.AND.push({ [safeDateField]: { gte: new Date(dateFrom) } });
    if (safeDateField && dateTo) where.AND.push({ [safeDateField]: { lte: new Date(dateTo) } });

    if (where.AND.length === 0) delete where.AND;

    const [results, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        include: {
          campaign: {
            select: {
              subject: true,
              body: true,
              sender: { select: { id: true, email: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailJob.count({ where }),
    ]);

    res.status(200).json({
      results,
      total,
      filters: { q, status, senderId, dateFrom, dateTo, dateField },
    });
  } catch (error: any) {
    res.status(500).json({ message: "An error occurred while searching" });
  }
};
