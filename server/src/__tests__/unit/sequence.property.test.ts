import * as fc from "fast-check";
import { validateSequenceSteps, SequenceStepInput } from "../../utils/sequenceValidation";

// Valid step arbitrary
const validStepArb: fc.Arbitrary<SequenceStepInput> = fc.record({
  subject: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  body: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  waitDays: fc.integer({ min: 1, max: 30 }),
});

describe("Sequence Validation — Property-Based Tests", () => {
  /**
   * Feature: follow-up-sequences, Property 5: Step validation rejects invalid inputs
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
   */
  it("Property 5: rejects arrays with > 5 steps", () => {
    fc.assert(
      fc.property(
        fc.array(validStepArb, { minLength: 6, maxLength: 10 }),
        (steps) => {
          const result = validateSequenceSteps(steps);
          expect(result.valid).toBe(false);
          expect(result.message).toContain("Maximum of 5");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5b: rejects steps with empty subject", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (waitDays, body) => {
          const result = validateSequenceSteps([{ subject: "", body, waitDays }]);
          expect(result.valid).toBe(false);
          expect(result.message).toContain("Subject is required");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5c: rejects steps with waitDays < 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 0 }),
        (waitDays) => {
          const result = validateSequenceSteps([
            { subject: "Hi", body: "<p>Body</p>", waitDays },
          ]);
          expect(result.valid).toBe(false);
          expect(result.message).toContain("whole number");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5d: rejects steps with non-integer waitDays", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 30, noNaN: true }).filter((n) => !Number.isInteger(n)),
        (waitDays) => {
          const result = validateSequenceSteps([
            { subject: "Hi", body: "<p>Body</p>", waitDays },
          ]);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: follow-up-sequences, Property 1: Step count invariant
   * Validates: Requirements 1.1
   */
  it("Property 1: accepts 0-5 valid follow-up steps", () => {
    fc.assert(
      fc.property(
        fc.array(validStepArb, { minLength: 0, maxLength: 5 }),
        (steps) => {
          const result = validateSequenceSteps(steps);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: follow-up-sequences, Property 3: Sequence step round-trip serialization
   * Validates: Requirements 10.5
   */
  it("Property 3: JSON round-trip preserves step data", () => {
    fc.assert(
      fc.property(validStepArb, (step) => {
        const json = JSON.stringify(step);
        const parsed = JSON.parse(json) as SequenceStepInput;
        expect(parsed.subject).toBe(step.subject);
        expect(parsed.body).toBe(step.body);
        expect(parsed.waitDays).toBe(step.waitDays);
      }),
      { numRuns: 100 }
    );
  });
});
