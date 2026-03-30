import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/emailQueue";

/**
 * Sequence Scheduler — runs on a recurring interval to evaluate which recipients
 * are due for their next follow-up step and enqueues the corresponding email jobs.
 */
export async function processSchedulerJob(): Promise<void> {
  console.log("[SequenceScheduler] Running scheduler tick...");

  // Find all campaigns that have sequence steps
  const campaigns = await prisma.emailCampaign.findMany({
    where: {
      sequenceSteps: { some: {} },
      status: { in: ["SCHEDULED", "SENDING"] },
    },
    select: {
      id: true,
      senderId: true,
      delaySeconds: true,
      sequenceSteps: { orderBy: { stepNumber: "asc" } },
      campaignSenders: {
        orderBy: { rotationOrder: "asc" },
        select: { senderId: true, rotationOrder: true },
      },
    },
  });

  for (const campaign of campaigns) {
    const totalSteps = campaign.sequenceSteps.length;

    // Find recipients due for next step
    const recipients = await prisma.recipientSequenceState.findMany({
      where: {
        campaignId: campaign.id,
        completed: false,
        paused: false,
        replied: false,
      },
    });

    for (const recipient of recipients) {
      try {
        const statuses = recipient.stepStatuses as any[];
        const currentStatus = statuses[recipient.currentStep];

        // Current step must be SENT before we advance
        if (!currentStatus || currentStatus.status !== "SENT") continue;

        const nextStepNumber = recipient.currentStep + 1;

        // Check if this is the last step — mark completed
        if (nextStepNumber >= totalSteps) {
          await prisma.recipientSequenceState.update({
            where: { id: recipient.id },
            data: { completed: true },
          });
          continue;
        }

        const nextStep = campaign.sequenceSteps.find((s) => s.stepNumber === nextStepNumber);
        if (!nextStep) continue;

        // Check if wait period has elapsed
        const sentAt = new Date(currentStatus.sentAt);
        const dueAt = new Date(sentAt.getTime() + nextStep.waitDays * 24 * 60 * 60 * 1000);
        if (new Date() < dueAt) continue;

        // Atomic claim: advance currentStep and set status to SCHEDULED
        // Only succeeds if currentStep hasn't changed (prevents duplicate jobs)
        const claimResult = await prisma.recipientSequenceState.updateMany({
          where: {
            id: recipient.id,
            currentStep: recipient.currentStep,
          },
          data: { currentStep: nextStepNumber },
        });

        if (claimResult.count === 0) {
          // Another scheduler instance already handled this recipient
          continue;
        }

        // Update step status to SCHEDULED
        const updatedStatuses = [...statuses];
        updatedStatuses[nextStepNumber] = {
          ...updatedStatuses[nextStepNumber],
          status: "SCHEDULED",
        };
        await prisma.recipientSequenceState.update({
          where: { id: recipient.id },
          data: { stepStatuses: updatedStatuses },
        });

        // Create EmailJob for the next step.
        // Assign a sender from the pool via round-robin, falling back to the
        // campaign's legacy senderId for campaigns without a sender pool.
        const poolSenders = campaign.campaignSenders;
        const assignedSenderId = poolSenders.length > 0
          ? poolSenders[nextStepNumber % poolSenders.length].senderId
          : campaign.senderId;

        // Retrieve columnData from the original (step 0) email job for this recipient
        // so follow-up sequence emails can resolve template variables too.
        const originalJob = await prisma.emailJob.findFirst({
          where: { campaignId: campaign.id, toEmail: recipient.recipientEmail, columnData: { not: Prisma.DbNull } },
          select: { columnData: true },
          orderBy: { createdAt: "asc" },
        });

        const emailJob = await prisma.emailJob.create({
          data: {
            campaignId: campaign.id,
            toEmail: recipient.recipientEmail,
            scheduledAt: new Date(),
            sequenceStepId: nextStep.id,
            ...(assignedSenderId ? { senderId: assignedSenderId } : {}),
            ...(originalJob?.columnData ? { columnData: originalJob.columnData } : {}),
          },
        });

        // Update step status with emailJobId
        updatedStatuses[nextStepNumber].emailJobId = emailJob.id;
        await prisma.recipientSequenceState.update({
          where: { id: recipient.id },
          data: { stepStatuses: updatedStatuses },
        });

        // Enqueue into BullMQ
        await emailQueue.add(
          "send-email",
          { emailJobId: emailJob.id },
          { jobId: `${emailJob.id}-${crypto.randomUUID()}`, delay: 0 }
        );

        console.log(
          `[SequenceScheduler] Enqueued step ${nextStepNumber} for ${recipient.recipientEmail} in campaign ${campaign.id}`
        );
      } catch (err) {
        console.error(
          `[SequenceScheduler] Error processing recipient ${recipient.recipientEmail}:`,
          err
        );
        // Continue to next recipient — retry on next scheduler run
      }
    }
    
    // Check if the overall campaign is complete.
    // A sequence campaign is complete when all recipients have completed the sequence
    // (completed: true) OR have reached a terminal state (paused/replied/etc),
    // AND there are no non-terminal EmailJobs left for this campaign.
    try {
      const activeStatesCount = await prisma.recipientSequenceState.count({
        where: {
          campaignId: campaign.id,
          completed: false,
          paused: false,
          replied: false,
        },
      });

      const nonTerminalJobsCount = await prisma.emailJob.count({
        where: {
          campaignId: campaign.id,
          status: { notIn: ["SENT", "FAILED", "CANCELLED"] },
        },
      });

      if (activeStatesCount === 0 && nonTerminalJobsCount === 0) {
        await prisma.emailCampaign.updateMany({
          where: { id: campaign.id, status: "SENDING" },
          data: { status: "COMPLETED" },
        });
        console.log(`[SequenceScheduler] Campaign ${campaign.id} marked as COMPLETED`);
      }
    } catch (err) {
      console.error(`[SequenceScheduler] Error checking completion for campaign ${campaign.id}:`, err);
    }
  }

  console.log("[SequenceScheduler] Scheduler tick complete.");
}
