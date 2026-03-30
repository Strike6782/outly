"use client";

import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface CancelConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  campaignSubject: string;
  pendingCount: number;
  isLoading: boolean;
}

export default function CancelConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  campaignSubject,
  pendingCount,
  isLoading,
}: CancelConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Cancel campaign?
        </h3>
        <p className="text-sm text-gray-500 mb-1">
          &ldquo;{campaignSubject}&rdquo;
        </p>
        <p className="text-sm text-gray-400 mb-5">
          {pendingCount} unsent email{pendingCount !== 1 ? "s" : ""} will be
          cancelled. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 rounded-lg"
            onClick={onClose}
            disabled={isLoading}
          >
            Keep Sending
          </Button>
          <Button
            variant="danger"
            className="flex-1 rounded-lg gap-2"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isLoading ? "Cancelling..." : "Cancel Campaign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
