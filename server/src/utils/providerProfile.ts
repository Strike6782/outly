import { prisma } from "../config/prisma";

const DEFAULT_LIMITS = {
  perMinute: 10,
  perHour: 100,
  perDay: 500,
};

/**
 * Detects the provider profile for a given SMTP host.
 * Matches against known `smtpHostPattern` values in the ProviderProfile table.
 * Returns the "Default" profile (smtpHostPattern = "*") if no exact match is found.
 */
export async function detectProvider(smtpHost: string) {
  const exactMatch = await prisma.providerProfile.findFirst({
    where: {
      smtpHostPattern: smtpHost,
    },
  });

  if (exactMatch) {
    return exactMatch;
  }

  // Fall back to the "Default" profile (wildcard pattern)
  const defaultProfile = await prisma.providerProfile.findFirst({
    where: {
      smtpHostPattern: "*",
    },
  });

  if (!defaultProfile) {
    console.warn(
      `No provider profile found for SMTP host "${smtpHost}" and no Default ("*") profile exists. ` +
        "Falling back to hardcoded defaults. Ensure the ProviderProfile seed data is present."
    );
  }

  return defaultProfile;
}

/**
 * Fetches the sender's associated provider profile and returns
 * per-minute, per-hour, and per-day limits.
 * Falls back to default limits if the sender has no provider profile.
 */
export async function getEffectiveProviderLimits(
  senderId: string
): Promise<{ perMinute: number; perHour: number; perDay: number }> {
  const sender = await prisma.sender.findUnique({
    where: { id: senderId },
    include: { providerProfile: true },
  });

  if (!sender?.providerProfile) {
    return DEFAULT_LIMITS;
  }

  const { perMinuteLimit, perHourLimit, perDayLimit } = sender.providerProfile;

  return {
    perMinute: perMinuteLimit,
    perHour: perHourLimit,
    perDay: perDayLimit,
  };
}
