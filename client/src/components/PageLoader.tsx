"use client";

import { Mail } from "lucide-react";

/**
 * PageLoader — Full-page branded loader shown during auth checks
 * and initial data fetching.
 *
 * Features:
 * - Outly logo with breathing pulse animation
 * - Three-dot bounce animation below
 * - Subtle gradient background matching the app theme
 * - Centered vertically and horizontally
 */
export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f8f9fb]">
      {/* Logo with pulse */}
      <div className="relative mb-8">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20 animate-[breathe_2s_ease-in-out_infinite]">
          <Mail className="h-7 w-7 text-white" />
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
      </div>

      {/* Brand name */}
      <p className="text-lg font-bold text-gray-900 tracking-tight mb-2">Outly</p>

      {/* Loading message */}
      {message && (
        <p className="text-xs text-gray-400 mb-6">{message}</p>
      )}

      {/* Three-dot bounce */}
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
        <div className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <div className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}

/**
 * InlineLoader — Smaller loader for sections within a page
 * (e.g., email list loading, campaign list loading).
 *
 * Uses the same three-dot bounce but without the full-page backdrop.
 */
export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/10 to-emerald-100/50 flex items-center justify-center mb-4">
        <Mail className="h-5 w-5 text-primary/60 animate-pulse" />
      </div>
      {message && (
        <p className="text-sm text-gray-400 mb-4">{message}</p>
      )}
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-primary/30 animate-[bounce_1.4s_ease-in-out_infinite]" />
        <div className="h-1.5 w-1.5 rounded-full bg-primary/30 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <div className="h-1.5 w-1.5 rounded-full bg-primary/30 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}
