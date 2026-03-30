"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: "center" | "bottom-sheet" | "dropdown";
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  variant = "center",
  children,
  className,
  showCloseButton = true,
}: ModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Dropdown variant — no backdrop, positioned relative to parent
  if (variant === "dropdown") {
    return (
      <div
        className={cn(
          "absolute right-0 top-12 z-50 w-[360px] rounded-xl bg-white p-5 border border-gray-300 shadow-lg",
          "animate-[fadeInUp_0.2s_ease-out]",
          className,
        )}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className={cn(
          "fixed z-50",
          // Bottom-sheet variant (mobile)
          variant === "bottom-sheet" && [
            "inset-x-0 bottom-0",
            "rounded-t-2xl bg-white p-5 shadow-xl",
            "animate-[fadeInUp_0.3s_ease-out]",
            "max-h-[85vh] overflow-y-auto",
          ],
          // Center variant (desktop)
          variant === "center" && [
            "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-[90vw] sm:w-full max-w-[480px] rounded-xl sm:rounded-2xl bg-white p-4 sm:p-6 shadow-xl border border-gray-200",
            "animate-[fadeInUp_0.2s_ease-out]",
            "max-h-[90vh] overflow-y-auto",
          ],
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </>
  );
}
