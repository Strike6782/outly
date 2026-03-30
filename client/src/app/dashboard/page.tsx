"use client";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./Topbar";
import { EmailList } from "./EmailList";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSenders, toggleEmailStar } from "@/lib/apis";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import type { SenderResponse } from "@/types";
import { SidebarProvider } from "@/context/SidebarContext";
import { AuthGuard } from "@/components/AuthGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InlineLoader } from "@/components/PageLoader";
import FilterPanel from "@/components/FilterPanel";
import FilterSummaryBar from "@/components/FilterSummaryBar";
import {
  Inbox,
  Send,
  Clock,
  Star,
  TrendingDown,
  TrendingUp,
  Mail,
  AlertCircle,
  Users,
  Search,
  Zap,
  Activity,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EMAIL_STATUS_OPTIONS = ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"];

function AnalyticsWidget({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  trendType = "neutral",
  colorClass,
  showChart = false,
  progress,
  invertColor = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  trendType?: "positive" | "negative" | "neutral";
  colorClass: string;
  showChart?: boolean;
  progress?: number;
  invertColor?: boolean;
}) {
  const getRawColor = () => {
    const p = progress ?? 0;
    if (invertColor) {
      if (p > 90) return "red-500";
      if (p > 70) return "amber-500";
      return "emerald-500";
    }
    if (p > 90) return "emerald-500";
    if (p > 70) return "amber-500";
    return p > 0 ? "red-500" : "gray-400";
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-5 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-gray-200">
      <div className="flex items-start justify-between relative z-10 mb-5">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ring-white/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3", colorClass)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</span>
            <span className="text-[11px] font-semibold text-gray-900 leading-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">Live View</span>
          </div>
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset transition-all duration-300",
            trendType === "positive" ? "bg-emerald-50 text-emerald-600 ring-emerald-500/20" : 
            trendType === "negative" ? "bg-red-50 text-red-600 ring-red-500/20" : 
            "bg-gray-50 text-gray-500 ring-gray-200"
          )}>
            {trendType === "positive" ? <ArrowUpRight className="h-3 w-3" /> : trendType === "negative" ? <ArrowDownRight className="h-3 w-3" /> : null}
            {trend}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between relative z-10">
        <div className="space-y-1.5">
          <h3 className="text-2xl font-bold text-gray-800 tracking-tight leading-none tabular-nums">{value}</h3>
          {subValue && (
            <p className="text-[11px] font-medium text-gray-400 leading-tight flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-gray-300" />
              {subValue}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {progress !== undefined && (
            <div className="relative h-12 w-12 shrink-0 transition-transform duration-500 group-hover:scale-110">
              <svg className="h-full w-full" viewBox="0 0 40 40">
                {/* Background Ring */}
                <circle 
                  cx="20" cy="20" r="15.9155" 
                  fill="none" 
                  className="stroke-gray-100/70" 
                  strokeWidth="2" 
                />
                {/* Progress Ring */}
                <circle 
                  cx="20" cy="20" r="15.9155" 
                  fill="none" 
                  className={cn("transition-all duration-1000 ease-in-out animate-[pulse_2s_infinite]", `stroke-${getRawColor()}`)}
                  strokeWidth="2.5" 
                  strokeDasharray="100"
                  strokeDashoffset={100 - (progress === 0 && invertColor ? 2 : progress)}
                  strokeLinecap="round"
                  transform="rotate(-90 20 20)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-[10px] font-bold transition-colors duration-500", `text-${getRawColor()}`)}>
                  {progress}%
                </span>
              </div>
            </div>
          )}

          {showChart && (
            <div className="h-10 w-20 shrink-0 pt-1 opacity-20 group-hover:opacity-100 transition-all duration-500 group-hover:translate-x-1">
               <svg className="h-full w-full overflow-visible" viewBox="0 0 100 40">
                  <path 
                    d="M0 35 C 15 32, 25 38, 35 30 C 45 22, 55 35, 65 25 C 75 15, 85 20, 100 5" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="3.5" 
                    className={cn("transition-all duration-700", trendType === "positive" ? "text-emerald-500" : "text-indigo-400")}
                    strokeLinecap="round"
                  />
                  <path 
                    d="M0 35 C 15 32, 25 38, 35 30 C 45 22, 55 35, 65 25 C 75 15, 85 20, 100 5 V 40 H 0 Z" 
                    className={cn("opacity-10", trendType === "positive" ? "fill-emerald-500" : "fill-indigo-500")}
                  />
               </svg>
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative glass aura */}
      <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none" 
        style={{ background: `radial-gradient(circle, var(--tw-shadow-color) 0%, transparent 70%)` }} 
      />
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const [senders, setSenders] = useState<SenderResponse[]>([]);
  const [label, setLabel] = useState<string>("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const {
    filters, results, total, isLoading, error,
    setQuery, setFilter, setFilters, clearFilter, clearAllFilters, refresh,
    activeFilterCount,
  } = useSearchFilters({ endpoint: "emails" });

  useEffect(() => {
    getSenders().then(setSenders).catch(() => {});
  }, []);

  // Map sidebar nav labels to status filter values
  const handleSidebarItemClick = useCallback((itemLabel: string) => {
    if (itemLabel === "Starred") {
      setFilters({ status: "", starred: "true" });
    } else {
      const statusMap: Record<string, string> = {
        All: "",
        Scheduled: "PENDING",
        Sent: "SENT",
      };
      setFilters({ starred: "", status: statusMap[itemLabel] ?? "" });
    }
  }, [setFilters]);

  // Map search results to EmailList format
  const emailItems = results.map((r: any) => ({
    email: r,
    campaign: r.campaign,
    searchQuery: filters.q,
  }));

  const handleToggleStar = useCallback(async (emailId: string) => {
    try {
      await toggleEmailStar(emailId);
      refresh();
    } catch {}
  }, [refresh]);

  // Sync label with current filters for back-navigation/direct URL access
  useEffect(() => {
    if (filters.starred === "true") {
      setLabel("Starred");
    } else if (filters.status === "PENDING") {
      setLabel("Scheduled");
    } else if (filters.status === "SENT") {
      setLabel("Sent");
    } else if (!filters.status && !filters.starred) {
      setLabel("All");
    } else {
      setLabel("Custom");
    }
  }, [filters.status, filters.starred]);

  const stats = useMemo(() => {
    const sent = results.filter((r: any) => r.status === "SENT").length;
    const failed = results.filter((r: any) => r.status === "FAILED").length;
    const pending = results.filter((r: any) => r.status === "PENDING").length;
    const replied = results.filter((r: any) => r.isReplied).length;
    
    const totalAttempted = sent + failed;
    const efficiency = totalAttempted > 0 ? Math.round((sent / totalAttempted) * 100) : 100;
    const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";
    
    const capacity = senders.reduce((acc, s) => acc + s.dailyLimit, 0);
    const utilization = capacity > 0 ? Math.round((sent / capacity) * 100) : 0;
    
    return { sent, failed, pending, replied, efficiency, replyRate, capacity, utilization };
  }, [results, senders]);

  return (
    <AuthGuard>
      <ErrorBoundary>
      <SidebarProvider>
        <div className="flex h-screen bg-[#f8f9fb]">
          <Sidebar
            currentLabel={label}
            setLabel={setLabel}
            onItemClick={handleSidebarItemClick}
            profile={{
              name: user?.name ?? "",
              email: user?.email ?? "",
              avatarUrl: user?.avatarUrl ?? "",
            }}
            items={[
              { label: "All", count: total, icon: <Inbox className="h-4 w-4" /> },
              { label: "Starred", icon: <Star className="h-4 w-4" /> },
              { label: "Scheduled", icon: <Clock className="h-4 w-4" /> },
              { label: "Sent", icon: <Send className="h-4 w-4" /> },
            ]}
          />

          <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
            <TopBar
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
                  statusOptions={EMAIL_STATUS_OPTIONS}
                  showDateField
                />
              }
            />

            <FilterSummaryBar
              filters={filters}
              onRemoveFilter={(key) => clearFilter(key as any)}
              onClearAll={clearAllFilters}
              senders={senders}
            />

            {isLoading && results.length === 0 ? (
              <InlineLoader message="Loading your emails..." />
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-300" />
                <p className="text-sm text-gray-500">{error}</p>
                <button onClick={refresh} className="text-sm text-primary hover:underline">Retry</button>
              </div>
            ) : (
              <>
                <div className="px-3 md:px-6 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <AnalyticsWidget 
                    icon={Activity} 
                    label="Reach" 
                    value={total} 
                    subValue="Total database records"
                    trend={`${stats.pending} Pending`}
                    trendType="neutral"
                    showChart
                    colorClass="bg-indigo-600" 
                  />
                  <AnalyticsWidget 
                    icon={Inbox} 
                    label="Engagement" 
                    value={`${stats.replyRate}%`} 
                    subValue={`${stats.replied} total replies`}
                    trend="Live"
                    trendType="positive"
                    colorClass="bg-emerald-600" 
                  />
                  <AnalyticsWidget 
                    icon={ShieldCheck} 
                    label="Efficiency" 
                    value={`${stats.efficiency}%`}
                    subValue={`${stats.failed} delivery failures`}
                    trend={stats.efficiency > 95 ? "Perfect" : "Stable"}
                    trendType={stats.efficiency > 90 ? "positive" : "neutral"}
                    progress={stats.efficiency}
                    colorClass="bg-violet-600" 
                  />
                  <AnalyticsWidget 
                    icon={Zap} 
                    label="Utilization" 
                    value={stats.capacity} 
                    subValue="Daily sending threshold"
                    trend={`${senders.length} active`}
                    progress={stats.utilization}
                    invertColor
                    colorClass="bg-amber-500" 
                  />
                </div>

                <div className="px-5 md:px-8 mt-4 mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 tracking-tight">Feed</h2>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest leading-none mt-1">
                        {total} {total === 1 ? 'Email' : 'Emails'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 mx-5 md:mx-8 mb-8 rounded-3xl bg-white border border-gray-100/80 shadow-[0_8px_40px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col min-h-0">
                  <EmailList
                    emails={emailItems}
                    onToggleStar={handleToggleStar}
                  />
                </div>
              </>
            )}
          </main>
        </div>
      </SidebarProvider>
      </ErrorBoundary>
    </AuthGuard>
  );
};

export default Dashboard;
