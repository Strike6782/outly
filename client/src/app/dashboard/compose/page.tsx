"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/context/ToastContext";
import { AuthGuard } from "@/components/AuthGuard";
import { ComposeHeader } from "./ComposeHeader";
import { ComposeForm } from "./ComposeForm";
import { createCampaign, uploadAttachments, deleteAttachment } from "@/lib/apis";
import type { CreateCampaignPayload, UploadedAttachment } from "@/types";

/**
 * ComposePage — Parent component that coordinates state between
 * ComposeHeader (send/schedule buttons, attachments) and ComposeForm
 * (sender selection, recipients, subject, body, rate controls).
 *
 * WHY lift state here: The Header owns the Send button and schedule picker,
 * but the Form owns the campaign data. By lifting scheduledAt, attachments,
 * and the submit handler to this parent, both children can access what they need.
 */
export default function ComposePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  // Lifted state — shared between Header and Form
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [uploadedAttachments, setUploadedAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Counter pattern: when Header clicks Send, increment this counter.
  // The Form watches it in a useEffect and triggers validation + submission.
  // This avoids passing a ref or imperative handle between siblings.
  const [submitTrigger, setSubmitTrigger] = useState(0);

  // Called by ComposeHeader when files are selected via the attach button.
  // Uploads immediately to the backend, then stores the server-confirmed metadata.
  const handleFilesSelected = useCallback(async (files: File[]) => {
    setIsUploading(true);
    try {
      const results = await uploadAttachments(files);
      setUploadedAttachments(prev => [...prev, ...results]);
      results.forEach((r) => addToast("success", `Attachment uploaded: ${r.filename}`));
    } catch (err: any) {
      console.error("Upload failed:", err);
      addToast("error", "Attachment upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [addToast]);

  // Called by ComposeHeader when the user clicks remove on an attached file.
  // Removes from local state AND deletes from Cloudinary.
  const handleRemoveAttachment = useCallback(async (url: string) => {
    setUploadedAttachments(prev => prev.filter(a => a.url !== url));
    try {
      await deleteAttachment(url);
    } catch (err) {
      console.error("Failed to delete attachment from Cloudinary:", err);
      addToast("error", "Failed to remove attachment");
    }
  }, [addToast]);

  // Called by ComposeHeader when Send/Schedule is clicked
  const handleSend = useCallback(() => {
    setSubmitTrigger((prev) => prev + 1);
  }, []);

  // Called by ComposeForm when form data is validated and ready
  const handleSubmit = useCallback(
    async (data: CreateCampaignPayload) => {
      setIsSubmitting(true);
      try {
        await createCampaign(data);
        addToast("success", `Campaign created: ${data.subject}`);
        router.push("/dashboard");
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || "Unknown error";
        addToast("error", `Failed to create campaign: ${message}`);
        // Error is handled inside ComposeForm — it catches and displays the message
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [router, addToast],
  );

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-[#f8f9fb]">
        <ComposeHeader
          onBack={() => router.push("/dashboard")}
          scheduledAt={scheduledAt}
          setScheduledAt={setScheduledAt}
          uploadedAttachments={uploadedAttachments}
          onFilesSelected={handleFilesSelected}
          onRemoveAttachment={handleRemoveAttachment}
          isUploading={isUploading}
          onSend={handleSend}
          isSubmitting={isSubmitting}
        />
        
        <main className="flex-1 overflow-hidden">
          <ComposeForm
            user={user}
            scheduledAt={scheduledAt}
            uploadedAttachments={uploadedAttachments}
            onSubmit={handleSubmit}
            submitTrigger={submitTrigger}
          />
        </main>
      </div>
    </AuthGuard>
  );
}
