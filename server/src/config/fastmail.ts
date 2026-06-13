/**
 * Fastmail SMTP/IMAP defaults for custom-domain senders.
 * Credentials use a Fastmail app-specific password (not the account password).
 */
export const FASTMAIL_SMTP_HOST = "smtp.fastmail.com";
export const FASTMAIL_SMTP_PORT = 587;
export const FASTMAIL_IMAP_HOST = "imap.fastmail.com";
export const FASTMAIL_IMAP_PORT = 993;

/** Conservative daily limits for cold outreach on Fastmail (see ToS). */
export const FASTMAIL_DAILY_LIMIT = 25;

/** 14-day warmup ramp for new Fastmail senders (emails per day). */
export const FASTMAIL_WARMUP_DAILY_LIMITS = [
  5, 8, 10, 12, 15, 17, 19, 21, 23, 25, 25, 25, 25, 25,
];

export type EmailProviderPreset = "gmail" | "fastmail";

export interface SmtpImapConfig {
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  dailyLimit: number;
  warmupDailyLimits: number[];
}

/** Resolve SMTP/IMAP settings from the provider preset sent by the client. */
export function resolveProviderConfig(
  provider: EmailProviderPreset = "gmail",
): SmtpImapConfig {
  if (provider === "fastmail") {
    return {
      smtpHost: FASTMAIL_SMTP_HOST,
      smtpPort: FASTMAIL_SMTP_PORT,
      imapHost: FASTMAIL_IMAP_HOST,
      imapPort: FASTMAIL_IMAP_PORT,
      dailyLimit: FASTMAIL_DAILY_LIMIT,
      warmupDailyLimits: FASTMAIL_WARMUP_DAILY_LIMITS,
    };
  }

  return {
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    dailyLimit: 500,
    warmupDailyLimits: [],
  };
}
