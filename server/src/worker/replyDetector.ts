import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "../config/prisma";
import { decrypt } from "../utils/encryption";
import { markRecipientReplied } from "../utils/markReplied";

/** Extract the bare email address from a From header value. */
function parseEmailAddress(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/<([^>]+)>/) ?? raw.match(/([^\s<>]+@[^\s<>]+)/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

/**
 * Poll a sender's Fastmail (or other IMAP) inbox for prospect replies.
 * Matches by In-Reply-To header or by sender address on active campaigns.
 */
export async function detectRepliesForSender(sender: {
  id: string;
  email: string;
  mailLoginEmail?: string | null;
  appPassword: string;
  imapHost: string;
  imapPort: number;
  lastImapUid: bigint | null;
}): Promise<void> {
  let password: string;
  try {
    password = decrypt(sender.appPassword);
  } catch {
    console.warn(`[ReplyDetector] Cannot decrypt credentials for ${sender.email}`);
    return;
  }

  const imapUser = sender.mailLoginEmail?.trim() || sender.email;

  const client = new ImapFlow({
    host: sender.imapHost,
    port: sender.imapPort,
    secure: true,
    auth: {
      user: imapUser,
      pass: password,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchQuery =
        sender.lastImapUid != null
          ? { uid: `${Number(sender.lastImapUid) + 1}:*` }
          : { seen: false };

      const uids = await client.search(searchQuery, { uid: true });
      if (!uids || uids.length === 0) return;

      let maxUid = sender.lastImapUid ?? BigInt(0);

      for (const uid of uids) {
        const uidNum = typeof uid === "number" ? uid : Number(uid);
        if (BigInt(uidNum) > maxUid) maxUid = BigInt(uidNum);

        const message = await client.fetchOne(uid, { source: true }, { uid: true });
        if (!message || !message.source) continue;

        const parsed = await simpleParser(message.source);
        const fromEmail = parseEmailAddress(parsed.from?.text);
        if (!fromEmail || fromEmail === sender.email.toLowerCase()) continue;

        const inReplyTo = parsed.inReplyTo?.toLowerCase() ?? null;

        const sentJobs = await prisma.emailJob.findMany({
          where: {
            senderId: sender.id,
            status: "SENT",
            isReplied: false,
          },
          select: {
            id: true,
            campaignId: true,
            toEmail: true,
            smtpMessageId: true,
          },
        });

        for (const job of sentJobs) {
          const prospectEmail = job.toEmail.toLowerCase();
          const headerMatch =
            inReplyTo != null &&
            job.smtpMessageId != null &&
            inReplyTo.includes(job.smtpMessageId.toLowerCase());
          const addressMatch = fromEmail === prospectEmail;

          if (headerMatch || addressMatch) {
            await markRecipientReplied(job.campaignId, job.toEmail);
          }
        }
      }

      if (maxUid > (sender.lastImapUid ?? BigInt(0))) {
        await prisma.sender.update({
          where: { id: sender.id },
          data: { lastImapUid: maxUid },
        });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error(`[ReplyDetector] IMAP error for ${sender.email}:`, err);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/** Poll all verified senders that have IMAP configured. */
export async function runReplyDetection(): Promise<void> {
  const senders = await prisma.sender.findMany({
    where: {
      isVerified: true,
      appPassword: { not: "" },
    },
    select: {
      id: true,
      email: true,
      mailLoginEmail: true,
      appPassword: true,
      imapHost: true,
      imapPort: true,
      lastImapUid: true,
    },
  });

  for (const sender of senders) {
    await detectRepliesForSender(sender);
  }
}
