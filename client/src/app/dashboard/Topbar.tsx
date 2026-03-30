"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, RefreshCw, Search, Bell, X } from "lucide-react";
import { useSidebar } from "@/hooks/useSidebar";

interface TopBarProps {
  placeholder?: string;
  initialValue?: string;
  rightActions?: React.ReactNode;
  // Search callback — filters emails by query string
  onSearch?: (query: string) => void;
  // Refresh callback — re-fetches data from the backend
  onRefresh?: () => void;
  // Whether a refresh is currently in progress
  isRefreshing?: boolean;
  // Filter options for the status filter dropdown
  filterOptions?: string[];
  // Currently active filter
  activeFilter?: string;
  // Filter change callback
  onFilterChange?: (filter: string) => void;
  // Render prop for filter panel slot
  filterSlot?: React.ReactNode;
}

export function TopBar({
  placeholder = "Search emails, campaigns...",
  initialValue = "",
  rightActions,
  onSearch,
  onRefresh,
  isRefreshing = false,
  filterSlot,
}: TopBarProps) {
  const { toggle } = useSidebar();
  const [searchValue, setSearchValue] = useState(initialValue);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Sync with external resets (like "Clear all" tags)
  useEffect(() => {
    setSearchValue(initialValue);
  }, [initialValue]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search — triggers after user stops typing for 300ms
  useEffect(() => {
    if (!onSearch) return;
    const timer = setTimeout(() => {
      onSearch(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, onSearch]);

  return (
    <div className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-[#f8f9fb]">
      {/* Hamburger — mobile sidebar toggle */}
      <button
        onClick={toggle}
        className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-900 hover:bg-white transition-all"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search — filters emails by recipient or subject */}
      <div className="relative flex-1 lg:max-w-lg">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[44px] rounded-xl bg-white border border-gray-200/60 py-2.5 pl-10 pr-10 text-sm text-gray-700 outline-none shadow-sm transition-all placeholder:text-gray-300 focus:border-primary/40 focus:ring-2 focus:ring-primary/10 focus:shadow-md"
        />
        {/* Clear search button */}
        {searchValue && (
          <button
            onClick={() => { setSearchValue(""); onSearch?.(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 md:gap-1">
        {/* Filter slot — rendered by parent */}
        {filterSlot}

        {/* Refresh button — spins while refreshing */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-10 w-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>

        {/* Notifications dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative h-10 w-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white hover:shadow-sm transition-all"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-[#f8f9fb]" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-72 rounded-xl bg-white border border-gray-200 shadow-lg animate-[fadeInUp_0.15s_ease-out]">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Notifications</p>
              </div>
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No new notifications</p>
                <p className="text-xs text-gray-300 mt-1">Campaign updates will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {rightActions}
    </div>
  );
}
