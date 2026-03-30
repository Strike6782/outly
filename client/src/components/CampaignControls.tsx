"use client";

import { useState } from "react";
import { pauseCampaign, resumeCampaign, cancelCampaign } from "@/lib/apis";
import { useToast } from "@/context/ToastContext";
import CancelConfirmDialog from "./CancelConfirmDialog";
import { Pause, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CampaignStatus = "SCHEDULED" | "SENDING" | "PAUSED" | "CANCELLED" | "COMPLETED";

interface CampaignControlsProps {
  campaignId: string;
  status: CampaignStatus;
  pendingCount: number;
  subject: string;
  onStatusChange: (newStatus: CampaignStatus) => void;
  size?: "sm" | "md";
}

export default function CampaignControls({
  campaignId,
  status,
  pendingCount,
  subject,
  onStatusChange,
  size = "sm",
}: CampaignControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { addToast } = useToast();

  const showPause = status === "SCHEDULED" || status === "SENDING";
  const showResume = status === "PAUSED";
  const showCancel = showPause || showResume;

  if (!showPause && !showResume && !showCancel) return null;

  const handleAction = async (action: "pause" | "resume" | "cancel") => {
    setLoading(action);
    try {
      let result;
      if (action === "pause") result = await pauseCampaign(campaignId);
      else if (action === "resume") result = await resumeCampaign(campaignId);
      else result = await cancelCampaign(campaignId);
      onStatusChange(result.status as CampaignStatus);

      const actionLabels: Record<string, string> = {
        pause: "paused",
        resume: "resumed",
        cancel: "cancelled",
      };
      addToast("success", `Campaign ${actionLabels[action]}: ${subject}`);
    } catch {
      const actionLabels: Record<string, string> = {
        pause: "pause",
        resume: "resume",
        cancel: "cancel",
      };
      addToast("error", `Failed to ${actionLabels[action]} campaign: ${subject}`);
    } finally {
      setLoading(null);
      setCancelOpen(false);
    }
  };

  const btnClass = cn(
    "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    size === "sm" && "px-2.5 py-1.5 text-[11px]",
    size === "md" && "px-3.5 py-2 text-xs"
  );

  return (
    <>
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {showPause && (
          <button
            className={cn(btnClass, "bg-gray-100 text-gray-600 hover:bg-gray-200")}
            onClick={() => handleAction("pause")}
            disabled={!!loading}
          >
            {loading === "pause" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Pause className="h-3 w-3" />
            )}
            Pause
          </button>
        )}

        {showResume && (
          <button
            className={cn(btnClass, "bg-primary-light text-primary hover:bg-[#caf9ca]")}
            onClick={() => handleAction("resume")}
            disabled={!!loading}
          >
            {loading === "resume" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Resume
          </button>
        )}

        {showCancel && (
          <button
            className={cn(btnClass, "bg-red-50 text-red-500 hover:bg-red-100")}
            onClick={() => setCancelOpen(true)}
            disabled={!!loading}
          >
            Cancel
          </button>
        )}
      </div>

      <CancelConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => handleAction("cancel")}
        campaignSubject={subject}
        pendingCount={pendingCount}
        isLoading={loading === "cancel"}
      />
    </>
  );
}
