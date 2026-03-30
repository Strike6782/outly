"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft, Link2, CalendarClock, Calendar, Send, Loader2, X,
  FileText, Image as ImageIcon, Trash2, Plus, CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { ComposeHeaderProps, UploadedAttachment } from "@/types";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Logo } from "@/components/Logo";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif";
const ALLOWED_MIME_TYPES = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain", "image/png", "image/jpeg", "image/gif",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) return { Icon: ImageIcon, bg: "bg-violet-50", color: "text-violet-500" };
  if (mimeType?.includes("pdf")) return { Icon: FileText, bg: "bg-red-50", color: "text-red-500" };
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel") || mimeType?.includes("csv"))
    return { Icon: FileText, bg: "bg-emerald-50", color: "text-emerald-500" };
  return { Icon: FileText, bg: "bg-sky-50", color: "text-sky-500" };
}

function AttachmentChip({ attachment, onRemove }: { attachment: UploadedAttachment; onRemove: () => void }) {
  const { Icon, bg, color } = getFileIcon(attachment.mimeType);
  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white px-3 py-2
      hover:border-gray-200 hover:shadow-sm transition-all duration-200
      opacity-0 animate-[fadeIn_0.2s_ease-out_forwards]">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-gray-700 truncate max-w-[120px] md:max-w-[180px]">
          {attachment.filename}
        </p>
        <p className="text-[10px] text-gray-300">{formatFileSize(attachment.size)}</p>
      </div>
      <button
        onClick={onRemove}
        className="h-7 w-7 rounded-lg flex items-center justify-center text-gray-300
          hover:text-red-500 hover:bg-red-50 transition-all duration-150
          md:opacity-0 md:group-hover:opacity-100"
        aria-label={`Remove ${attachment.filename}`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function ScheduleBadge({ date, onClear }: { date: Date; onClear: () => void }) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 pl-2.5 pr-1 py-1
      animate-[fadeIn_0.2s_ease-out]">
      <CalendarClock className="h-3 w-3 text-primary" />
      <span className="text-[11px] font-semibold text-primary">{formatted}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onClear(); }}
        className="h-5 w-5 rounded-full flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors"
        aria-label="Clear schedule"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export function ComposeHeader({
  onBack, scheduledAt, setScheduledAt, uploadedAttachments,
  onFilesSelected, onRemoveAttachment, isUploading, onSend, isSubmitting,
}: ComposeHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const [tempTime, setTempTime] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { addToast } = useToast();

  const hasAttachments = uploadedAttachments.length > 0;
  const totalSize = uploadedAttachments.reduce((s, a) => s + a.size, 0);
  const usagePercent = Math.round((totalSize / MAX_TOTAL_SIZE) * 100);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    e.target.value = "";
    setFileError(null);

    const invalid = files.find(f => !ALLOWED_MIME_TYPES.includes(f.type));
    if (invalid) {
      setFileError(`"${invalid.name}" is not a supported file type`);
      addToast("error", `Unsupported file: ${invalid.name}`);
      return;
    }
    const oversized = files.find(f => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setFileError(`"${oversized.name}" exceeds the 10 MB limit`);
      addToast("error", `File too large: ${oversized.name}`);
      return;
    }
    const newTotal = totalSize + files.reduce((s, f) => s + f.size, 0);
    if (newTotal > MAX_TOTAL_SIZE) {
      setFileError("Total attachments would exceed 25 MB");
      addToast("error", "Total attachments exceed 25 MB limit");
      return;
    }
    onFilesSelected(files);
  };

  const openSchedule = () => {
    if (scheduledAt) {
      const d = scheduledAt;
      setTempDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      setTempTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    } else {
      setTempDate("");
      setTempTime("");
    }
    setIsScheduleOpen(true);
  };

  const confirmSchedule = () => {
    if (tempDate && tempTime) {
      setScheduledAt(new Date(`${tempDate}T${tempTime}`));
      setIsScheduleOpen(false);
    }
  };

  const quickPick = (daysFromNow: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    setScheduledAt(d);
    setIsScheduleOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-3 md:px-6 h-14">
          {/* Left */}
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={onBack}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="hidden md:flex items-center gap-3">
              <div className="h-5 w-px bg-gray-200" />
              <Logo size="sm" />
            </div>
            <h1 className="text-sm font-semibold text-gray-900 md:hidden">New Campaign</h1>
          </div>

          {/* Center — desktop title + schedule badge */}
          <div className="hidden md:flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
            <h1 className="text-sm font-semibold text-gray-900">New Campaign</h1>
            {scheduledAt && <ScheduleBadge date={scheduledAt} onClear={() => setScheduledAt(null)} />}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Attach button */}
            <button
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-xl transition-all relative",
                hasAttachments
                  ? "text-primary bg-primary/5 hover:bg-primary/10"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => setIsAttachOpen(true)}
              aria-label="Attachments"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  {hasAttachments && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center px-1">
                      {uploadedAttachments.length}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Schedule button */}
            <button
              className={cn(
                "h-9 w-9 flex items-center justify-center rounded-xl transition-all",
                scheduledAt
                  ? "text-primary bg-primary/5 hover:bg-primary/10"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              )}
              onClick={openSchedule}
              aria-label="Schedule"
            >
              <CalendarClock className="h-4 w-4" />
            </button>

            {/* Send button */}
            <button
              className="ml-1.5 h-9 px-4 rounded-xl bg-gray-900 text-white text-xs font-semibold
                flex items-center gap-2 hover:bg-gray-800 transition-all shadow-sm
                disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onSend}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>{scheduledAt ? "Schedule" : "Send"}</span>
            </button>
          </div>
        </div>

        {/* Mobile schedule badge */}
        {scheduledAt && (
          <div className="md:hidden px-4 pb-2">
            <ScheduleBadge date={scheduledAt} onClear={() => setScheduledAt(null)} />
          </div>
        )}
      </header>

      {/* ─── Attachment Panel Modal ─── */}
      <Modal
        isOpen={isAttachOpen}
        onClose={() => { setIsAttachOpen(false); setFileError(null); }}
        variant={isMobile ? "bottom-sheet" : "center"}
      >
        <div className="space-y-4 min-w-[320px]">
          <div className="flex items-center justify-between pr-10 md:pr-12">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Attachments</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {hasAttachments
                  ? `${uploadedAttachments.length} file${uploadedAttachments.length !== 1 ? "s" : ""} · ${formatFileSize(totalSize)} of 25 MB`
                  : "Add files to include with every email"}
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-8 px-3 rounded-lg bg-gray-900 text-white text-[11px] font-semibold
                flex items-center gap-1.5 hover:bg-gray-800 transition-all disabled:opacity-40"
            >
              {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add Files
            </button>
          </div>

          {/* Usage bar */}
          {hasAttachments && (
            <div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    usagePercent >= 90 ? "bg-red-500" : usagePercent >= 70 ? "bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-300">{formatFileSize(totalSize)} used</span>
                <span className="text-[10px] text-gray-300">{formatFileSize(MAX_TOTAL_SIZE - totalSize)} remaining</span>
              </div>
            </div>
          )}

          {/* Error */}
          {fileError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-600">
              <X className="h-3 w-3 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* File list */}
          {hasAttachments ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {uploadedAttachments.map((a, i) => {
                const { Icon, bg, color } = getFileIcon(a.mimeType);
                return (
                  <div
                    key={a.url}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100
                      hover:border-gray-200 transition-all duration-200
                      opacity-0 animate-[fadeIn_0.15s_ease-out_forwards]"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", bg)}>
                      <Icon className={cn("h-4.5 w-4.5", color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-700 truncate">{a.filename}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {formatFileSize(a.size)} · {a.mimeType.split("/").pop()?.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveAttachment(a.url)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-gray-300
                        hover:text-red-500 hover:bg-red-50 transition-all"
                      aria-label={`Remove ${a.filename}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <Link2 className="h-5 w-5 text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No attachments yet</p>
              <p className="text-[11px] text-gray-300 mt-1">PDF, DOC, XLS, CSV, images · 10 MB per file</p>
            </div>
          )}

          {/* Supported formats footer */}
          {hasAttachments && (
            <p className="text-[10px] text-gray-300 text-center">
              Supported: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, PNG, JPG, GIF · 10 MB per file
            </p>
          )}
        </div>
      </Modal>

      <input ref={fileInputRef} type="file" multiple className="hidden" accept={ALLOWED_EXTENSIONS} onChange={handleFileChange} />

      {/* ─── Schedule Modal ─── */}
      <Modal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        variant={isMobile ? "bottom-sheet" : "center"}
      >
        <div className="space-y-5 min-w-[320px]">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Schedule Campaign</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Choose when to start sending emails</p>
          </div>

          {/* Date & Time inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={tempDate}
                  onChange={(e) => setTempDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700
                    outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Time</label>
              <input
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700
                  outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          {/* Quick picks */}
          <div>
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-2">Quick picks</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Tomorrow\n10 AM", days: 1, hour: 10 },
                { label: "Tomorrow\n2 PM", days: 1, hour: 14 },
                { label: "Tomorrow\n6 PM", days: 1, hour: 18 },
              ].map(({ label, days, hour }) => (
                <button
                  key={label}
                  onClick={() => quickPick(days, hour)}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 text-center
                    hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <Calendar className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary mx-auto mb-1 transition-colors" />
                  <p className="text-[11px] font-medium text-gray-600 group-hover:text-primary whitespace-pre-line leading-tight transition-colors">
                    {label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            {scheduledAt ? (
              <button
                onClick={() => { setScheduledAt(null); setIsScheduleOpen(false); }}
                className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                Remove schedule
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setIsScheduleOpen(false)}
                className="h-9 px-4 text-xs font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <Button
                onClick={confirmSchedule}
                disabled={!tempDate || !tempTime}
                className="w-auto px-5 py-2 rounded-xl text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── Inline attachment chips (below header) ─── */}
      {hasAttachments && (
        <div className="mx-auto max-w-[1280px] px-3 md:px-6 pt-3">
          <div className="flex flex-wrap gap-2">
            {uploadedAttachments.map((a) => (
              <AttachmentChip key={a.url} attachment={a} onRemove={() => onRemoveAttachment(a.url)} />
            ))}
            <button
              onClick={() => setIsAttachOpen(true)}
              className="h-[52px] px-3 rounded-xl border border-dashed border-gray-200 text-[11px] font-medium
                text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all flex items-center gap-1.5"
            >
              <Plus className="h-3 w-3" />
              Add more
            </button>
          </div>
        </div>
      )}
    </>
  );
}
