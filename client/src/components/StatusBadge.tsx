"use client";

import { cn } from "@/lib/utils";
import { Clock, Send, Pause, XCircle, CheckCircle2, Ban } from "lucide-react";

type CampaignStatus = "SCHEDULED" | "SENDING" | "PAUSED" | "CANCELLED" | "COMPLETED";

interface StatusBadgeProps {
  status: CampaignStatus;
  size?: "sm" | "md";
  pauseReason?: string | null;
}

const STATUS_CONFIG: Record<CampaignStatus, {
  label: string;
  bg: string;
  text: string;
  icon: React.ElementType;
}> = {
  SCHEDULED: { label: "Scheduled", bg: "bg-amber-50", text: "text-amber-600", icon: Clock },
  SENDING: { label: "Sending", bg: "bg-blue-50", text: "text-blue-600", icon: Send },
  PAUSED: { label: "Paused", bg: "bg-gray-100", text: "text-gray-600", icon: Pause },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50", text: "text-red-500", icon: Ban },
  COMPLETED: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-600", icon: CheckCircle2 },
};

const PAUSE_REASON_LABELS: Record<string, string> = {
  ALL_SENDERS_EXHAUSTED: "All senders at limit",
};

export default function StatusBadge({ status, size = "sm", pauseReason }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = config.icon;
  const reasonLabel = status === "PAUSED" && pauseReason
    ? PAUSE_REASON_LABELS[pauseReason] ?? pauseReason
    : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg font-semibold transition-colors",
        config.bg,
        config.text,
        size === "sm" && "px-2.5 py-1 text-[11px]",
        size === "md" && "px-3 py-1.5 text-xs"
      )}
      title={reasonLabel ?? undefined}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {config.label}
      {reasonLabel && (
        <span className="font-normal opacity-75">· {reasonLabel}</span>
      )}
    </span>
  );
}
