type CampaignStatus = "SCHEDULED" | "SENDING" | "PAUSED" | "CANCELLED" | "COMPLETED";

const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  SCHEDULED: ["SENDING", "PAUSED", "CANCELLED"],
  SENDING: ["PAUSED", "CANCELLED", "COMPLETED"],
  PAUSED: ["SENDING", "CANCELLED", "COMPLETED"],
  CANCELLED: [],
  COMPLETED: [],
};

export function isValidTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as CampaignStatus];
  if (!allowed) return false;
  return allowed.includes(to as CampaignStatus);
}

export function getValidTransitions(from: string): string[] {
  return ALLOWED_TRANSITIONS[from as CampaignStatus] ?? [];
}

type EmailStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

const TERMINAL_STATUSES: Set<string> = new Set(["SENT", "FAILED", "CANCELLED"]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
