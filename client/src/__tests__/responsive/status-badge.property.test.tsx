import { render } from "@testing-library/react";
import fc from "fast-check";
import { EmailRow } from "@/components/EmailRow";

/**
 * Feature: responsive-ui-redesign, Property 11: Status badge color mapping
 * For any email status value in {PENDING, SENT, FAILED}, the EmailStatusBadge
 * should render with the correct color classes. The mapping should be exhaustive.
 * Validates: Requirements 16.3
 */

const statusColorMap: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "bg-amber-50", text: "text-amber-600" },
  SENT: { bg: "bg-emerald-50", text: "text-emerald-600" },
  FAILED: { bg: "bg-red-50", text: "text-red-600" },
};

describe("EmailStatusBadge property tests", () => {
  it("Property 11: correct color classes for any valid status", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("PENDING", "SENT", "FAILED"),
        (status) => {
          const { container, unmount } = render(
            <EmailRow
              email={{
                id: "1",
                toEmail: "test@example.com",
                status,
                sentAt: new Date().toISOString(),
                scheduledAt: new Date().toISOString(),
                isStarred: false,
              } as any}
              campaign={{ subject: "Test", body: "Body" } as any}
            />,
          );

          const badge = container.querySelector("[data-testid='email-status-badge']");
          expect(badge).toBeTruthy();

          const expected = statusColorMap[status];
          expect(badge!.className).toContain(expected.bg);
          expect(badge!.className).toContain(expected.text);
          expect(badge!.getAttribute("data-status")).toBe(status);

          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property 11: mapping is exhaustive — no status produces missing color", () => {
    const allStatuses = ["PENDING", "SENT", "FAILED"];

    allStatuses.forEach((status) => {
      const { container, unmount } = render(
        <EmailRow
          email={{
            id: "1",
            toEmail: "test@example.com",
            status,
            sentAt: new Date().toISOString(),
            scheduledAt: new Date().toISOString(),
            isStarred: false,
          } as any}
          campaign={{ subject: "Test", body: "Body" } as any}
        />,
      );

      const badge = container.querySelector("[data-testid='email-status-badge']");
      expect(badge).toBeTruthy();
      // Should not have default/fallback — should have one of the defined colors
      const hasColor = Object.values(statusColorMap).some(
        (c) => badge!.className.includes(c.bg) && badge!.className.includes(c.text),
      );
      expect(hasColor).toBe(true);

      unmount();
    });
  });
});
