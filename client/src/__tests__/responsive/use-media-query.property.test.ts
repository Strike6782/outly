import { renderHook, act } from "@testing-library/react";
import fc from "fast-check";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Feature: responsive-ui-redesign
 * Property: useMediaQuery SSR safety
 * The hook must return false when matchMedia is unavailable (SSR)
 * and correctly reflect matchMedia state on the client.
 */

describe("useMediaQuery property tests", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns false when matchMedia is unavailable (SSR simulation)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        (width) => {
          // Remove matchMedia to simulate SSR
          // @ts-expect-error — intentionally removing for SSR test
          delete window.matchMedia;

          const { result } = renderHook(() =>
            useMediaQuery(`(min-width: ${width}px)`),
          );

          // Should always be false when matchMedia is unavailable
          expect(result.current).toBe(false);

          // Restore for cleanup
          window.matchMedia = originalMatchMedia;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns correct match state for any valid media query width", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.boolean(),
        (width, shouldMatch) => {
          // Mock matchMedia to return the expected match state
          window.matchMedia = jest.fn().mockImplementation((query: string) => ({
            matches: shouldMatch,
            media: query,
            onchange: null,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            dispatchEvent: jest.fn(),
          }));

          const { result } = renderHook(() =>
            useMediaQuery(`(min-width: ${width}px)`),
          );

          // After effect runs, should reflect the mocked match state
          expect(result.current).toBe(shouldMatch);

          // Restore
          window.matchMedia = originalMatchMedia;
        },
      ),
      { numRuns: 100 },
    );
  });
});
