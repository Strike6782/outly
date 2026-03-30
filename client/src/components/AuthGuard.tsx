"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/context/ToastContext";
import { PageLoader } from "@/components/PageLoader";

/**
 * AuthGuard — Protects routes from unauthenticated access.
 *
 * WHY branded loader: Instead of a generic spinner, we show the Outly logo
 * with a breathing animation. This reinforces the brand during the brief
 * auth check and prevents the flash of protected content.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { addToast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      // If a token existed but the auth check failed, the session expired
      const hadToken = typeof window !== "undefined" && localStorage.getItem("accessToken");
      if (hadToken) {
        localStorage.removeItem("accessToken");
        addToast("warning", "Session expired. Please sign in again.");
      }
      router.replace("/login");
    }
  }, [user, isLoading, router, addToast]);

  if (isLoading) {
    return <PageLoader message="Checking authentication..." />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
