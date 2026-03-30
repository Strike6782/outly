"use client";

import { useState } from "react";
import type { SenderStat } from "@/types";
import { Mail, CheckCircle2, XCircle, Clock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SenderStatsProps {
  senderStats: SenderStat[];
}

export default function SenderStats({ senderStats }: SenderStatsProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (senderStats.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 md:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Sender Distribution</h2>
        <p className="text-sm text-gray-400 mt-2">No sender data available</p>
      </div>
    );
  }

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
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
            <Mail className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Sender Distribution</p>
            <p className="text-[11px] text-gray-400">
              Usage breakdown for {senderStats.length} {senderStats.length === 1 ? "sender" : "senders"}
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-gray-300 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </div>

      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-4 border-t border-gray-50 pt-4">
          {senderStats.map((stat, idx) => {
            const rawPercent = stat.dailyLimit > 0 ? (stat.sent / stat.dailyLimit) * 100 : 0;
            const usagePercent = Math.min(rawPercent, 100);
            const displayPercent = usagePercent > 0 && usagePercent < 1 
              ? usagePercent.toFixed(1) 
              : Math.round(usagePercent);

            return (
              <div key={stat.senderId} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-3 transition-colors hover:border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                      <Mail className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{stat.email}</p>
                      {stat.name && (
                        <p className="text-[11px] text-gray-400 truncate">{stat.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-semibold text-gray-900">{stat.sent} / {stat.dailyLimit}</p>
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">Daily Limit</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold text-emerald-600 bg-white border border-emerald-100 shadow-sm">
                    <CheckCircle2 className="h-3 w-3" />
                    {stat.sent} sent
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold text-red-500 bg-white border border-red-100 shadow-sm">
                    <XCircle className="h-3 w-3" />
                    {stat.failed} failed
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold text-gray-500 bg-white border border-gray-100 shadow-sm">
                    <Clock className="h-3 w-3" />
                    {stat.pending} pending
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 font-medium">Daily Limit Usage</span>
                    <span className={cn(
                      "font-bold",
                      usagePercent > 90 ? "text-red-500" : usagePercent > 70 ? "text-amber-500" : "text-emerald-600"
                    )}>
                      {displayPercent}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200/50 rounded-full overflow-hidden p-0.5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,0,0,0.05)]",
                        usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.max(usagePercent, usagePercent > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
