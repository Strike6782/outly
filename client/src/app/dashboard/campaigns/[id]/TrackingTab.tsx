"use client";

import { useEffect, useState, useCallback } from "react";
import { getTrackingMetrics, getTrackingEmails, getTrackingLinks } from "@/lib/apis";
import type { TrackingMetrics, TrackingEmailDetail, TrackingLinkDetail } from "@/types";
import {
  Eye, MousePointerClick, Send, AlertTriangle, ExternalLink,
  ArrowUpDown, ChevronDown, EyeOff, Link2, Mail, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackingTabProps {
  campaignId: string;
}

function CircularProgress({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24 md:h-28 md:w-28">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={radius} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg md:text-xl font-bold text-gray-900">{value}%</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

type SortField = "openCount" | "clickCount" | "lastOpenAt" | "lastClickAt";
type SortDir = "asc" | "desc";

export default function TrackingTab({ campaignId }: TrackingTabProps) {
  const [metrics, setMetrics] = useState<TrackingMetrics | null>(null);
  const [emails, setEmails] = useState<TrackingEmailDetail[]>([]);
  const [links, setLinks] = useState<TrackingLinkDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("openCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeSection, setActiveSection] = useState<"emails" | "links">("emails");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, e, l] = await Promise.all([
        getTrackingMetrics(campaignId),
        getTrackingEmails(campaignId),
        getTrackingLinks(campaignId),
      ]);
      setMetrics(m);
      setEmails(e.emails);
      setLinks(l.links);
    } catch {
      setError("Failed to load tracking data");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedEmails = [...emails].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    const cmp = typeof aVal === "number"
      ? (aVal as number) - (bVal as number)
      : new Date(aVal as string).getTime() - new Date(bVal as string).getTime();
    return sortDir === "desc" ? -cmp : cmp;
  });

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }).format(new Date(iso));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-center gap-8">
          {[1, 2].map((i) => <div key={i} className="h-28 w-28 rounded-full bg-gray-100 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertTriangle className="h-8 w-8 text-red-300" />
        <p className="text-sm text-gray-500">{error}</p>
        <button onClick={fetchData} className="text-sm text-primary hover:underline">Retry</button>
      </div>
    );
  }

  if (!metrics) return null;

  // Tracking disabled state
  if (!metrics.trackOpens && !metrics.trackClicks) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center">
          <EyeOff className="h-6 w-6 text-gray-300" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">Tracking not enabled</h3>
        <p className="text-xs text-gray-400 max-w-xs text-center">
          Open and click tracking were disabled when this campaign was created.
        </p>
      </div>
    );
  }

  // No sent emails yet
  if (metrics.totalSent === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center">
          <Mail className="h-6 w-6 text-gray-300" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">No tracking data yet</h3>
        <p className="text-xs text-gray-400 max-w-xs text-center">
          Tracking data will appear here once emails are sent.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Headline metrics */}
      <div className="flex justify-center gap-8 md:gap-12">
        {metrics.trackOpens && (
          <CircularProgress value={metrics.openRate} label="Open Rate" color="#10b981" />
        )}
        {metrics.trackClicks && (
          <CircularProgress value={metrics.clickRate} label="Click Rate" color="#6366f1" />
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
          <Send className="h-3.5 w-3.5 text-gray-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{metrics.totalSent}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Sent</p>
        </div>
        {metrics.trackOpens && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
            <Eye className="h-3.5 w-3.5 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-700">{metrics.uniqueOpens}</p>
            <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Opens</p>
          </div>
        )}
        {metrics.trackClicks && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
            <MousePointerClick className="h-3.5 w-3.5 text-indigo-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-indigo-700">{metrics.uniqueClicks}</p>
            <p className="text-[10px] text-indigo-500 uppercase tracking-wider">Clicks</p>
          </div>
        )}
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-gray-100">
        <button
          className={cn(
            "flex-1 px-4 py-2.5 text-xs font-medium transition-colors",
            activeSection === "emails"
              ? "text-primary border-b-2 border-primary"
              : "text-gray-400 hover:text-gray-600"
          )}
          onClick={() => setActiveSection("emails")}
        >
          <Mail className="h-3.5 w-3.5 inline mr-1.5" />
          Per Email ({emails.length})
        </button>
        {metrics.trackClicks && (
          <button
            className={cn(
              "flex-1 px-4 py-2.5 text-xs font-medium transition-colors",
              activeSection === "links"
                ? "text-primary border-b-2 border-primary"
                : "text-gray-400 hover:text-gray-600"
            )}
            onClick={() => setActiveSection("links")}
          >
            <Link2 className="h-3.5 w-3.5 inline mr-1.5" />
            Per Link ({links.length})
          </button>
        )}
      </div>

      {/* Per-email table */}
      {activeSection === "emails" && (
        <div className="overflow-x-auto">
          {/* Mobile: card layout */}
          <div className="md:hidden space-y-2">
            {sortedEmails.map((email, i) => (
              <div
                key={email.emailJobId}
                className="rounded-xl border border-gray-100 p-3 space-y-2
                  opacity-0 animate-[fadeIn_0.15s_ease-out_forwards]"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <p className="text-xs font-medium text-gray-900 truncate">{email.toEmail}</p>
                <div className="flex items-center gap-3 text-[11px]">
                  {metrics.trackOpens && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Eye className="h-3 w-3" /> {email.openCount} opens
                    </span>
                  )}
                  {metrics.trackClicks && (
                    <span className="flex items-center gap-1 text-indigo-600">
                      <MousePointerClick className="h-3 w-3" /> {email.clickCount} clicks
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  {email.lastOpenAt && <span>Last open: {formatTime(email.lastOpenAt)}</span>}
                  {email.lastClickAt && <span>Last click: {formatTime(email.lastClickAt)}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="text-left py-2 px-3 font-medium">Recipient</th>
                {metrics.trackOpens && (
                  <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-gray-600" onClick={() => toggleSort("openCount")}>
                    <span className="inline-flex items-center gap-1">Opens <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                )}
                {metrics.trackClicks && (
                  <th className="text-center py-2 px-3 font-medium cursor-pointer hover:text-gray-600" onClick={() => toggleSort("clickCount")}>
                    <span className="inline-flex items-center gap-1">Clicks <ArrowUpDown className="h-3 w-3" /></span>
                  </th>
                )}
                <th className="text-right py-2 px-3 font-medium cursor-pointer hover:text-gray-600" onClick={() => toggleSort("lastOpenAt")}>
                  <span className="inline-flex items-center gap-1">Last Open <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="text-right py-2 px-3 font-medium cursor-pointer hover:text-gray-600" onClick={() => toggleSort("lastClickAt")}>
                  <span className="inline-flex items-center gap-1">Last Click <ArrowUpDown className="h-3 w-3" /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedEmails.map((email, i) => (
                <tr
                  key={email.emailJobId}
                  className="hover:bg-gray-50/50 transition-colors
                    opacity-0 animate-[fadeIn_0.15s_ease-out_forwards]"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <td className="py-2.5 px-3 text-xs text-gray-900 truncate max-w-[200px]">{email.toEmail}</td>
                  {metrics.trackOpens && (
                    <td className="py-2.5 px-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        email.openCount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-400"
                      )}>
                        {email.openCount}
                      </span>
                    </td>
                  )}
                  {metrics.trackClicks && (
                    <td className="py-2.5 px-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        email.clickCount > 0 ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-400"
                      )}>
                        {email.clickCount}
                      </span>
                    </td>
                  )}
                  <td className="py-2.5 px-3 text-right text-[11px] text-gray-400">{formatTime(email.lastOpenAt)}</td>
                  <td className="py-2.5 px-3 text-right text-[11px] text-gray-400">{formatTime(email.lastClickAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-link table */}
      {activeSection === "links" && (
        <div className="space-y-2">
          {links.length === 0 ? (
            <div className="text-center py-8">
              <Link2 className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No link clicks recorded yet</p>
            </div>
          ) : (
            links.map((link, i) => (
              <div
                key={link.url}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100
                  hover:border-gray-200 transition-all
                  opacity-0 animate-[fadeIn_0.15s_ease-out_forwards]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <ExternalLink className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-900 truncate">{link.url}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
                  <MousePointerClick className="h-3 w-3" />
                  {link.clickCount}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-gray-300 text-center leading-relaxed">
        Open tracking relies on image loading — some email clients block images by default, so open rates may undercount.
        Apple Mail Privacy Protection may inflate open rates by pre-fetching images.
      </p>
    </div>
  );
}
