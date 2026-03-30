"use client";

import { useState, useEffect, type RefObject } from "react";

/**
 * Hook that returns `true` when the referenced element is visible in the viewport.
 * Used for scroll-triggered animations on the Landing Page.
 *
 * @param ref - React ref attached to the target element
 * @param options - IntersectionObserver options (threshold, rootMargin, etc.)
 * @returns boolean indicating whether the element is intersecting
 */
export function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        // Once visible, stop observing (animation plays once)
        observer.unobserve(element);
      }
    }, options);

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
}
