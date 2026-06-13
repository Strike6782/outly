import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import {
  EmailProviderPreset,
  resolveProviderConfig,
} from "../config/fastmail";
import { encrypt } from "../utils/encryption";
import { detectProvider } from "../utils/providerProfile";
import { DEFAULT_WARMUP_DAILY_LIMITS, isInWarmup } from "../utils/warmupEvaluator";
import { getEffectiveLimits } from "../utils/throttleEngine";
import { getAdaptiveState } from "../utils/adaptiveThrottle";
import { getSentCountToday } from "../utils/dailyLimitTracker";
import { createSmtpTransporter } from "../utils/smtpTransport";

// ---------------------------------------------------------------------------
// WHY SMTP verify before save: Verifying credentials upfront prevents storing
// invalid SMTP configs that would silently fail at email-send time, wasting
// campaign jobs and confusing users.
//
// WHY encrypt at rest: App Passwords are sensitive credentials — storing them
// in plain text would expose them if the database is compromised.
//
// WHY per-user scoping: Data isolation ensures users can only access their own
// senders, preventing cross-account data leaks.
//
// WHY connection timeout: Prevents the API from hanging indefinitely when the
// SMTP server is unreachable (e.g., firewall, DNS failure).
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseProvider(value: unknown): EmailProviderPreset {
  return value === "fastmail" ? "fastmail" : "gmail";
}

function warmupLimitsForProvider(provider: EmailProviderPreset): number[] {
  const config = resolveProviderConfig(provider);
  return config.warmupDailyLimits.length > 0
    ? config.warmupDailyLimits
    : DEFAULT_WARMUP_DAILY_LIMITS;
}

export const createSender = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Require authenticated user
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const { name, email, appPassword, mailLoginEmail, provider: providerRaw } = req.body;
    const provider = parseProvider(providerRaw);
    const providerConfig = resolveProviderConfig(provider);
    const smtpLogin =
      typeof mailLoginEmail === "string" && mailLoginEmail.trim() !== ""
        ? mailLoginEmail.trim()
        : email.trim();

    // Validate all required fields are present and non-empty
    const missingFields: string[] = [];
    if (!name || (typeof name === "string" && name.trim() === "")) missingFields.push("name");
    if (!email || (typeof email === "string" && email.trim() === "")) missingFields.push("email");
    if (!appPassword || (typeof appPassword === "string" && appPassword.trim() === "")) missingFields.push("appPassword");

    if (missingFields.length > 0) {
      res.status(400).json({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
      return;
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email)) {
      res.status(400).json({ message: "Invalid email format" });
      return;
    }

    // Verify SMTP credentials before persisting the sender record
    const transporter = createSmtpTransporter({
      smtpHost: providerConfig.smtpHost,
      smtpPort: providerConfig.smtpPort,
      email,
      password: appPassword,
      loginEmail: smtpLogin,
    });

    try {
      await transporter.verify();
    } catch {
      res.status(400).json({
        message: "Invalid SMTP credentials. Please check your email and app password.",
      });
      return;
    }

    // Encrypt the app password before storing
    const encryptedPassword = encrypt(appPassword);

    const sender = await prisma.sender.create({
      data: {
        name,
        email,
        mailLoginEmail: smtpLogin !== email.trim() ? smtpLogin : null,
        appPassword: encryptedPassword,
        smtpHost: providerConfig.smtpHost,
        smtpPort: providerConfig.smtpPort,
        imapHost: providerConfig.imapHost,
        imapPort: providerConfig.imapPort,
        dailyLimit: providerConfig.dailyLimit,
        isVerified: true,
        userId: req.user.id,
      },
    });

    // Auto-detect provider from SMTP host and associate the profile
    const smtpHost = sender.smtpHost;
    const profile = await detectProvider(smtpHost);
    if (profile) {
      await prisma.sender.update({
        where: { id: sender.id },
        data: { providerProfileId: profile.id },
      });
      sender.providerProfileId = profile.id;
    }

    // Create WarmupSchedule for newly verified sender — same as verifySender().
    const optedOut = req.body.skipWarmup === true;
    await prisma.warmupSchedule.create({
      data: {
        senderId: sender.id,
        startDate: new Date(),
        durationDays: 14,
        dailyLimits: warmupLimitsForProvider(provider),
        isActive: true,
        optedOut,
      },
    });

    // Strip appPassword from the response — never expose encrypted credentials to the client
    const { appPassword: _, ...senderResponse } = sender;

    res.status(201).json(senderResponse);
  } catch (error: any) {
    // Handle unique constraint violation (duplicate sender email per user)
    if (error?.code === "P2002") {
      res.status(409).json({
        message: "A sender with this email already exists for your account",
      });
      return;
    }

    // Generic error — never expose stack traces to the client
    res.status(500).json({
      message: "An error occurred while creating the sender",
    });
  }
};
/**
 * PATCH /senders/:id/verify
 *
 * Updates an existing unverified sender with SMTP credentials.
 * WHY separate from createSender: OAuth-created senders already exist in the DB
 * but lack SMTP credentials. Users need a way to "verify" them without hitting
 * the unique constraint error that createSender would throw.
 */
export const verifySender = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const id = req.params.id as string;
    const { name, appPassword, mailLoginEmail, provider: providerRaw } = req.body;

    if (!appPassword || (typeof appPassword === "string" && appPassword.trim() === "")) {
      res.status(400).json({ message: "App password is required" });
      return;
    }

    // Verify the sender belongs to the authenticated user
    const existingSender = await prisma.sender.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingSender) {
      res.status(404).json({ message: "Sender not found" });
      return;
    }

    const provider = parseProvider(providerRaw);
    const providerConfig = resolveProviderConfig(provider);
    const smtpLogin =
      typeof mailLoginEmail === "string" && mailLoginEmail.trim() !== ""
        ? mailLoginEmail.trim()
        : existingSender.mailLoginEmail?.trim() || existingSender.email;

    // Test SMTP connection with the provided credentials
    const transporter = createSmtpTransporter({
      smtpHost: existingSender.smtpHost || providerConfig.smtpHost,
      smtpPort: existingSender.smtpPort || providerConfig.smtpPort,
      email: existingSender.email,
      password: appPassword,
      loginEmail: smtpLogin,
    });

    try {
      await transporter.verify();
    } catch {
      res.status(400).json({
        message: "Invalid SMTP credentials. Please check your app password.",
      });
      return;
    }

    // Encrypt and update the sender
    const encryptedPassword = encrypt(appPassword);

    const updatedSender = await prisma.sender.update({
      where: { id },
      data: {
        appPassword: encryptedPassword,
        isVerified: true,
        mailLoginEmail:
          smtpLogin !== existingSender.email ? smtpLogin : null,
        smtpHost: providerConfig.smtpHost,
        smtpPort: providerConfig.smtpPort,
        imapHost: providerConfig.imapHost,
        imapPort: providerConfig.imapPort,
        dailyLimit: providerConfig.dailyLimit,
        ...(name ? { name } : {}),
      },
    });

    // Auto-detect provider from SMTP host and associate the profile
    const smtpHost = updatedSender.smtpHost;
    const profile = await detectProvider(smtpHost);
    if (profile) {
      await prisma.sender.update({
        where: { id },
        data: { providerProfileId: profile.id },
      });
      updatedSender.providerProfileId = profile.id;
    }

    // Create WarmupSchedule when isVerified transitions to true
    if (!existingSender.isVerified) {
      const existingWarmup = await prisma.warmupSchedule.findUnique({
        where: { senderId: id },
      });

      if (!existingWarmup) {
        const optedOut = req.body.skipWarmup === true;
        await prisma.warmupSchedule.create({
          data: {
            senderId: id,
            startDate: new Date(),
            durationDays: 14,
            dailyLimits: warmupLimitsForProvider(provider),
            isActive: true,
            optedOut,
          },
        });
      }
    }

    const { appPassword: _, ...senderResponse } = updatedSender;
    res.status(200).json(senderResponse);
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while verifying the sender",
    });
  }
};

export const getSenders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const senders = await prisma.sender.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        smtpHost: true,
        smtpPort: true,
        isVerified: true,
        dailyLimit: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const sendersWithStats = await Promise.all(
      senders.map(async (sender) => {
        const currentDailyCount = await getSentCountToday(sender.id);
        return { ...sender, currentDailyCount };
      }),
    );

    res.status(200).json(sendersWithStats);
  } catch {
    res.status(500).json({
      message: "An error occurred while fetching senders",
    });
  }
};

export const getSenderEmails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const senders = await prisma.sender.findMany({
      where: { userId: req.user!.id },
      select: { email: true },
    });

    res.status(200).json(senders.map((sender) => sender.email));
  } catch {
    res.status(500).json({
      message: "An error occurred while fetching sender emails",
    });
  }
};

/**
 * PATCH /senders/:id — Update sender name, daily limit, or SMTP credentials.
 */
export const updateSender = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const id = req.params.id as string;
    const {
      name,
      dailyLimit,
      appPassword,
      mailLoginEmail,
      provider: providerRaw,
    } = req.body;

    const existingSender = await prisma.sender.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingSender) {
      res.status(404).json({ message: "Sender not found" });
      return;
    }

    const provider = parseProvider(providerRaw);
    const providerConfig = resolveProviderConfig(provider);
    const updateData: Record<string, unknown> = {};

    if (typeof name === "string" && name.trim() !== "") {
      updateData.name = name.trim();
    }

    if (dailyLimit !== undefined && dailyLimit !== null) {
      const limit = Number(dailyLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        res.status(400).json({ message: "Daily limit must be a positive integer" });
        return;
      }
      updateData.dailyLimit = limit;
    }

    if (appPassword && typeof appPassword === "string" && appPassword.trim() !== "") {
      const smtpLogin =
        typeof mailLoginEmail === "string" && mailLoginEmail.trim() !== ""
          ? mailLoginEmail.trim()
          : existingSender.mailLoginEmail?.trim() || existingSender.email;

      const transporter = createSmtpTransporter({
        smtpHost: existingSender.smtpHost || providerConfig.smtpHost,
        smtpPort: existingSender.smtpPort || providerConfig.smtpPort,
        email: existingSender.email,
        password: appPassword,
        loginEmail: smtpLogin,
      });

      try {
        await transporter.verify();
      } catch {
        res.status(400).json({
          message: "Invalid SMTP credentials. Please check your app password.",
        });
        return;
      }

      updateData.appPassword = encrypt(appPassword);
      updateData.isVerified = true;
      updateData.mailLoginEmail =
        smtpLogin !== existingSender.email ? smtpLogin : null;
      updateData.smtpHost = providerConfig.smtpHost;
      updateData.smtpPort = providerConfig.smtpPort;
      updateData.imapHost = providerConfig.imapHost;
      updateData.imapPort = providerConfig.imapPort;
    } else if (
      typeof mailLoginEmail === "string" &&
      mailLoginEmail.trim() !== "" &&
      mailLoginEmail.trim() !== existingSender.email
    ) {
      updateData.mailLoginEmail = mailLoginEmail.trim();
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: "No valid fields to update" });
      return;
    }

    const updatedSender = await prisma.sender.update({
      where: { id },
      data: updateData,
    });

    if (updateData.smtpHost) {
      const profile = await detectProvider(updatedSender.smtpHost);
      if (profile) {
        await prisma.sender.update({
          where: { id },
          data: { providerProfileId: profile.id },
        });
        updatedSender.providerProfileId = profile.id;
      }
    }

    const { appPassword: _, ...senderResponse } = updatedSender;
    res.status(200).json(senderResponse);
  } catch {
    res.status(500).json({
      message: "An error occurred while updating the sender",
    });
  }
};

/**
 * DELETE /senders/:id — Remove a sender and unlink it from campaigns/jobs.
 */
export const deleteSender = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const id = req.params.id as string;

    const existingSender = await prisma.sender.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existingSender) {
      res.status(404).json({ message: "Sender not found" });
      return;
    }

    await prisma.$transaction([
      prisma.rateLimitCounter.deleteMany({ where: { senderId: id } }),
      prisma.campaignSender.deleteMany({ where: { senderId: id } }),
      prisma.warmupSchedule.deleteMany({ where: { senderId: id } }),
      prisma.senderCooldown.deleteMany({ where: { senderId: id } }),
      prisma.emailCampaign.updateMany({
        where: { senderId: id },
        data: { senderId: null },
      }),
      prisma.emailJob.updateMany({
        where: { senderId: id },
        data: { senderId: null },
      }),
      prisma.sender.delete({ where: { id } }),
    ]);

    res.sendStatus(204);
  } catch {
    res.status(500).json({
      message: "An error occurred while deleting the sender",
    });
  }
};

/**
 * GET /senders/:id — Get sender detail with throttle information.
 * Includes current hourly count, daily count, daily limit, warmup status,
 * and active cooldown state.
 */
export const getSenderById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const id = req.params.id as string;

    const sender = await prisma.sender.findFirst({
      where: { id, userId: req.user.id },
      select: {
        id: true,
        userId: true,
        email: true,
        name: true,
        smtpHost: true,
        smtpPort: true,
        isVerified: true,
        dailyLimit: true,
        hourlyLimit: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!sender) {
      res.status(404).json({ message: "Sender not found" });
      return;
    }

    // Compute throttle details
    const now = new Date();
    const hourWindow = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0)
    );
    const hourlyAggregate = await prisma.rateLimitCounter.aggregate({
      where: { senderId: id, hourWindow },
      _sum: { count: true },
    });
    const currentHourlyCount = hourlyAggregate._sum.count ?? 0;

    const dailyCount = await getSentCountToday(id);
    const warmupActive = await isInWarmup(id);
    const adaptiveState = await getAdaptiveState(id);
    const limits = await getEffectiveLimits(id);

    // Determine warmup status
    const warmupSchedule = await prisma.warmupSchedule.findUnique({
      where: { senderId: id },
    });
    let warmupStatus: string;
    if (warmupSchedule?.optedOut) {
      warmupStatus = "opted-out";
    } else if (warmupActive) {
      warmupStatus = "active";
    } else {
      warmupStatus = "inactive";
    }

    res.status(200).json({
      ...sender,
      currentHourlyCount,
      currentDailyCount: dailyCount,
      effectiveDailyLimit: limits.perDay,
      warmupStatus,
      cooldownState: {
        status: adaptiveState.isCooldown ? "active" : "inactive",
        expiresAt: adaptiveState.cooldownExpiresAt ?? null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: "An error occurred while fetching sender",
    });
  }
};
