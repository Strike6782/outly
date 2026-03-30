"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getSenders } from "@/lib/apis";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import type { SenderResponse } from "@/types";
import { AuthGuard } from "@/components/AuthGuard";
import { InlineLoader } from "@/components/PageLoader";
import { Sidebar } from "../Sidebar";
import { TopBar } from "../Topbar";
import { SidebarProvider } from "@/context/SidebarContext";
import Button from "@/components/Button";
import StatusBadge from "@/components/StatusBadge";
import CampaignControls from "@/components/CampaignControls";
import FilterPanel from "@/components/FilterPanel";
import FilterSummaryBar from "@/components/FilterSummaryBar";
import MatchHighlighter from "@/components/MatchHighlighter";
import {
  AlertCircle,
  Inbox,
  Send,
  Clock,
  Users,
  Calendar,
  Megaphone,
} from "lucide-react";

const CAMPAIGN_STATUS_OPTIONS = ["SCHEDULED", "SENDING", "PAUSED", "CANCELLED", "COMPLETED"];

export default function CampaignsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [label, setLabel] = useState<string>("Campaigns");
  const [senders, setSenders] = useState<SenderResponse[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const {
    filters, results, total, isLoading, error,
    setQuery, setFilter, clearFilter, clearAllFilters, refresh,
    activeFilterCount,
  } = useSearchFilters({ endpoint: "campaigns" });

  useEffect(() => {
    getSenders().then(setSenders).catch(() => {});
  }, []);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));

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

          <main className="flex flex-1 flex-col min-w-0">
            <TopBar
              placeholder="Search campaigns..."
              initialValue={filters.q}
              onSearch={setQuery}
              onRefresh={refresh}
              isRefreshing={isLoading}
              filterSlot={
                <FilterPanel
                  isOpen={isFilterOpen}
                  onToggle={() => setIsFilterOpen(!isFilterOpen)}
                  onClose={() => setIsFilterOpen(false)}
                  filters={filters}
                  onFilterChange={(key, value) => setFilter(key as any, value)}
                  onClearAll={clearAllFilters}
                  activeFilterCount={activeFilterCount}
                  senders={senders}
                  statusOptions={CAMPAIGN_STATUS_OPTIONS}
                />
              }
            />

            <FilterSummaryBar
              filters={filters}
              onRemoveFilter={(key) => clearFilter(key as any)}
              onClearAll={clearAllFilters}
              senders={senders}
            />

            <div className="px-3 md:px-6 py-3 md:py-4 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Campaigns</h1>
                <p className="text-xs text-gray-400">{total} campaign{total !== 1 ? "s" : ""}</p>
              </div>
              <Button className="w-auto px-4 py-2 rounded-lg text-xs" onClick={() => router.push("/dashboard/compose")}>
                New Campaign
              </Button>
            </div>

            {isLoading && results.length === 0 ? (
              <InlineLoader message="Loading campaigns..." />
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-300" />
                <p className="text-sm text-gray-500">{error}</p>
                <button onClick={refresh} className="text-sm text-primary hover:underline">Retry</button>
              </div>
            ) : results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="h-16 w-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <Megaphone className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {activeFilterCount > 0 ? "No matching campaigns" : "No campaigns yet"}
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mb-4">
                  {activeFilterCount > 0
                    ? "Try adjusting your filters or search query."
                    : "Create your first campaign to start sending cold outreach emails."}
                </p>
                {activeFilterCount === 0 && (
                  <Button className="w-auto px-5 py-2 rounded-lg text-xs" onClick={() => router.push("/dashboard/compose")}>
                    Create Campaign
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex-1 mx-3 md:mx-6 mb-3 md:mb-4 space-y-2 overflow-y-auto">
                {results.map((campaign: any) => (
                  <div
                    key={campaign.id}
                    className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => router.push(`/dashboard/campaigns/${campaign.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          <MatchHighlighter text={campaign.subject} query={filters.q} />
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          From: {campaign.sender?.email}
                        </p>
                      </div>
                      <StatusBadge status={campaign.status} pauseReason={campaign.pauseReason} />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-4 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {campaign.totalRecipients} recipient{campaign.totalRecipients !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(campaign.createdAt)}
                        </span>
                      </div>
                      <CampaignControls
                        campaignId={campaign.id}
                        status={campaign.status}
                        pendingCount={0}
                        subject={campaign.subject}
                        onStatusChange={() => refresh()}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </SidebarProvider>
    </AuthGuard>
  );
}
