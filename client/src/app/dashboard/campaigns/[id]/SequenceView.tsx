"use client";

import { useEffect, useState, useCallback } from "react";
import { getSequence, pauseRecipientSequence, resumeRecipientSequence, stopRecipientSequence, pauseAllSequence, resumeAllSequence, stopAllSequence } from "@/lib/apis";
import type { SequenceResponse, RecipientSequenceStateType, StepStatusType } from "@/types";
import Button from "@/components/Button";
import { Pause, Play, Square, ChevronDown, CheckCircle2, Clock, XCircle, AlertCircle, SkipForward, Loader2, MessageSquare, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface SequenceViewProps {
  campaignId: string;
}

const STEP_STATUS_STYLES: Record<string, string> = {
  PENDING: "text-gray-500 bg-gray-100",
  SCHEDULED: "text-blue-600 bg-blue-50",
  SENT: "text-emerald-600 bg-emerald-50",
  FAILED: "text-red-500 bg-red-50",
  SKIPPED: "text-gray-400 bg-gray-50",
};

const STEP_STATUS_ICONS: Record<string, React.ElementType> = {
  PENDING: Clock,
  SCHEDULED: Clock,
  SENT: CheckCircle2,
  FAILED: XCircle,
  SKIPPED: SkipForward,
};

export default function SequenceView({ campaignId }: SequenceViewProps) {
  const [data, setData] = useState<SequenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getSequence(campaignId);
      setData(res);
    } catch {
      setError("Failed to load sequence data.");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRecipientAction = async (recipientId: string, action: "pause" | "resume" | "stop") => {
    setActionLoading(`${recipientId}-${action}`);
    try {
      if (action === "pause") await pauseRecipientSequence(campaignId, recipientId);
      else if (action === "resume") await resumeRecipientSequence(campaignId, recipientId);
      else await stopRecipientSequence(campaignId, recipientId);
      await fetchData();
    } catch {} finally { setActionLoading(null); }
  };

  const handleBulkAction = async (action: "pause" | "resume" | "stop") => {
    setActionLoading(`bulk-${action}`);
    try {
      if (action === "pause") await pauseAllSequence(campaignId);
      else if (action === "resume") await resumeAllSequence(campaignId);
      else await stopAllSequence(campaignId);
      await fetchData();
    } catch {} finally { setActionLoading(null); }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)) : "—";

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-gray-100 p-4 animate-pulse">
            <div className="h-4 w-1/3 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-1/4 bg-gray-50 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="h-8 w-8 text-red-300" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={fetchData} className="text-sm text-primary hover:underline">Retry</button>
      </div>
    );
  }

  if (!data || !data.hasSequence) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
          <Mail className="h-7 w-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">No follow-up sequence configured</p>
        <p className="text-xs text-gray-400 mt-1">This campaign sends a single email per recipient.</p>
      </div>
    );
  }

  const totalSteps = data.steps.length;

  return (
    <div className="space-y-4">
      {/* Bulk controls */}
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="w-auto px-3 py-1.5 rounded-lg text-[11px] gap-1"
          onClick={() => handleBulkAction("pause")} disabled={!!actionLoading}>
          <Pause className="h-3 w-3" /> Pause All
        </Button>
        <Button variant="secondary" className="w-auto px-3 py-1.5 rounded-lg text-[11px] gap-1"
          onClick={() => handleBulkAction("resume")} disabled={!!actionLoading}>
          <Play className="h-3 w-3" /> Resume All
        </Button>
        <Button variant="secondary" className="w-auto px-3 py-1.5 rounded-lg text-[11px] gap-1"
          onClick={() => handleBulkAction("stop")} disabled={!!actionLoading}>
          <Square className="h-3 w-3" /> Stop All
        </Button>
      </div>

      {/* Recipient list */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {data.recipients.map((recipient, index) => (
            <div
              key={recipient.id}
              className="opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Recipient row */}
              <div
                className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setExpandedRecipient(expandedRecipient === recipient.id ? null : recipient.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{recipient.recipientEmail}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400">
                      Step {recipient.currentStep + 1} of {totalSteps}
                    </span>
                    {recipient.paused && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
                        <Pause className="h-2 w-2" /> Paused
                      </span>
                    )}
                    {recipient.replied && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600">
                        <MessageSquare className="h-2 w-2" /> Replied
                      </span>
                    )}
                    {recipient.completed && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                        <CheckCircle2 className="h-2 w-2" /> Done
                      </span>
                    )}
                  </div>
                </div>

                {/* Inline controls */}
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {!recipient.completed && (
                    <>
                      {recipient.paused ? (
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary-light transition-colors"
                          onClick={() => handleRecipientAction(recipient.id, "resume")}
                          disabled={!!actionLoading}>
                          <Play className="h-3 w-3" />
                        </button>
                      ) : (
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          onClick={() => handleRecipientAction(recipient.id, "pause")}
                          disabled={!!actionLoading}>
                          <Pause className="h-3 w-3" />
                        </button>
                      )}
                      <button className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => handleRecipientAction(recipient.id, "stop")}
                        disabled={!!actionLoading}>
                        <Square className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>

                <ChevronDown className={cn(
                  "h-3.5 w-3.5 text-gray-300 transition-transform duration-200",
                  expandedRecipient === recipient.id && "rotate-180"
                )} />
              </div>

              {/* Expanded step history */}
              <div className={cn(
                "overflow-hidden transition-all duration-200 ease-out",
                expandedRecipient === recipient.id ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              )}>
                <div className="px-5 pb-3 space-y-1.5">
                  {recipient.stepStatuses.map((step: StepStatusType) => {
                    const Icon = STEP_STATUS_ICONS[step.status] ?? Clock;
                    return (
                      <div key={step.stepNumber} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/50">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", STEP_STATUS_STYLES[step.status])}>
                          <Icon className="h-2.5 w-2.5" />
                          {step.status}
                        </span>
                        <span className="text-[11px] text-gray-500 flex-1">
                          Step {step.stepNumber + 1}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {step.sentAt ? formatDate(step.sentAt) : "—"}
                        </span>
                        {step.error && (
                          <span className="text-[10px] text-red-400 truncate max-w-[150px]">{step.error}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
