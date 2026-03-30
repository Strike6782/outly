"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "@/lib/axios";

export interface SearchFilters {
  [key: string]: string;
  q: string;
  status: string;
  senderId: string;
  dateFrom: string;
  dateTo: string;
  dateField: string;
  starred: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  q: "", status: "", senderId: "", dateFrom: "", dateTo: "", dateField: "createdAt", starred: "",
};

interface UseSearchFiltersOptions {
  endpoint: "emails" | "campaigns";
  defaultDateField?: string;
}

export function useSearchFilters({ endpoint, defaultDateField = "createdAt" }: UseSearchFiltersOptions) {
  const [filters, setFilters] = useState<SearchFilters>(() => {
    if (typeof window === "undefined") return { ...DEFAULT_FILTERS, dateField: defaultDateField };
    const params = new URLSearchParams(window.location.search);
    
    const rawStatus = params.get("status") || "";
    const rawStarred = params.get("starred") || "";

    // Endpoint-specific validation
    let status = rawStatus;
    let starred = rawStarred;

    if (endpoint === "campaigns") {
      starred = ""; // Campaigns don't support starred
      const validCampaignStatuses = ["SCHEDULED", "SENDING", "PAUSED", "CANCELLED", "COMPLETED"];
      if (status && !validCampaignStatuses.includes(status)) status = "";
    } else {
      const validEmailStatuses = ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"];
      if (status && !validEmailStatuses.includes(status)) status = "";
    }

    return {
      q: params.get("q") || "",
      status,
      senderId: params.get("senderId") || "",
      dateFrom: params.get("dateFrom") || "",
      dateTo: params.get("dateTo") || "",
      dateField: params.get("dateField") || defaultDateField,
      starred,
    };
  });

  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.q) count++;
    if (filters.status) count++;
    if (filters.senderId) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.starred) count++;
    return count;
  }, [filters]);

  const syncUrl = useCallback((f: SearchFilters) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.status) params.set("status", f.status);
    if (f.senderId) params.set("senderId", f.senderId);
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo) params.set("dateTo", f.dateTo);
    if (f.dateField && f.dateField !== "createdAt") params.set("dateField", f.dateField);
    if (f.starred) params.set("starred", f.starred);
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }, []);

  const fetchResults = useCallback(async (f: SearchFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (f.q) params.set("q", f.q);
      if (f.status) params.set("status", f.status);
      if (f.senderId) params.set("senderId", f.senderId);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.dateField) params.set("dateField", f.dateField);
      if (f.starred) params.set("starred", f.starred);

      const url = endpoint === "emails" ? "/emails/search" : "/campaigns/search";
      const res = await api.get(`${url}?${params.toString()}`, { signal: controller.signal });
      setResults(res.data.results);
      setTotal(res.data.total);
    } catch (err: any) {
      if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
        setError("Search failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  // Initial fetch and URL sync
  useEffect(() => {
    syncUrl(filters);
    fetchResults(filters);
    return () => abortRef.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setQuery = useCallback((q: string) => {
    if (filters.q === q) return;
    const newFilters = { ...filters, q };
    setFilters(newFilters);
    syncUrl(newFilters);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      // Immediate dispatch on clear
      fetchResults(newFilters);
    } else {
      debounceRef.current = setTimeout(() => fetchResults(newFilters), 300);
    }
  }, [filters, syncUrl, fetchResults]);

  const setFilter = useCallback((key: keyof SearchFilters, value: string) => {
    if (filters[key] === value) return;
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    syncUrl(newFilters);
    fetchResults(newFilters);
  }, [filters, syncUrl, fetchResults]);

  const setMultipleFilters = useCallback((updates: Partial<SearchFilters>) => {
    const newFilters = { ...filters, ...updates } as SearchFilters;
    // Check if anything actually changed
    const hasChanges = Object.entries(updates).some(([key, val]) => filters[key as keyof SearchFilters] !== val);
    if (!hasChanges) return;

    setFilters(newFilters);
    syncUrl(newFilters);
    fetchResults(newFilters);
  }, [filters, syncUrl, fetchResults]);

  const clearFilter = useCallback((key: keyof SearchFilters) => {
    const defaultVal = key === "dateField" ? "createdAt" : "";
    setFilter(key, defaultVal);
  }, [setFilter]);

  const clearAllFilters = useCallback(() => {
    const cleared: SearchFilters = { ...DEFAULT_FILTERS, dateField: defaultDateField };
    setFilters(cleared);
    syncUrl(cleared);
    fetchResults(cleared);
  }, [defaultDateField, syncUrl, fetchResults]);

  const refresh = useCallback(() => fetchResults(filters), [filters, fetchResults]);

  return {
    filters, results, total, isLoading, error,
    setQuery, setFilter, setFilters: setMultipleFilters, clearFilter, clearAllFilters, refresh,
    activeFilterCount,
  };
}
