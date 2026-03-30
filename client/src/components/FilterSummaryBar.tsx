"use client";

import { X } from "lucide-react";
import type { SenderResponse } from "@/types";

interface FilterSummaryBarProps {
  filters: Record<string, string>;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
  senders?: SenderResponse[];
}

const FILTER_LABELS: Record<string, string> = {
  q: "Search",
  status: "Status",
  senderId: "Sender",
  starred: "Starred",
  dateFrom: "From",
  dateTo: "To",
  dateField: "Date field",
};

export default function FilterSummaryBar({
  filters, onRemoveFilter, onClearAll, senders = [],
}: FilterSummaryBarProps) {
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value && key !== "dateField"
  );

  if (activeFilters.length === 0) return null;

  const resolveValue = (key: string, value: string) => {
    if (key === "senderId") {
      const sender = senders.find((s) => s.id === value);
      return sender ? sender.email : value;
    }
    if (key === "starred") return "Yes";
    return value;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 md:px-6 py-2">
      {activeFilters.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-all hover:bg-gray-200"
        >
          <span className="text-gray-400">{FILTER_LABELS[key] || key}:</span>
          <span className="max-w-[120px] truncate">{resolveValue(key, value)}</span>
          <button
            onClick={() => onRemoveFilter(key)}
            className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <button
        onClick={onClearAll}
        className="text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors ml-1"
      >
        Clear all
      </button>
    </div>
  );
}
