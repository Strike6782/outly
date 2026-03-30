"use client";

import { useContext } from "react";
import { SidebarContext, type SidebarContextValue } from "@/context/SidebarContext";

/**
 * Convenience hook for accessing sidebar state.
 * Must be used within a SidebarProvider.
 */
export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
