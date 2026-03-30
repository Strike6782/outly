"use client";

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import type { Toast, ToastType, ToastColorScheme } from "@/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface ToastComponentProps {
  toast: Toast;
  index: number;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onExitComplete: (id: string) => void;
}

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_COLORS: Record<ToastType, ToastColorScheme> = {
  success: {
    bg: "bg-green-50",
    border: "border-l-green-500",
    icon: "text-green-600",
    text: "text-green-900",
    progress: "bg-green-500",
  },
  error: {
    bg: "bg-red-50",
    border: "border-l-red-500",
    icon: "text-red-500",
    text: "text-red-900",
    progress: "bg-red-500",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-l-amber-500",
    icon: "text-amber-500",
    text: "text-amber-900",
    progress: "bg-amber-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-l-blue-500",
    icon: "text-blue-500",
    text: "text-blue-900",
    progress: "bg-blue-500",
  },
};

export default function ToastComponent({
  toast,
  index,
  onDismiss,
  onPause,
  onResume,
  onExitComplete,
}: ToastComponentProps) {
  const colors = TOAST_COLORS[toast.type];
  const IconComponent = TOAST_ICONS[toast.type];

  const handleAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    // Only trigger onExitComplete when the exit animation finishes, not the entry
    if (e.animationName === "toastExit") {
      onExitComplete(toast.id);
    }
  };

  return (
    <div
      className={cn(
        "relative rounded-xl shadow-lg border-l-4 overflow-hidden",
        colors.bg,
        colors.border,
        "toast-hover-lift",
        toast.isExiting
          ? "animate-toast-exit"
          : "animate-toast-enter",
      )}
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onAnimationEnd={handleAnimationEnd}
      tabIndex={0}
      role="listitem"
    >
      {/* Left border accent wipe */}
      <div
        className={cn(
          "absolute left-0 top-0 w-1 h-full animate-toast-border-wipe",
          colors.border.replace("border-l-", "bg-"),
        )}
      />

      {/* Content area */}
      <div className="flex items-start gap-3 p-4 pr-12">
        {/* Icon */}
        <div className="flex-shrink-0 animate-toast-icon-pop">
          <IconComponent className={cn("h-5 w-5", colors.icon)} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className={cn("text-sm font-semibold", colors.text)}>
              {toast.title}
            </p>
          )}
          <p className={cn("text-sm", colors.text, toast.title && "mt-0.5")}>
            {toast.message}
          </p>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute top-2 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress bar */}
      <div className="w-full h-1 bg-black/5">
        <div
          className={cn(
            "h-full animate-toast-progress",
            colors.progress,
            `toast-progress-glow-${toast.type}`,
          )}
          style={{
            animationDuration: `${toast.duration}ms`,
            animationPlayState: toast.isPaused ? "paused" : "running",
          }}
        />
      </div>
    </div>
  );
}
