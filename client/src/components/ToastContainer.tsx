"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Toast } from "@/types";
import ToastComponent from "@/components/ToastComponent";

export interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onExitComplete: (id: string) => void;
}

export function ToastContainer({
  toasts,
  onDismiss,
  onPause,
  onResume,
  onExitComplete,
}: ToastContainerProps) {
  const prevCountRef = useRef(toasts.length);

  // Track whether a new toast was just added (for nudge animation)
  const shouldNudge = toasts.length > prevCountRef.current;
  useEffect(() => {
    prevCountRef.current = toasts.length;
  }, [toasts.length]);

  // Escape key dismisses the most recently added non-exiting toast
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        const nonExiting = toasts.filter((t) => !t.isExiting);
        if (nonExiting.length > 0) {
          // Most recently added = last in the array
          const mostRecent = nonExiting[nonExiting.length - 1];
          onDismiss(mostRecent.id);
        }
      }
    },
    [toasts, onDismiss],
  );

  if (toasts.length === 0) return null;

  // Split toasts by severity for ARIA live regions
  const politeToasts = toasts.filter(
    (t) => t.type === "success" || t.type === "info",
  );
  const assertiveToasts = toasts.filter(
    (t) => t.type === "error" || t.type === "warning",
  );

  // Reverse for rendering: newest at top
  const politeReversed = [...politeToasts].reverse();
  const assertiveReversed = [...assertiveToasts].reverse();

  return (
    <div
      className="fixed top-4 right-4 z-[9999] w-[400px] max-sm:left-4 max-sm:right-4 max-sm:w-auto"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Polite live region for success/info toasts */}
      <div
        role="status"
        aria-live="polite"
        aria-relevant="additions"
        className="flex flex-col gap-3"
      >
        {politeReversed.map((toast, index) => (
          <div
            key={toast.id}
            className={shouldNudge && !toast.isExiting ? "animate-toast-nudge" : ""}
            style={
              shouldNudge && !toast.isExiting
                ? { animationDelay: `${index * 50}ms` }
                : undefined
            }
          >
            <ToastComponent
              toast={toast}
              index={index}
              onDismiss={onDismiss}
              onPause={onPause}
              onResume={onResume}
              onExitComplete={onExitComplete}
            />
          </div>
        ))}
      </div>

      {/* Assertive live region for error/warning toasts */}
      <div
        role="alert"
        aria-live="assertive"
        aria-relevant="additions"
        className={`flex flex-col gap-3 ${politeToasts.length > 0 && assertiveToasts.length > 0 ? "mt-3" : ""}`}
      >
        {assertiveReversed.map((toast, index) => (
          <div
            key={toast.id}
            className={shouldNudge && !toast.isExiting ? "animate-toast-nudge" : ""}
            style={
              shouldNudge && !toast.isExiting
                ? { animationDelay: `${index * 50}ms` }
                : undefined
            }
          >
            <ToastComponent
              toast={toast}
              index={index}
              onDismiss={onDismiss}
              onPause={onPause}
              onResume={onResume}
              onExitComplete={onExitComplete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
