"use client";

import { useEffect, useState } from "react";
import { getUser } from "../lib/apis";
import type { User } from "@/types";

/**
 * useAuth — fetches the authenticated user on mount.
 *
 * Returns { user, isLoading } where user is typed as User | null
 * instead of `any` for proper type safety across the app.
 */
export const useAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser();
        setUser(userData);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { user, isLoading };
};
