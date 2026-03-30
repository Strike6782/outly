import { Request, Response } from "express";
import { prisma } from "../config/prisma";

/**
 * 1x1 transparent GIF — smallest valid GIF89a image (43 bytes).
 * Served as the tracking pixel response.
 */
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

/**
 * GET /track/open/:emailJobId
 *
 * Records an OPEN tracking event and returns a 1x1 transparent GIF.
 * Public endpoint — no authentication required.
 *
 * Edge cases:
 * - Invalid emailJobId: still returns the GIF to avoid broken images in emails.
 * - Repeat opens: each event is recorded individually.
 */
export const handleOpen = async (req: Request, res: Response): Promise<void> => {
  const emailJobId = req.params.emailJobId as string;
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = (req.headers["user-agent"] as string) || null;

  // Fire-and-forget: record the event but don't block the response
  try {
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      select: { id: true },
    });

    if (emailJob) {
      await prisma.trackingEvent.create({
        data: {
          emailJobId,
          eventType: "OPEN",
          ipAddress,
          userAgent,
        },
      });
    }
  } catch (err) {
    // Log but don't fail — the pixel must always be returned
    console.error(`[Tracking] Error recording open for ${emailJobId}:`, err);
  }

  // Always return the pixel regardless of DB success
  res.set({
    "Content-Type": "image/gif",
    "Content-Length": String(TRANSPARENT_GIF.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });
  res.status(200).end(TRANSPARENT_GIF);
};

/**
 * GET /track/click/:emailJobId?url=<encoded>
 *
 * Records a CLICK tracking event and redirects to the original URL.
 * Public endpoint — no authentication required.
 *
 * Edge cases:
 * - Missing url param: returns 400.
 * - Invalid emailJobId: still redirects to avoid dead links.
 * - Malformed url: redirects to "/" as fallback.
 */
export const handleClick = async (req: Request, res: Response): Promise<void> => {
  const emailJobId = req.params.emailJobId as string;
  const url = req.query.url as string | undefined;

  if (!url) {
    res.status(400).json({ message: "Missing url parameter" });
    return;
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    decodedUrl = url;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = (req.headers["user-agent"] as string) || null;

  // Record the click event
  try {
    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      select: { id: true },
    });

    if (emailJob) {
      await prisma.trackingEvent.create({
        data: {
          emailJobId,
          eventType: "CLICK",
          url: decodedUrl,
          ipAddress,
          userAgent,
        },
      });
    }
  } catch (err) {
    console.error(`[Tracking] Error recording click for ${emailJobId}:`, err);
  }

  // Always redirect — don't break the link even if DB fails
  res.redirect(302, decodedUrl || "/");
};
