"use client";

import { useEffect, useState, useCallback } from "react";
import { getCampaignThrottleStatus } from "@/lib/apis";
import {
  Gauge, Activity, Shield, Snowflake, Flame,
  RefreshCw, ChevronDown, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ThrottleSender {
  senderId: string;
  email: string;
  name: string | null;
  currentHourlyCount: number;
  currentDailyCount: number;
  effectiveLimits: { perMinute: number; perHour: number; perDay: number };
  warmupStatus: string;
  cooldownState: { status: string; expiresAt: string | null };
}

interface ThrottlePanelProps {
  campaignId: string;
  isActive: boolean;
}

const WARMUP_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-amber-50", text: "text-amber-600", label: "Warming Up" },
  "opted-out": { bg: "bg-gray-100", text: "text-gray-500", label: "Skipped" },
  inactive: { bg: "bg-emerald-50", text: "text-emerald-600", label: "Complete" },
};

export default function ThrottlePanel({ campaignId, isActive }: ThrottlePanelProps) {
  const [senders, setSenders] = useState<ThrottleSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThrottle = useCallback(async () => {
    try {
      setError(null);
      const data = await getCampaignThrottleStatus(campaignId);
      setSenders(data.senders);
    } catch {
      setError("Failed to load throttle data");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (isOpen) fetchThrottle();
  }, [isOpen, fetchThrottle]);

  // Auto-refresh every 30s when open and campaign is active
  useEffect(() => {
    if (!isOpen || !isActive) return;
    const interval = setInterval(fetchThrottle, 30_000);
    return () => clearInterval(interval);
  }, [isOpen, isActive, fetchThrottle]);

  const getUsagePercent = (current: number, limit: number) =>
    limit > 0 ? Math.min(Math.round((current / limit) * 100), 100) : 0;

  const getBarColor = (percent: number) => {
    if (percent >= 90) return "bg-red-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsOpen(!isOpen); } }}
        className="w-full flex items-center justify-between px-5 md:px-6 py-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Throttle Status</p>
            <p className="text-[11px] text-gray-400">Live rate limits per sender</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && !isLoading && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchThrottle(); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn(
            "h-4 w-4 text-gray-300 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </div>
      </div>

      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-4 border-t border-gray-50 pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : senders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No sender data available</p>
          ) : (
            senders.map((sender) => {
              const hourlyPercent = getUsagePercent(sender.currentHourlyCount, sender.effectiveLimits.perHour);
              const dailyPercent = getUsagePercent(sender.currentDailyCount, sender.effectiveLimits.perDay);
              const warmup = WARMUP_COLORS[sender.warmupStatus] ?? WARMUP_COLORS.inactive;
              const isCooldown = sender.cooldownState.status === "active";

              return (
                <div
                  key={sender.senderId}
                  className={cn(
                    "rounded-xl border p-4 space-y-3 transition-all duration-200",
                    isCooldown ? "border-blue-200 bg-blue-50/30" : "border-gray-100 bg-gray-50/50"
                  )}
                >
                  {/* Sender header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Gauge className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">{sender.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Warmup badge */}
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        warmup.bg, warmup.text
                      )}>
                        {sender.warmupStatus === "active" && <Flame className="h-2.5 w-2.5" />}
                        {warmup.label}
                      </span>
                      {/* Cooldown badge */}
                      {isCooldown && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          <Snowflake className="h-2.5 w-2.5" />
                          Cooldown
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hourly usage */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-500">Hourly</span>
                      <span className="text-[11px] font-semibold text-gray-700">
                        {sender.currentHourlyCount} / {sender.effectiveLimits.perHour}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", getBarColor(hourlyPercent))}
                        style={{ width: `${hourlyPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Daily usage */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-500">Daily</span>
                      <span className="text-[11px] font-semibold text-gray-700">
                        {sender.currentDailyCount} / {sender.effectiveLimits.perDay}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", getBarColor(dailyPercent))}
                        style={{ width: `${dailyPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Per-minute limit info */}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Shield className="h-2.5 w-2.5" />
                      {sender.effectiveLimits.perMinute}/min
                    </span>
                    {isCooldown && sender.cooldownState.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Snowflake className="h-2.5 w-2.5" />
                        Expires {new Date(sender.cooldownState.expiresAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
