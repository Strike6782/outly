"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { createSender, verifySender } from "@/lib/apis";
import { SenderModalProps } from "@/types";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * SenderModal — Add a new sender or verify an existing unverified sender.
 *
 * Two modes:
 * 1. "Add" mode (default): All fields editable, calls createSender.
 * 2. "Verify" mode (existingSender provided): Email is read-only/pre-filled,
 *    only name + appPassword are editable, calls verifySender.
 *
 * WHY modal instead of separate page: Users should be able to add a sender
 * without leaving the compose flow. Interrupting campaign creation to navigate
 * to a settings page would lose their form data.
 *
 * WHY App Password field: Google requires App Passwords for third-party SMTP
 * access since they disabled "Less Secure App" access in May 2022.
 */
export function SenderModal({ isOpen, onClose, onSuccess, existingSender }: SenderModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [skipWarmup, setSkipWarmup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { addToast } = useToast();

  const isVerifyMode = !!existingSender;

  // Pre-fill fields when entering verify mode
  useEffect(() => {
    if (existingSender && isOpen) {
      setName(existingSender.name || "");
      setEmail(existingSender.email);
      setAppPassword("");
      setSkipWarmup(false);
      setError(null);
    } else if (!existingSender && isOpen) {
      setName("");
      setEmail("");
      setAppPassword("");
      setSkipWarmup(false);
      setError(null);
    }
  }, [existingSender, isOpen]);

  const isFormValid = isVerifyMode
    ? appPassword.trim() !== ""
    : name.trim() !== "" && email.trim() !== "" && appPassword.trim() !== "";

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let sender;
      if (isVerifyMode) {
        sender = await verifySender(existingSender.id, {
          name: name.trim() || undefined,
          appPassword,
          skipWarmup: skipWarmup || undefined,
        });
      } else {
        sender = await createSender({ name, email, appPassword, skipWarmup: skipWarmup || undefined });
      }
      // Reset form and notify parent
      setName("");
      setEmail("");
      setAppPassword("");
      if (isVerifyMode) {
        addToast("success", `Sender verified: ${existingSender.email}`);
      } else {
        addToast("success", `Sender added: ${email}`);
      }
      onSuccess(sender);
      onClose();
    } catch (err: any) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message;

      let errorMessage: string;
      if (status === 409) {
        errorMessage = "This sender email already exists for your account.";
      } else if (status === 400) {
        errorMessage = message || "Invalid credentials. Please check your email and app password.";
      } else {
        errorMessage = "Something went wrong. Please try again.";
      }
      setError(errorMessage);
      addToast("error", `Verification failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant={isMobile ? "bottom-sheet" : "center"}
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isVerifyMode ? "Verify Sender" : "Add Sender Account"}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {isVerifyMode
              ? "Add your Google App Password to verify this sender for campaigns."
              : "Connect a Gmail or Google Workspace account for sending campaigns."}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Sender Name</label>
            <Input
              type="text"
              placeholder="e.g. Sales Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email Address</label>
            <Input
              type="email"
              placeholder="e.g. sales@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || isVerifyMode}
            />
            {isVerifyMode && (
              <p className="mt-1 text-[11px] text-gray-400">
                Email cannot be changed for an existing sender.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Google App Password
            </label>
            <Input
              type="password"
              placeholder="16-character app password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              disabled={isSubmitting}
            />
            <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
              App Passwords are 16-character codes generated by Google for third-party apps.
              You need 2-Step Verification enabled first.{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Generate one here <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </p>
          </div>

          {/* Skip warmup option */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={skipWarmup}
              onChange={(e) => setSkipWarmup(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div>
              <span className="text-xs font-medium text-gray-600">Skip warmup period</span>
              <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">
                New senders go through a 14-day warmup that gradually increases daily limits.
                Skip this if the account already has sending history.
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="w-auto px-5 py-2 rounded-lg text-xs"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Verifying...
              </span>
            ) : isVerifyMode ? (
              "Verify & Connect"
            ) : (
              "Add Sender"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
