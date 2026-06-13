import { prisma } from "../config/prisma";

/**
 * Mark a campaign recipient as replied and cancel any pending follow-up jobs.
 * Used by the manual API toggle and the automatic IMAP reply detector.
 */
export async function markRecipientReplied(
  campaignId: string,
  recipientEmail: string,
): Promise<void> {
  const normalizedEmail = recipientEmail.toLowerCase();

  await prisma.emailJob.updateMany({
    where: {
      campaignId,
      toEmail: { equals: recipientEmail, mode: "insensitive" },
      status: "SENT",
      isReplied: false,
    },
    data: { isReplied: true },
  });

  await prisma.recipientSequenceState.updateMany({
    where: {
      campaignId,
      recipientEmail: { equals: recipientEmail, mode: "insensitive" },
    },
    data: { replied: true },
  });

  await prisma.emailJob.updateMany({
    where: {
      campaignId,
      toEmail: { equals: recipientEmail, mode: "insensitive" },
      status: { in: ["PENDING", "SENDING"] },
    },
    data: { status: "CANCELLED" },
  });

  console.log(
    `[ReplyDetector] Marked ${normalizedEmail} as replied in campaign ${campaignId}`,
  );
}
