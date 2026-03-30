"use client";

import { useState, useEffect } from "react";

/**
 * SSR-safe media query hook.
 * Returns `false` during SSR and on first render to avoid hydration mismatch.
 * Resolves to the correct value on the client after mount.
 *
 * @param query - CSS media query string, e.g. "(min-width: 768px)"
 * @returns boolean indicating whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);

    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
