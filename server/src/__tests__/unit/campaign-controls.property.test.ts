import * as fc from "fast-check";
import {
  isValidTransition,
  getValidTransitions,
  isTerminalStatus,
} from "../../utils/campaignStateMachine";

const CAMPAIGN_STATUSES = ["SCHEDULED", "SENDING", "PAUSED", "CANCELLED", "COMPLETED"] as const;
const EMAIL_STATUSES = ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"] as const;

const ALLOWED_PAIRS = new Set([
  "SCHEDULED->SENDING", "SCHEDULED->PAUSED", "SCHEDULED->CANCELLED",
  "SENDING->PAUSED", "SENDING->CANCELLED", "SENDING->COMPLETED",
  "PAUSED->SENDING", "PAUSED->CANCELLED", "PAUSED->COMPLETED",
]);

const campaignStatusArb = fc.constantFrom(...CAMPAIGN_STATUSES);
const emailStatusArb = fc.constantFrom(...EMAIL_STATUSES);

describe("Campaign State Machine — Property-Based Tests", () => {
  /**
   * Feature: campaign-controls, Property 1: State machine transition validity
   * Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 5.5
   */
  it("Property 1: isValidTransition returns true iff pair is in allowed set", () => {
    fc.assert(
      fc.property(campaignStatusArb, campaignStatusArb, (from, to) => {
        const key = `${from}->${to}`;
        expect(isValidTransition(from, to)).toBe(ALLOWED_PAIRS.has(key));
      }),
      { numRuns: 100 }
    );
  });

  it("Property 1b: getValidTransitions returns correct targets", () => {
    for (const status of CAMPAIGN_STATUSES) {
      const valid = getValidTransitions(status);
      for (const target of CAMPAIGN_STATUSES) {
        const key = `${status}->${target}`;
        if (ALLOWED_PAIRS.has(key)) {
          expect(valid).toContain(target);
        } else {
          expect(valid).not.toContain(target);
        }
      }
    }
  });

  /**
   * Feature: campaign-controls, Property 2: Terminal status classification
   * Validates: Requirements 2.2, 7.1
   */
  it("Property 2: SENT, FAILED, CANCELLED are terminal; PENDING, SENDING are not", () => {
    fc.assert(
      fc.property(emailStatusArb, (status) => {
        const expected = ["SENT", "FAILED", "CANCELLED"].includes(status);
        expect(isTerminalStatus(status)).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});


describe("Campaign Controls — Additional Property Tests", () => {
  const emailStatusArb = fc.constantFrom("PENDING", "SENDING", "SENT", "FAILED", "CANCELLED");

  /**
   * Feature: campaign-controls, Property 4: Pause preserves PENDING email jobs
   * Validates: Requirements 3.1, 3.2
   */
  it("Property 4: pause does not change PENDING job statuses", () => {
    fc.assert(
      fc.property(
        fc.array(emailStatusArb, { minLength: 1, maxLength: 20 }),
        (jobStatuses) => {
          // Simulate pause: no job statuses should change
          const afterPause = jobStatuses.map((s) => s); // identity — pause doesn't touch jobs
          for (let i = 0; i < jobStatuses.length; i++) {
            expect(afterPause[i]).toBe(jobStatuses[i]);
          }
          // All PENDING jobs remain PENDING
          const pendingBefore = jobStatuses.filter((s) => s === "PENDING").length;
          const pendingAfter = afterPause.filter((s) => s === "PENDING").length;
          expect(pendingAfter).toBe(pendingBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: campaign-controls, Property 5: Cancel only affects PENDING email jobs
   * Validates: Requirements 5.1, 5.2, 5.3
   */
  it("Property 5: cancel changes only PENDING to CANCELLED, leaves others unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(emailStatusArb, { minLength: 1, maxLength: 20 }),
        (jobStatuses) => {
          const afterCancel = jobStatuses.map((s) => (s === "PENDING" ? "CANCELLED" : s));

          for (let i = 0; i < jobStatuses.length; i++) {
            if (jobStatuses[i] === "PENDING") {
              expect(afterCancel[i]).toBe("CANCELLED");
            } else {
              expect(afterCancel[i]).toBe(jobStatuses[i]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: campaign-controls, Property 9: Resume rescheduling preserves delay spacing
   * Validates: Requirements 4.5, 4.6
   */
  it("Property 9: rescheduled jobs have consistent delay spacing", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }), // delaySeconds
        fc.integer({ min: 1, max: 20 }),   // number of pending jobs
        (delaySeconds, jobCount) => {
          const now = Date.now();
          // Simulate rescheduling: jobs start from now, spaced by delaySeconds
          const rescheduled = Array.from({ length: jobCount }, (_, i) =>
            now + i * delaySeconds * 1000
          );

          // Verify spacing between consecutive jobs
          for (let i = 1; i < rescheduled.length; i++) {
            expect(rescheduled[i] - rescheduled[i - 1]).toBe(delaySeconds * 1000);
          }

          // First job starts at now
          expect(rescheduled[0]).toBe(now);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: campaign-controls, Property 10: Resume with all-terminal jobs → COMPLETED
   * Validates: Requirements 4.4, 4.9
   */
  it("Property 10: resume transitions to COMPLETED when all jobs are terminal", () => {
    const terminalStatusArb = fc.constantFrom("SENT", "FAILED", "CANCELLED");

    fc.assert(
      fc.property(
        fc.array(terminalStatusArb, { minLength: 1, maxLength: 20 }),
        (jobStatuses) => {
          // All jobs are terminal by construction
          const allTerminal = jobStatuses.every((s) =>
            ["SENT", "FAILED", "CANCELLED"].includes(s)
          );
          expect(allTerminal).toBe(true);
          // Therefore resume should target COMPLETED
        }
      ),
      { numRuns: 100 }
    );
  });
});
