import fc from "fast-check";
import { formatRelativeTime } from "@/lib/utils";

/**
 * Feature: responsive-ui-redesign, Property 10: Mobile relative time formatting
 * For any valid timestamp, the mobile time formatting function should produce
 * a short relative string (e.g., "2h ago", "3d ago", "1m ago") that is no longer
 * than 10 characters, and should never return an empty string.
 * Validates: Requirements 16.2
 */

describe("formatRelativeTime property tests", () => {
  it("Property 10: output is never empty and at most 10 characters", () => {
    fc.assert(
      fc.property(
        // Generate timestamps from the past (0 to 365 days ago)
        fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }),
        (msAgo) => {
          const timestamp = new Date(Date.now() - msAgo).toISOString();
          const result = formatRelativeTime(timestamp);

          // Never empty
          expect(result.length).toBeGreaterThan(0);
          // At most 10 characters
          expect(result.length).toBeLessThanOrEqual(10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 10: output matches expected format pattern", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }),
        (msAgo) => {
          const timestamp = new Date(Date.now() - msAgo).toISOString();
          const result = formatRelativeTime(timestamp);

          // Should match one of: "now", "Xm ago", "Xh ago", "Xd ago"
          const validPattern = /^(now|\d+[mhd] ago)$/;
          expect(result).toMatch(validPattern);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns 'now' for very recent timestamps", () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result).toBe("now");
  });

  it("returns minutes for timestamps under 1 hour ago", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const result = formatRelativeTime(thirtyMinAgo);
    expect(result).toBe("30m ago");
  });

  it("returns hours for timestamps under 1 day ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toBe("2h ago");
  });

  it("returns days for timestamps over 1 day ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toBe("3d ago");
  });
});
