"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getCampaignById, toggleReplied } from "@/lib/apis";
import type { CampaignDetail } from "@/types";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "../../Sidebar";
import { TopBar } from "../../Topbar";
import { SidebarProvider } from "@/context/SidebarContext";
import StatusBadge from "@/components/StatusBadge";
import CampaignControls from "@/components/CampaignControls";
import SequenceView from "./SequenceView";
import SenderStats from "./SenderStats";
import ThrottlePanel from "./ThrottlePanel";
import TrackingTab from "./TrackingTab";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  AlertCircle,
  Inbox,
  Clock,
  Send,
  Users,
  Calendar,
  Mail,
  CheckCircle2,
  XCircle,
  Pause,
  MessageSquare,
  Filter,
  Ban,
  Layout,
  BarChart3,
  Loader2,
} from "lucide-react";

type CampaignStatus = "SCHEDULED" | "SENDING" | "PAUSED" | "CANCELLED" | "COMPLETED";

const POLL_INTERVAL_MS = 10_000;
const ACTIVE_STATUSES: CampaignStatus[] = ["SENDING", "SCHEDULED"];

export default function CampaignDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("Campaign");
  const [activeTab, setActiveTab] = useState<"emails" | "sequence" | "tracking">("emails");
  const [senderFilter, setSenderFilter] = useState<string>("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCampaign = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCampaignById(id);
      setCampaign(data);
    } catch {
      setError("Failed to load campaign.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  // Polling for live updates when campaign is active
  useEffect(() => {
    if (!campaign) return;

    const isActive = ACTIVE_STATUSES.includes(campaign.status as CampaignStatus);

    if (isActive) {
      pollRef.current = setInterval(async () => {
        try {
          const data = await getCampaignById(id);
          setCampaign(data);
        } catch {
          // Silent fail on poll — stale data shown until next poll
        }
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [campaign?.status, id]);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));

  const handleStatusChange = (newStatus: CampaignStatus) => {
    if (campaign) {
      setCampaign({ ...campaign, status: newStatus });
    }
  };

  const handleToggleReplied = async (emailId: string) => {
    try {
      const updated = await toggleReplied(emailId);
      if (campaign) {
        setCampaign({
          ...campaign,
          emails: campaign.emails.map((e) =>
            e.id === emailId ? { ...e, isReplied: updated.isReplied } : e
          ),
        });
      }
    } catch {
      // Silently fail — could add toast
    }
  };

  const repliedCount = campaign ? campaign.emails.filter((e) => e.isReplied).length : 0;

  // Determine if sender filter should be shown (multi-sender campaigns only)
  const showSenderFilter = campaign
    ? (campaign.senderPool?.length ?? 0) > 1
    : false;

  // Determine if sender stats should be shown
  const showSenderStats = campaign
    ? (campaign.senderStats?.length ?? 0) > 0
    : false;

  // Filter emails by selected sender
  const filteredEmails = campaign
    ? senderFilter === "all"
      ? campaign.emails
      : campaign.emails.filter((e) => e.senderId === senderFilter || e.sender?.id === senderFilter)
    : [];

  const statCards = campaign ? [
    { label: "Sent", count: campaign._count.sent, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Replied", count: repliedCount, icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Failed", count: campaign._count.failed, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
    { label: "Pending", count: campaign._count.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Cancelled", count: campaign._count.cancelled, icon: Ban, color: "text-gray-500", bg: "bg-gray-100" },
  ] : [];

  const emailStatusColor: Record<string, string> = {
    PENDING: "text-amber-600 bg-amber-50 border-amber-100",
    SENDING: "text-blue-600 bg-blue-50 border-blue-100",
    SENT: "text-emerald-600 bg-emerald-50 border-emerald-100",
    FAILED: "text-red-500 bg-red-50 border-red-100",
    CANCELLED: "text-gray-500 bg-gray-100 border-gray-200",
  };

  return (
    <AuthGuard>
      <SidebarProvider>
        <div className="flex h-screen bg-[#f8f9fb]">
          <Sidebar
            setLabel={setLabel}
            profile={{
              name: user?.name ?? "",
              email: user?.email ?? "",
              avatarUrl: user?.avatarUrl ?? "",
            }}
            items={[
              { label: "All", icon: <Inbox className="h-4 w-4" /> },
              { label: "Scheduled", icon: <Clock className="h-4 w-4" /> },
              { label: "Sent", icon: <Send className="h-4 w-4" /> },
            ]}
          />

          <main className="flex flex-1 flex-col min-w-0 overflow-y-auto">
            <TopBar placeholder="Search..." />

            {isLoading ? (
              <div className="flex-1 px-3 md:px-6 py-6 space-y-4">
                <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
                <div className="rounded-2xl bg-white border border-gray-100 p-6 animate-pulse">
                  <div className="h-5 w-2/3 bg-gray-100 rounded mb-3" />
                  <div className="h-4 w-1/3 bg-gray-50 rounded mb-6" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-20 bg-gray-50 rounded-xl" />
                    ))}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-300" />
                <p className="text-sm text-gray-500">{error}</p>
                <button onClick={fetchCampaign} className="text-sm text-primary hover:underline">Retry</button>
              </div>
            ) : campaign ? (
              <div className="px-3 md:px-6 py-4 md:py-6 space-y-4">
                {/* Back button */}
                <button
                  onClick={() => router.push("/dashboard/campaigns")}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to campaigns
                </button>

                {/* Campaign header card */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 md:p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg font-semibold text-gray-900 truncate">
                        {campaign.subject}
                      </h1>
                      <p className="text-xs text-gray-400 mt-1">
                        From: {campaign.sender.email}
                      </p>
                    </div>
                    <StatusBadge status={campaign.status} size="md" pauseReason={campaign.pauseReason} />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign.totalRecipients} recipients
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(campaign.startTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {campaign.delaySeconds}s delay
                    </span>
                  </div>

                  <CampaignControls
                    campaignId={campaign.id}
                    status={campaign.status}
                    pendingCount={campaign._count.pending}
                    subject={campaign.subject}
                    onStatusChange={handleStatusChange}
                    size="md"
                  />
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {statCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-xl bg-white border border-gray-100 shadow-sm p-3 flex items-center gap-2.5 transition-all hover:border-gray-200"
                    >
                      <div className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                        <card.icon className={`h-4 w-4 ${card.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-gray-900 leading-tight">{card.count}</p>
                        <p className="text-[10px] font-medium text-gray-400 truncate uppercase tracking-tight">{card.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Sender Stats — only for multi-sender campaigns with data */}
                {showSenderStats && (
                  <SenderStats senderStats={campaign.senderStats} />
                )}

                {/* Throttle Panel — live rate limit status */}
                <ThrottlePanel
                  campaignId={campaign.id}
                  isActive={ACTIVE_STATUSES.includes(campaign.status as CampaignStatus)}
                />

                {/* Tabs: Emails | Sequence | Tracking */}
                <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex border-b border-gray-100 bg-gray-50/30">
                    <button
                      className={cn(
                        "flex-1 px-5 py-4 text-xs font-bold transition-all relative flex items-center justify-center gap-2 tracking-tight",
                        activeTab === "emails"
                          ? "text-primary"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                      )}
                      onClick={() => setActiveTab("emails")}
                    >
                      <Mail className={cn("h-4 w-4", activeTab === "emails" ? "text-primary" : "text-gray-400")} />
                      <span>Emails ({campaign.emails.length})</span>
                      {activeTab === "emails" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-[stretch_0.2s_ease-out]" />
                      )}
                    </button>
                    <button
                      className={cn(
                        "flex-1 px-5 py-4 text-xs font-bold transition-all relative flex items-center justify-center gap-2 tracking-tight",
                        activeTab === "sequence"
                          ? "text-primary"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                      )}
                      onClick={() => setActiveTab("sequence")}
                    >
                      <Layout className={cn("h-4 w-4", activeTab === "sequence" ? "text-primary" : "text-gray-400")} />
                      <span>Sequence</span>
                      {activeTab === "sequence" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-[stretch_0.2s_ease-out]" />
                      )}
                    </button>
                    <button
                      className={cn(
                        "flex-1 px-5 py-4 text-xs font-bold transition-all relative flex items-center justify-center gap-2 tracking-tight",
                        activeTab === "tracking"
                          ? "text-primary"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50/50"
                      )}
                      onClick={() => setActiveTab("tracking")}
                    >
                      <BarChart3 className={cn("h-4 w-4", activeTab === "tracking" ? "text-primary" : "text-gray-400")} />
                      <span>Tracking</span>
                      {activeTab === "tracking" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-[stretch_0.2s_ease-out]" />
                      )}
                    </button>
                  </div>

                  {activeTab === "emails" ? (
                    <div>
                      {/* Sender filter dropdown — only for multi-sender campaigns */}
                      {showSenderFilter && (
                        <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
                          <Filter className="h-3.5 w-3.5 text-gray-400" />
                          <select
                            value={senderFilter}
                            onChange={(e) => setSenderFilter(e.target.value)}
                            className="text-sm text-gray-600 bg-transparent border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="all">All senders</option>
                            {campaign.senderPool.map((s) => (
                              <option key={s.senderId} value={s.senderId}>
                                {s.email}{s.name ? ` (${s.name})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="divide-y divide-gray-100/50">
                        {filteredEmails.map((email, index) => (
                          <div
                            key={email.id}
                            className="px-5 md:px-6 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-all group/row
                              opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]"
                            style={{ animationDelay: `${index * 40}ms` }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2.5 mb-1">
                                <p className="text-sm font-medium text-gray-600 truncate tracking-tight">{email.toEmail}</p>
                                {email.sender && (
                                  <span className="text-[10px] text-gray-400 truncate bg-gray-50 border border-gray-100/50 rounded-md px-1.5 py-0.5 group-hover/row:border-gray-200 transition-colors font-normal">
                                    via {email.sender.email}
                                  </span>
                                )}
                                {email.isReplied && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-600 shadow-sm">
                                    <MessageSquare className="h-2.5 w-2.5" /> Replied
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400/80 flex items-center gap-1.5 font-normal">
                                {email.status === "SENT" ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500/60" />
                                    {formatDate(email.sentAt!)}
                                  </>
                                ) : email.status === "FAILED" ? (
                                  <>
                                    <XCircle className="h-3 w-3 text-red-500/60" />
                                    Failed · {email.sentAt ? formatDate(email.sentAt) : formatDate(email.scheduledAt)}
                                  </>
                                ) : email.status === "SENDING" ? (
                                  <>
                                    <Loader2 className="h-3 w-3 text-blue-500/60 animate-spin" />
                                    Sending...
                                  </>
                                ) : email.status === "CANCELLED" ? (
                                  <>
                                    <Ban className="h-3 w-3 text-gray-400/60" />
                                    Cancelled · {formatDate(email.scheduledAt)}
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3 w-3 text-amber-500/60" />
                                    Scheduled · {formatDate(email.scheduledAt)}
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              {email.status === "SENT" && (
                                <button
                                  onClick={() => handleToggleReplied(email.id)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border shadow-sm",
                                    email.isReplied
                                      ? "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 hover:bg-gray-50"
                                  )}
                                >
                                  {email.isReplied ? "Replied" : "Mark Replied"}
                                </button>
                              )}
                              <div className="flex items-center gap-1.5 min-w-[60px] justify-end">
                                <div className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  email.status === "SENT" ? "bg-emerald-500" :
                                  email.status === "FAILED" ? "bg-red-500" :
                                  email.status === "SENDING" ? "bg-blue-500 animate-pulse" :
                                  email.status === "PENDING" ? "bg-amber-500" : "bg-gray-400"
                                )} />
                                <span className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider",
                                  email.status === "SENT" ? "text-emerald-600" :
                                  email.status === "FAILED" ? "text-red-500" :
                                  email.status === "SENDING" ? "text-blue-600" :
                                  email.status === "PENDING" ? "text-amber-600" : "text-gray-500"
                                )}>
                                  {email.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : activeTab === "sequence" ? (
                    <div className="p-4">
                      <SequenceView campaignId={campaign.id} />
                    </div>
                  ) : (
                    <TrackingTab campaignId={campaign.id} />
                  )}
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
