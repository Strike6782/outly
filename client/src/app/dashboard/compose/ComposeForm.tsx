"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ComposeFormData, ComposeFormProps, SenderResponse, CreateCampaignPayload } from "@/types";
import { getSenders } from "@/lib/apis";
import { SenderModal } from "./SenderModal";
import { Editor } from "./Editor";
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, Plus, Check, AlertTriangle, Clock, Gauge, ChevronDown, Users, FileText, Eye, MousePointer2 } from "lucide-react";
import TemplateSelector from "./TemplateSelector";
import type { EmailTemplate, SequenceStepInput } from "@/types";
import Modal from "@/components/Modal";
import Button from "@/components/Button";
import VariablePreview from "./VariablePreview";
import SequenceBuilder from "./SequenceBuilder";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

export function ComposeForm({ user, scheduledAt, uploadedAttachments, onSubmit, submitTrigger }: ComposeFormProps) {
  const { addToast } = useToast();
  const router = useRouter();
  const [senders, setSenders] = useState<SenderResponse[]>([]);
  const [isSenderLoading, setIsSenderLoading] = useState(true);
  const [isSenderModalOpen, setIsSenderModalOpen] = useState(false);
  // '+' opens add mode; 'Verify' opens verify mode for the selected unverified sender
  const [senderModalMode, setSenderModalMode] = useState<"add" | "verify">("add");
  const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);
  const senderDropdownRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ComposeFormData>({
    from: "", selectedSenderIds: [], to: [], subject: "", body: "",
    delayBetweenEmails: 30, hourlyLimit: 50,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<EmailTemplate | null>(null);
  const [recipientColumnData, setRecipientColumnData] = useState<Record<string, Record<string, string>>>({});
  const [sequenceSteps, setSequenceSteps] = useState<SequenceStepInput[]>([]);
  const [trackOpens, setTrackOpens] = useState(false);
  const [trackClicks, setTrackClicks] = useState(false);

  const verifiedSenders = senders.filter(s => s.isVerified);
  const selectedSenders = senders.filter(s => data.selectedSenderIds.includes(s.id));
  const combinedDailyLimit = selectedSenders.reduce((sum, s) => sum + s.dailyLimit, 0);

  // Keep legacy `from` in sync with first selected sender
  const selectedSender = selectedSenders[0] || null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (senderDropdownRef.current && !senderDropdownRef.current.contains(e.target as Node)) {
        setIsSenderDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await getSenders();
        setSenders(list);
        const firstVerified = list.find(s => s.isVerified);
        if (firstVerified) {
          setData(prev => ({ ...prev, from: firstVerified.email, selectedSenderIds: [firstVerified.id] }));
        } else if (list.length > 0) {
          setData(prev => ({ ...prev, from: list[0].email, selectedSenderIds: [list[0].id] }));
        }
      } catch {} finally { setIsSenderLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!submitTrigger) return;
    handleFormSubmit();
  }, [submitTrigger]);

  const toggleSender = (senderId: string) => {
    setData(prev => {
      const isSelected = prev.selectedSenderIds.includes(senderId);
      const newIds = isSelected
        ? prev.selectedSenderIds.filter(id => id !== senderId)
        : [...prev.selectedSenderIds, senderId];
      const firstSender = senders.find(s => newIds.includes(s.id));
      return { ...prev, selectedSenderIds: newIds, from: firstSender?.email || "" };
    });
    setErrors(p => ({ ...p, from: "" }));
  };

  const handleFormSubmit = async () => {
    const e: Record<string, string> = {};
    if (!data.selectedSenderIds.length) e.from = "Select at least one sender";
    const hasUnverified = selectedSenders.some(s => !s.isVerified);
    if (hasUnverified) e.from = "Please verify your sender(s) with an App Password before sending";
    if (!data.to.length) e.to = "Add at least one recipient";
    if (!data.subject.trim()) e.subject = "Subject required";
    setErrors(e);
    if (Object.keys(e).length) {
      addToast("warning", "Please fix the form errors before sending");
      return;
    }
    try {
      setSubmitError(null);
      await onSubmit({
        senderIds: data.selectedSenderIds,
        subject: data.subject, body: data.body,
        startTime: scheduledAt?.toISOString() || new Date().toISOString(),
        delaySeconds: data.delayBetweenEmails, hourlyLimit: data.hourlyLimit,
        // Include columnData for recipients that have it (from CSV import),
        // plain strings for manually entered emails.
        emails: data.to.map(email => {
          const colData = recipientColumnData[email.toLowerCase()];
          return colData && Object.keys(colData).length > 0
            ? { email, columnData: colData }
            : email;
        }),
        attachments: uploadedAttachments.length ? uploadedAttachments : undefined,
        steps: sequenceSteps.length > 0 ? sequenceSteps : undefined,
        trackOpens,
        trackClicks,
      });
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || "Failed to create campaign.");
    }
  };

  const handleSenderUpdated = (s: SenderResponse) => {
    setSenders(prev => prev.find(x => x.id === s.id) ? prev.map(x => x.id === s.id ? s : x) : [...prev, s]);
    if (s.isVerified) {
      setData(prev => ({
        ...prev,
        selectedSenderIds: prev.selectedSenderIds.includes(s.id) ? prev.selectedSenderIds : [...prev.selectedSenderIds, s.id],
        from: prev.from || s.email,
      }));
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMessage(null); setCsvError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const lines = (reader.result as string).split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvError("CSV must have a header row and at least one data row."); addToast("error", "CSV import failed: CSV must have a header row and at least one data row"); return; }

        const headers = lines[0].split(",").map(h => h.trim());
        const emails: string[] = [];
        const colData: Record<string, Record<string, string>> = {};

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map(c => c.trim());
          const email = cols[0];
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

          emails.push(email);
          const row: Record<string, string> = {};
          for (let j = 1; j < headers.length; j++) {
            if (headers[j] && cols[j] !== undefined) {
              row[headers[j]] = cols[j];
            }
          }
          colData[email.toLowerCase()] = row;
        }

        if (!emails.length) { setCsvError("No valid emails found."); addToast("error", "CSV import failed: No valid emails found"); return; }
        setData(prev => ({ ...prev, to: Array.from(new Set([...prev.to, ...emails])) }));
        setRecipientColumnData(prev => ({ ...prev, ...colData }));
        setCsvMessage(`${emails.length} imported`);
        addToast("success", `${emails.length} contacts imported from CSV`);
        setTimeout(() => setCsvMessage(null), 3000);
      } catch { setCsvError("Invalid CSV."); addToast("error", "CSV import failed: Invalid CSV"); }
    };
    reader.readAsText(file); e.target.value = "";
  };

  const applyTemplate = (template: EmailTemplate) => {
    setData(prev => ({ ...prev, subject: template.subject, body: template.body }));
    setPendingTemplate(null);
  };

  const handleTemplateSelect = (template: EmailTemplate) => {
    const isDirty = data.subject.trim() !== "" || (data.body.trim() !== "" && data.body !== "<p></p>");
    if (isDirty) {
      setPendingTemplate(template);
    } else {
      applyTemplate(template);
    }
  };

  return (
    <div className="h-full">
      <div className="mx-auto max-w-[1280px] px-3 md:px-6 py-3 md:py-6 h-full">
        {/* Error banner */}
        {submitError && (
          <div className="mb-4 md:mb-5 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* LEFT COLUMN: Message Details */}
          <div className="lg:col-span-8 space-y-4 md:space-y-6">
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              {/* From — Multi-Sender Selector */}
              <div className="px-3 md:px-5 py-2.5 md:py-4 border-b border-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                  <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 w-12 md:w-16">From</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-0" ref={senderDropdownRef}>
                      {/* Dropdown trigger */}
                      <button
                        type="button"
                        className="w-full h-8 md:h-9 bg-transparent text-xs md:text-sm text-gray-900 outline-none truncate cursor-pointer text-left flex items-center justify-between pr-1"
                        onClick={() => !isSenderLoading && setIsSenderDropdownOpen(prev => !prev)}
                        disabled={isSenderLoading}
                      >
                        <span className="flex-1 truncate pr-2 font-medium">
                          {isSenderLoading
                            ? "Loading senders..."
                            : senders.length === 0
                            ? "No senders added"
                            : data.selectedSenderIds.length === 0
                            ? "Select senders..."
                            : data.selectedSenderIds.length === 1
                            ? (selectedSender?.name ? `${selectedSender.name} (${selectedSender.email})` : selectedSender?.email || "")
                            : `${data.selectedSenderIds.length} senders selected`}
                        </span>
                        <ChevronDown className={`h-3 w-3 md:h-3.5 md:w-3.5 text-gray-400 shrink-0 transition-transform ${isSenderDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      {/* Dropdown panel */}
                      {isSenderDropdownOpen && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[280px] md:min-w-[320px]">
                          <div className="max-h-60 overflow-y-auto py-1.5">
                            {senders.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-gray-400">
                                No senders available. Add a sender to get started.
                              </div>
                            ) : (
                              senders.map(s => {
                                const isChecked = data.selectedSenderIds.includes(s.id);
                                return (
                                  <label
                                    key={s.id}
                                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${isChecked ? "bg-blue-50/50" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleSender(s.id)}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium text-gray-900 truncate">
                                          {s.email}
                                        </span>
                                        {!s.isVerified && (
                                          <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                        )}
                                      </div>
                                      {s.name && (
                                        <span className="text-[10px] text-gray-400 truncate block">{s.name}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center shrink-0 ml-auto">
                                      {s.isVerified ? (
                                        <span className="text-[11px] font-medium text-gray-400 tabular-nums">
                                          {s.currentDailyCount ?? 0} / {s.dailyLimit}
                                        </span>
                                      ) : (
                                        <span className="shrink-0 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600 shadow-sm uppercase tracking-wider border border-amber-100/50">
                                          Unverified
                                        </span>
                                      )}
                                    </div>
                                  </label>
                                );
                              })
                            )}
                          </div>
                          <div className="border-t border-gray-100 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSenderDropdownOpen(false);
                                router.push("/dashboard/senders");
                              }}
                              className="w-full text-left text-xs font-medium text-primary hover:text-primary-hover py-1.5"
                            >
                              Manage senders...
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Verified/unverified badge for single selection */}
                      {data.selectedSenderIds.length === 1 && selectedSender && (
                        selectedSender.isVerified
                          ? <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-600 shadow-sm"><Check className="h-2.5 w-2.5" />Verified</span>
                          : <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600 shadow-sm"><AlertTriangle className="h-2.5 w-2.5" />Unverified</span>
                      )}
                      {/* Multi-sender badge */}
                      {data.selectedSenderIds.length > 1 && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 shadow-sm">
                          <Users className="h-3 w-3" />{data.selectedSenderIds.length}
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Add sender account"
                        onClick={() => {
                          setSenderModalMode("add");
                          setIsSenderModalOpen(true);
                        }}
                        className="h-8 w-8 md:h-9 md:w-9 flex items-center justify-center rounded-lg md:rounded-xl border border-dashed border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {errors.from && <p className="text-[11px] text-red-500 mt-1 sm:ml-12 md:ml-16">{errors.from}</p>}
                
                {/* Unverified sender warning */}
                {data.selectedSenderIds.length === 1 && selectedSender && !selectedSender.isVerified && !errors.from && (
                  <div className="mt-2 sm:ml-12 md:ml-16 flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-2.5 md:p-3 shadow-sm">
                    <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] md:text-[11px] font-semibold text-amber-900">Verify Account</p>
                      <p className="text-[9px] md:text-[10px] text-amber-700/80 leading-tight">Needed for sending.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSenderModalMode("verify");
                        setIsSenderModalOpen(true);
                      }}
                      className="shrink-0 h-7 px-3 rounded-lg bg-amber-600 text-white text-[9px] md:text-[10px] font-bold hover:bg-amber-700 transition-all shadow-sm"
                    >
                      Verify
                    </button>
                  </div>
                )}
              </div>

              {/* To */}
              <div className="px-3 md:px-5 py-2.5 md:py-4 border-b border-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-0">
                  <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 w-12 md:w-16 sm:pt-2">To</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1 min-h-[32px]" onClick={() => inputRef.current?.focus()}>
                      {data.to.map(email => (
                        <span key={email} className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-100 pl-2 pr-1 py-0.5 md:py-1 text-[10px] md:text-[11px] font-medium text-gray-700 max-w-full">
                          <span className="truncate max-w-[120px] md:max-w-[180px]">{email}</span>
                          <button type="button" className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                            onClick={() => setData({ ...data, to: data.to.filter(e => e !== email) })}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input ref={inputRef}
                        placeholder={data.to.length === 0 ? "recipient@example.com" : "Add..."}
                        className="flex-1 min-w-[100px] bg-transparent text-xs md:text-sm text-gray-900 outline-none placeholder:text-gray-300 py-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const v = (e.target as HTMLInputElement).value.trim();
                            if (!v) return;
                            setData({ ...data, to: Array.from(new Set([...data.to, v])) });
                            (e.target as HTMLInputElement).value = "";
                            setErrors(p => ({ ...p, to: "" }));
                          }
                          if (e.key === "Backspace" && !(e.target as HTMLInputElement).value && data.to.length)
                            setData({ ...data, to: data.to.slice(0, -1) });
                        }}
                      />
                      <button type="button" onClick={() => csvInputRef.current?.click()}
                        className="shrink-0 h-7 md:h-8 px-2 md:px-3 rounded-lg border border-gray-200 bg-gray-50/50 text-[9px] md:text-[10px] font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 hover:border-gray-300 transition-all flex items-center gap-1.5 ml-auto group">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                        <span>Import CSV</span>
                      </button>
                    </div>
                    {errors.to && <p className="text-[11px] text-red-500 mt-1">{errors.to}</p>}
                    {csvMessage && <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-medium"><CheckCircle2 className="h-3 w-3" />{csvMessage}</p>}
                    {csvError && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium"><AlertCircle className="h-3 w-3" />{csvError}</p>}
                    <input ref={csvInputRef} type="file" accept=".csv" hidden onChange={handleCsvUpload} />
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div className="px-3 md:px-5 py-2.5 md:py-4 border-b border-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-0">
                  <span className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 w-12 md:w-16">Subject</span>
                  <input 
                    placeholder="Enter subject line..." 
                    value={data.subject}
                    onChange={(e) => { setData({ ...data, subject: e.target.value }); setErrors(p => ({ ...p, subject: "" })); }}
                    className="flex-1 h-8 md:h-10 bg-transparent text-xs md:text-sm font-medium text-gray-900 outline-none placeholder:text-gray-300" 
                  />
                </div>
                {errors.subject && <p className="text-[11px] text-red-500 mt-1 sm:ml-12 md:ml-16">{errors.subject}</p>}
              </div>

              {/* Editor */}
              <Editor value={data.body} onChange={(body) => setData({ ...data, body })} />
            </div>

            {/* Sequence Builder stays below editor on wide layout as it is primary content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
              <SequenceBuilder steps={sequenceSteps} onChange={setSequenceSteps} />
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar Settings */}
          <div className="lg:col-span-4 space-y-4 md:space-y-6">
            {/* Template Selector */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 md:p-5">
              <p className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 md:mb-4 flex items-center gap-2">
                <FileText className="h-3 w-3 md:h-3.5 md:w-3.5" /> Template
              </p>
              <TemplateSelector onSelect={handleTemplateSelect} />
            </div>

            {/* Sending settings */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 md:p-5">
              <p className="text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 md:mb-4">Campaign Settings</p>
              <div className="space-y-3 md:space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                  <div className="flex items-center gap-2.5 md:gap-3 rounded-xl bg-gray-50/80 border border-gray-100 p-2 md:p-3">
                    <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-sky-500 text-white flex items-center justify-center shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] md:text-[10px] font-semibold text-gray-400 mb-0.5 truncate">Min delay</p>
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="numeric" placeholder="30" value={data.delayBetweenEmails || ""}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setData({ ...data, delayBetweenEmails: v === "" ? 0 : Number(v) }); }}
                          className="h-6 w-9 md:w-11 rounded-md border border-gray-200 bg-white text-center text-[10px] md:text-xs font-bold text-gray-900 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/5 transition-all transition-all" />
                        <span className="text-[9px] text-gray-400 font-medium">s</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 md:gap-3 rounded-xl bg-gray-50/80 border border-gray-100 p-2 md:p-3">
                    <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Gauge className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] md:text-[10px] font-semibold text-gray-400 mb-0.5 truncate">Limit</p>
                      <div className="flex items-center gap-1">
                        <input type="text" inputMode="numeric" placeholder="50" value={data.hourlyLimit || ""}
                          onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setData({ ...data, hourlyLimit: v === "" ? 0 : Number(v) }); }}
                          className="h-6 w-9 md:w-11 rounded-md border border-gray-200 bg-white text-center text-[10px] md:text-xs font-bold text-gray-900 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/5 transition-all transition-all" />
                        <span className="text-[9px] text-gray-400 font-medium">/hr</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tracking toggles */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      type="button"
                      onClick={() => setTrackOpens(!trackOpens)}
                      className={cn(
                        "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all border text-left group",
                        trackOpens ? "bg-emerald-50 border-emerald-100" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        trackOpens ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-400"
                      )}>
                        <Eye className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold leading-none mb-1", trackOpens ? "text-emerald-700" : "text-gray-500")}>Track Opens</p>
                        <p className="text-[10px] text-gray-400 leading-tight">Know when they see your email</p>
                      </div>
                      <div className={`relative h-4 w-7 rounded-full transition-colors shrink-0 ${trackOpens ? "bg-emerald-500" : "bg-gray-300"}`}>
                        <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${trackOpens ? "translate-x-3.5" : "translate-x-0.5"}`} />
                      </div>
                    </button>

                    <button 
                      type="button"
                      onClick={() => setTrackClicks(!trackClicks)}
                      className={cn(
                        "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all border text-left group",
                        trackClicks ? "bg-indigo-50 border-indigo-100" : "bg-gray-50 border-gray-100"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        trackClicks ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-400"
                      )}>
                        <MousePointer2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold leading-none mb-1", trackClicks ? "text-indigo-700" : "text-gray-500")}>Track Clicks</p>
                        <p className="text-[10px] text-gray-400 leading-tight">See which links are clicked</p>
                      </div>
                      <div className={`relative h-4 w-7 rounded-full transition-colors shrink-0 ${trackClicks ? "bg-indigo-500" : "bg-gray-300"}`}>
                        <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${trackClicks ? "translate-x-3.5" : "translate-x-0.5"}`} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Variable Preview */}
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
              <VariablePreview
                subject={data.subject}
                body={data.body}
                recipientColumnData={recipientColumnData}
                recipients={data.to}
              />
            </div>
          </div>
        </div>
      </div>

      <SenderModal
        isOpen={isSenderModalOpen}
        onClose={() => setIsSenderModalOpen(false)}
        onSuccess={handleSenderUpdated}
        mode={senderModalMode}
        existingSender={
          senderModalMode === "verify" && selectedSender && !selectedSender.isVerified
            ? selectedSender
            : null
        }
      />

      {/* Template overwrite confirmation */}
      {pendingTemplate && (
        <Modal isOpen onClose={() => setPendingTemplate(null)}>
          <div className="p-6 text-center">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Replace current content?
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Your subject and body will be replaced with the &ldquo;{pendingTemplate.name}&rdquo; template.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1 rounded-lg"
                onClick={() => setPendingTemplate(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-lg"
                onClick={() => applyTemplate(pendingTemplate)}
              >
                Replace
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
