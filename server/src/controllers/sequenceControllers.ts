import { Request, Response } from "express";
import { prisma } from "../config/prisma";

// ---------------------------------------------------------------------------
// Helper: Verify campaign exists and is owned by the authenticated user.
// Returns the campaign or sends an error response and returns null.
// ---------------------------------------------------------------------------
async function verifyCampaignOwnership(
  req: Request,
  res: Response
): Promise<{ id: string } | null> {
  const campaignId = req.params.id as string;
  const userId = req.user!.id;

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: { id: true, userId: true },
  });

  if (!campaign) {
    res.status(404).json({ message: "Campaign not found" });
    return null;
  }

  if (campaign.userId !== userId) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }

  return campaign;
}

/**
 * GET /api/campaigns/:id/sequence
 * Returns SequenceSteps and RecipientSequenceStates for a campaign.
 * For single-step campaigns (no steps), returns empty arrays with a flag.
 */
export const getSequence = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const steps = await prisma.sequenceStep.findMany({
      where: { campaignId: campaign.id },
      orderBy: { stepNumber: "asc" },
    });

    const recipients = await prisma.recipientSequenceState.findMany({
      where: { campaignId: campaign.id },
      orderBy: { recipientEmail: "asc" },
    });

    res.status(200).json({
      steps,
      recipients,
      hasSequence: steps.length > 0,
    });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};


/**
 * PATCH /api/campaigns/:id/sequence/recipients/:recipientId/pause
 * Sets paused=true on a specific RecipientSequenceState.
 */
export const pauseRecipient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const recipientId = req.params.recipientId as string;

    const state = await prisma.recipientSequenceState.findUnique({
      where: { id: recipientId },
    });

    if (!state || state.campaignId !== campaign.id) {
      res.status(404).json({ message: "Recipient not found in sequence" });
      return;
    }

    const updated = await prisma.recipientSequenceState.update({
      where: { id: recipientId },
      data: { paused: true },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};

/**
 * PATCH /api/campaigns/:id/sequence/recipients/:recipientId/resume
 * Sets paused=false on a specific RecipientSequenceState.
 */
export const resumeRecipient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const recipientId = req.params.recipientId as string;

    const state = await prisma.recipientSequenceState.findUnique({
      where: { id: recipientId },
    });

    if (!state || state.campaignId !== campaign.id) {
      res.status(404).json({ message: "Recipient not found in sequence" });
      return;
    }

    const updated = await prisma.recipientSequenceState.update({
      where: { id: recipientId },
      data: { paused: false },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};

/**
 * PATCH /api/campaigns/:id/sequence/recipients/:recipientId/stop
 * Sets all remaining (non-SENT, non-FAILED) step statuses to SKIPPED.
 */
export const stopRecipient = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const recipientId = req.params.recipientId as string;

    const state = await prisma.recipientSequenceState.findUnique({
      where: { id: recipientId },
    });

    if (!state || state.campaignId !== campaign.id) {
      res.status(404).json({ message: "Recipient not found in sequence" });
      return;
    }

    const stepStatuses = state.stepStatuses as Array<{
      stepNumber: number;
      status: string;
      sentAt: string | null;
      error: string | null;
      emailJobId: string | null;
    }>;

    const updatedStatuses = stepStatuses.map((s) => {
      if (s.status !== "SENT" && s.status !== "FAILED") {
        return { ...s, status: "SKIPPED" };
      }
      return s;
    });

    const updated = await prisma.recipientSequenceState.update({
      where: { id: recipientId },
      data: { stepStatuses: updatedStatuses },
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};


/**
 * PATCH /api/campaigns/:id/sequence/pause
 * Sets paused=true on ALL RecipientSequenceStates for the campaign.
 */
export const pauseSequence = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const result = await prisma.recipientSequenceState.updateMany({
      where: { campaignId: campaign.id },
      data: { paused: true },
    });

    res.status(200).json({ message: "Sequence paused", count: result.count });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};

/**
 * PATCH /api/campaigns/:id/sequence/resume
 * Sets paused=false on ALL RecipientSequenceStates for the campaign.
 */
export const resumeSequence = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const result = await prisma.recipientSequenceState.updateMany({
      where: { campaignId: campaign.id },
      data: { paused: false },
    });

    res.status(200).json({ message: "Sequence resumed", count: result.count });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};

/**
 * PATCH /api/campaigns/:id/sequence/stop
 * Sets remaining (non-SENT, non-FAILED) step statuses to SKIPPED for ALL recipients.
 * Does not cancel or retract already SENDING/SENT EmailJobs.
 */
export const stopSequence = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const campaign = await verifyCampaignOwnership(req, res);
    if (!campaign) return;

    const states = await prisma.recipientSequenceState.findMany({
      where: { campaignId: campaign.id },
    });

    let updatedCount = 0;

    for (const state of states) {
      const stepStatuses = state.stepStatuses as Array<{
        stepNumber: number;
        status: string;
        sentAt: string | null;
        error: string | null;
        emailJobId: string | null;
      }>;

      const hasRemaining = stepStatuses.some(
        (s) => s.status !== "SENT" && s.status !== "FAILED"
      );

      if (!hasRemaining) continue;

      const updatedStatuses = stepStatuses.map((s) => {
        if (s.status !== "SENT" && s.status !== "FAILED") {
          return { ...s, status: "SKIPPED" };
        }
        return s;
      });

      await prisma.recipientSequenceState.update({
        where: { id: state.id },
        data: { stepStatuses: updatedStatuses },
      });

      updatedCount++;
    }

    res.status(200).json({ message: "Sequence stopped", count: updatedCount });
  } catch (error) {
    res.status(500).json({ message: "An error occurred" });
  }
};
