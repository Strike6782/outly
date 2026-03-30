import * as fc from "fast-check";
import { resolveForRecipient } from "../../utils/variableResolver";
import { resolveVariables } from "../../utils/templateParser";

// Arbitrary that generates valid variable names: [a-z0-9_]+
const VAR_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_".split("");
const varNameArb = fc
  .array(fc.constantFrom(...VAR_CHARS), { minLength: 1, maxLength: 12 })
  .map((chars: string[]) => chars.join(""));

describe("Variable Resolver — Property-Based Tests", () => {
  /**
   * Feature: email-templates, Property 3: Variable resolution with case-insensitive matching
   *
   * For any template string containing {{variable_name}} tokens and for any
   * recipient data map where keys may differ in casing, the resolver should
   * substitute each token whose variable name matches a key (case-insensitively).
   *
   * Validates: Requirements 7.1, 7.3, 7.5
   */
  it("Property 3: resolves variables with case-insensitive key matching", () => {
    fc.assert(
      fc.property(
        varNameArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        (varName, value) => {
          const subject = `Hello {{${varName}}}`;
          const body = `<p>Dear {{${varName}}}, welcome</p>`;

          // Use UPPER-CASE key — should still match
          const recipientData = {
            email: "test@example.com",
            columnData: { [varName.toUpperCase()]: value },
          };

          const result = resolveForRecipient(subject, body, recipientData);

          expect(result.subject).toBe(`Hello ${value}`);
          expect(result.body).toBe(`<p>Dear ${value}, welcome</p>`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-templates, Property 4: Unmatched variables preserved
   *
   * For any template string containing {{variable_name}} tokens and for any
   * recipient data map that is missing those variable names, the resolver
   * should leave unmatched tokens as literal text.
   *
   * Validates: Requirements 7.4
   */
  it("Property 4: unmatched variables are left as-is", () => {
    fc.assert(
      fc.property(varNameArb, (varName) => {
        const subject = `Hi {{${varName}}}`;
        const body = `<p>{{${varName}}} content</p>`;

        // Empty columnData — no matches possible
        const recipientData = {
          email: "test@example.com",
          columnData: {},
        };

        const result = resolveForRecipient(subject, body, recipientData);

        expect(result.subject).toBe(`Hi {{${varName}}}`);
        expect(result.body).toBe(`<p>{{${varName}}} content</p>`);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-templates, Property 5: Independent per-recipient resolution
   *
   * For any template with variables and for any two recipients with different
   * column data values for the same variable, the resolver should produce
   * different resolved content for each recipient, and resolving for one
   * should not affect the result for the other.
   *
   * Validates: Requirements 7.2
   */
  it("Property 5: resolution is independent per recipient", () => {
    fc.assert(
      fc.property(
        varNameArb,
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (varName, value1, value2) => {
          // Skip if values are identical — can't verify independence
          fc.pre(value1 !== value2);

          const subject = `{{${varName}}} report`;
          const body = `<p>For {{${varName}}}</p>`;

          const recipient1 = {
            email: "a@example.com",
            columnData: { [varName]: value1 },
          };
          const recipient2 = {
            email: "b@example.com",
            columnData: { [varName]: value2 },
          };

          const result1 = resolveForRecipient(subject, body, recipient1);
          const result2 = resolveForRecipient(subject, body, recipient2);

          // Different values produce different output
          expect(result1.subject).toBe(`${value1} report`);
          expect(result2.subject).toBe(`${value2} report`);
          expect(result1.subject).not.toBe(result2.subject);

          // Resolving one doesn't affect the other
          const result1Again = resolveForRecipient(subject, body, recipient1);
          expect(result1Again).toEqual(result1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
