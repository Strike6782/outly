"use client";

import { cn, formatTime, formatRelativeTime, stripHtml, resolveVariables } from "@/lib/utils";
import { EmailRowProps } from "@/types";
import { Check, XCircle, Clock, Star, Ban } from "lucide-react";
import MatchHighlighter from "./MatchHighlighter";

type EmailStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

const statusConfig: Record<EmailStatus, { bg: string; text: string; icon: typeof Clock; label: string }> = {
  PENDING: { bg: "bg-amber-50/60", text: "text-amber-600", icon: Clock, label: "Scheduled" },
  SENDING: { bg: "bg-blue-50/60", text: "text-blue-600", icon: Clock, label: "Sending" },
  SENT: { bg: "bg-emerald-50/60", text: "text-emerald-600", icon: Check, label: "Sent" },
  FAILED: { bg: "bg-red-50/60", text: "text-red-500", icon: XCircle, label: "Failed" },
  CANCELLED: { bg: "bg-gray-50/80", text: "text-gray-500", icon: Ban, label: "Cancelled" },
};

function EmailStatusBadge({ status, time }: { status?: string; time?: string }) {
  const normalizedStatus = (status?.toUpperCase() ?? "PENDING") as EmailStatus;
  const config = statusConfig[normalizedStatus] ?? statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-transparent", config.bg, "group-hover:border-current/5")}>
      {(normalizedStatus === "SENDING" || normalizedStatus === "PENDING") && (
        <div className={cn("h-1 w-1 rounded-full animate-pulse", config.text.replace('text-', 'bg-'))} />
      )}
      <Icon className={cn("h-3 w-3", config.text)} />
      <span className={cn("text-[10px] font-bold uppercase tracking-wide", config.text)}>
        {time ? formatTime(time) : config.label}
      </span>
    </div>
  );
}

export function EmailRow({ email, campaign, onToggleStar, searchQuery = "" }: EmailRowProps) {
  const colData = (email as any)?.columnData ?? {};
  const recipientEmail = email?.toEmail ?? "";
  
  const resolvedSubject = resolveVariables(campaign?.subject ?? "", colData, { email: recipientEmail });
  const resolvedBody = resolveVariables(campaign?.body ?? "", colData, { email: recipientEmail });
  
  const plainPreview = resolvedBody ? stripHtml(resolvedBody).slice(0, 80) : "";
  const timeValue = email?.status === "SENT" ? email?.sentAt : email?.scheduledAt;

  return (
    <div className="group flex items-center gap-6 px-6 py-3.5 border-b border-gray-50/50 hover:bg-gray-50/80 transition-all duration-200 cursor-pointer">
      {/* 1. Recipient Leading Info */}
      <div className="flex items-center gap-3 w-1/4 shrink-0 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-gray-500">
            {email?.toEmail?.charAt(0)?.toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-normal text-gray-600 truncate tracking-tight">
            <MatchHighlighter text={email?.toEmail ?? ""} query={searchQuery} />
          </p>
        </div>
      </div>

      {/* 2. Status Column */}
      <div className="w-32 shrink-0">
        <EmailStatusBadge status={email?.status} time={timeValue ?? undefined} />
      </div>

      {/* 3. Subject & Preview Area */}
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span className="text-sm font-normal text-gray-500 truncate shrink-0 max-w-[40%]">
          <MatchHighlighter text={resolvedSubject} query={searchQuery} />
        </span>
        <span className="text-[11px] text-gray-400/80 truncate font-normal">— {plainPreview}</span>
      </div>

      {/* 4. Actions Area */}
      <div className="shrink-0 flex items-center gap-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (email?.id && onToggleStar) onToggleStar(email.id);
          }}
          className="p-2 rounded-xl hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all group/star"
          aria-label={email?.isStarred ? "Unstar email" : "Star email"}
        >
          <Star
            className={cn(
              "h-4 w-4 transition-all duration-300",
              email?.isStarred
                ? "fill-amber-400 text-amber-400"
                : "text-gray-300 group-hover/star:text-gray-500",
            )}
          />
        </button>
      </div>
    </div>
  );
}
