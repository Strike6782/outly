"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { createSender, updateSender, verifySender } from "@/lib/apis";
import { SenderModalProps } from "@/types";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type EmailProvider = "gmail" | "fastmail";

/**
 * SenderModal — Add, verify, or edit a sender account.
 * Supports Gmail and Fastmail (custom domains) via SMTP + IMAP app passwords.
 */
export function SenderModal({
  isOpen,
  onClose,
  onSuccess,
  existingSender,
  mode = "add",
}: SenderModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dailyLimit, setDailyLimit] = useState("25");
  const [mailLoginEmail, setMailLoginEmail] = useState("");
  const [provider, setProvider] = useState<EmailProvider>("fastmail");
  const [appPassword, setAppPassword] = useState("");
  const [skipWarmup, setSkipWarmup] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { addToast } = useToast();

  const isAddMode = mode === "add";
  const isVerifyMode = mode === "verify";
  const isEditMode = mode === "edit";
  const isFastmail = provider === "fastmail";

  // Pre-fill fields when opening the modal
  useEffect(() => {
    if (!isOpen) return;

    if (existingSender && (isVerifyMode || isEditMode)) {
      setName(existingSender.name || "");
      setEmail(existingSender.email);
      setDailyLimit(String(existingSender.dailyLimit));
      setProvider(existingSender.smtpHost?.includes("fastmail") ? "fastmail" : "gmail");
      setMailLoginEmail("");
      setAppPassword("");
      setSkipWarmup(false);
      setError(null);
      return;
    }

    if (isAddMode) {
      setName("");
      setEmail("");
      setDailyLimit("25");
      setMailLoginEmail("");
      setProvider("fastmail");
      setAppPassword("");
      setSkipWarmup(false);
      setError(null);
    }
  }, [existingSender, isOpen, isAddMode, isEditMode, isVerifyMode]);

  const isFormValid = isEditMode
    ? name.trim() !== ""
    : isVerifyMode
      ? appPassword.trim() !== ""
      : name.trim() !== "" && email.trim() !== "" && appPassword.trim() !== "";

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let sender;

      if (isEditMode && existingSender) {
        sender = await updateSender(existingSender.id, {
          name: name.trim(),
          dailyLimit: Number(dailyLimit),
          ...(appPassword.trim()
            ? {
                appPassword,
                mailLoginEmail: mailLoginEmail.trim() || undefined,
                provider,
              }
            : mailLoginEmail.trim()
              ? { mailLoginEmail: mailLoginEmail.trim() }
              : {}),
        });
        addToast("success", `Sender updated: ${existingSender.email}`);
      } else if (isVerifyMode && existingSender) {
        sender = await verifySender(existingSender.id, {
          name: name.trim() || undefined,
          appPassword,
          mailLoginEmail: mailLoginEmail.trim() || undefined,
          provider,
          skipWarmup: skipWarmup || undefined,
        });
        addToast("success", `Sender verified: ${existingSender.email}`);
      } else {
        sender = await createSender({
          name,
          email,
          appPassword,
          mailLoginEmail: mailLoginEmail.trim() || undefined,
          provider,
          skipWarmup: skipWarmup || undefined,
        });
        addToast("success", `Sender added: ${email}`);
      }

      onSuccess(sender);
      onClose();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      const status = axiosErr?.response?.status;
      const message = axiosErr?.response?.data?.message;

      let errorMessage: string;
      if (status === 409) {
        errorMessage = "This sender email already exists for your account.";
      } else if (status === 400) {
        errorMessage = message || "Invalid credentials. Please check your email and app password.";
      } else {
        errorMessage = message || "Something went wrong. Please try again.";
      }
      setError(errorMessage);
      addToast("error", errorMessage);
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

  const title = isEditMode
    ? "Edit Sender"
    : isVerifyMode
      ? "Verify Sender"
      : "Add Sender Account";

  const subtitle = isEditMode
    ? "Update the display name, daily limit, or SMTP credentials."
    : isVerifyMode
      ? "Add your app password to verify this sender for campaigns."
      : "Connect a Gmail or Fastmail address (including custom domains) for sending.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant={isMobile ? "bottom-sheet" : "center"}
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {isAddMode && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as EmailProvider)}
                disabled={isSubmitting}
                className="w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-700 bg-white"
              >
                <option value="fastmail">Fastmail (custom domains)</option>
                <option value="gmail">Gmail / Google Workspace</option>
              </select>
            </div>
          )}

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
              placeholder={isFastmail ? "e.g. you@yourdomain.com" : "e.g. sales@company.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || !isAddMode}
            />
            {!isAddMode && (
              <p className="mt-1 text-[11px] text-gray-400">
                Email cannot be changed for an existing sender.
              </p>
            )}
          </div>

          {isEditMode && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Daily send limit</label>
              <Input
                type="number"
                min={1}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          {isFastmail && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Fastmail login email
              </label>
              <Input
                type="email"
                placeholder="e.g. you@fastmail.com (your main account)"
                value={mailLoginEmail}
                onChange={(e) => setMailLoginEmail(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
                {isEditMode || isVerifyMode
                  ? "Only needed if this address is an alias. Use your primary Fastmail login."
                  : "Required for aliases/custom domains. Use your primary Fastmail address for login."}
              </p>
            </div>
          )}

          {!isEditMode && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {isFastmail ? "Fastmail App Password" : "Google App Password"}
              </label>
              <Input
                type="password"
                placeholder="App-specific password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
                {isFastmail ? (
                  <>
                    Create an app password in Fastmail Settings → Privacy &amp; Security.{" "}
                    <a
                      href="https://www.fastmail.help/hc/en-us/articles/1500000279921"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Fastmail IMAP/SMTP guide <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                ) : (
                  <>
                    App Passwords are 16-character codes from Google.{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Generate one here <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </>
                )}
              </p>
            </div>
          )}

          {isEditMode && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                New app password (optional)
              </label>
              <Input
                type="password"
                placeholder="Leave blank to keep current password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          )}

          {isAddMode && (
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
                  New senders go through a 14-day warmup with conservative daily limits.
                </p>
              </div>
            </label>
          )}

          {isVerifyMode && (
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
                  Skip if the account already has sending history.
                </p>
              </div>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
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
                Saving...
              </span>
            ) : isEditMode ? (
              "Save Changes"
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
