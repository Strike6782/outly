"use client";

import { useRef, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SenderResponse } from "@/types";
import Dropdown from "./Dropdown";
import Button from "./Button";

interface FilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  filters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
  activeFilterCount: number;
  senders: SenderResponse[];
  statusOptions: string[];
  showDateField?: boolean;
}

const DATE_FIELD_OPTIONS = [
  { label: "Created", value: "createdAt" },
  { label: "Scheduled", value: "scheduledAt" },
  { label: "Sent", value: "sentAt" },
];

export default function FilterPanel({
  isOpen, onToggle, onClose, filters, onFilterChange, onClearAll,
  activeFilterCount, senders, statusOptions, showDateField,
}: FilterPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  const statusOpts = statusOptions.map((s) => ({ label: s, value: s }));
  const senderOpts = senders.map((s) => ({ label: s.name ? `${s.name} (${s.email})` : s.email, value: s.id }));

  return (
    <div ref={panelRef} className="relative">
      {/* Filter toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all",
          "hover:bg-gray-100",
          isOpen ? "bg-gray-100 text-gray-900" : "text-gray-500"
        )}
      >
        <Filter className="h-4 w-4" />
        <span className="hidden md:inline">Filters</span>
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <div
        className={cn(
          "absolute right-0 top-12 z-50 w-[340px] md:w-[380px] rounded-xl bg-white border border-gray-100 shadow-xl p-5",
          "origin-top-right transition-all duration-200 ease-out",
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Filters</h3>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Status */}
          <Dropdown
            label="Status"
            options={statusOpts}
            value={filters.status || ""}
            onChange={(v) => onFilterChange("status", v)}
            placeholder="All statuses"
          />

          {/* Sender */}
          <Dropdown
            label="Sender"
            options={senderOpts}
            value={filters.senderId || ""}
            onChange={(v) => onFilterChange("senderId", v)}
            placeholder="All senders"
          />

          {/* Date range */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.dateFrom || ""}
                onChange={(e) => onFilterChange("dateFrom", e.target.value)}
                className="flex-1 h-10 rounded-md bg-gray-100 px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
              <input
                type="date"
                value={filters.dateTo || ""}
                onChange={(e) => onFilterChange("dateTo", e.target.value)}
                className="flex-1 h-10 rounded-md bg-gray-100 px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              />
            </div>
          </div>

          {/* Date field selector */}
          {showDateField && (
            <Dropdown
              label="Date Field"
              options={DATE_FIELD_OPTIONS}
              value={filters.dateField || "createdAt"}
              onChange={(v) => onFilterChange("dateField", v)}
              placeholder="Created At"
            />
          )}

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              className="w-full text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={onClearAll}
            >
              Clear all filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
