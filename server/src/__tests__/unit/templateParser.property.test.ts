import * as fc from "fast-check";
import {
  parseVariables,
  resolveVariables,
  printTemplate,
} from "../../utils/templateParser";

// Arbitrary that generates valid variable names: [a-z0-9_]+
const VAR_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789_".split("");
const varNameArb = fc
  .array(fc.constantFrom(...VAR_CHARS), { minLength: 1, maxLength: 20 })
  .map((chars: string[]) => chars.join(""));

describe("Template Parser — Property-Based Tests", () => {
  /**
   * Feature: email-templates, Property 1: Template content round-trip
   *
   * For any valid template content string (containing any mix of plain text,
   * HTML tags, and {{variable_name}} tokens), printing the template and then
   * parsing it back should produce content identical to the original.
   *
   * Validates: Requirements 6.3, 6.2, 1.2, 1.3
   */
  it("Property 1: printTemplate preserves content identity (round-trip)", () => {
    // Generate content that mixes plain text with valid {{var}} tokens
    const contentWithVarsArb = fc.array(
      fc.oneof(
        fc.string({ minLength: 0, maxLength: 50 }),
        varNameArb.map((name: string) => `{{${name}}}`)
      ),
      { minLength: 0, maxLength: 10 }
    ).map((parts) => parts.join(""));

    fc.assert(
      fc.property(contentWithVarsArb, (content) => {
        const printed = printTemplate(content);
        expect(printed).toBe(content);

        // Round-trip: variables extracted from printed content match original
        const varsFromOriginal = parseVariables(content);
        const varsFromPrinted = parseVariables(printed);
        expect(varsFromPrinted).toEqual(varsFromOriginal);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-templates, Property 2: Variable extraction correctness
   *
   * For any string containing zero or more {{variable_name}} tokens,
   * the parser should return exactly the set of unique variable names present,
   * with no duplicates and no false positives from malformed tokens.
   *
   * Validates: Requirements 6.1, 6.4
   */
  it("Property 2: parseVariables returns exactly the unique valid variable names", () => {
    // Generate a known set of variable names and embed them in content
    const testArb = fc.tuple(
      fc.uniqueArray(varNameArb, { minLength: 0, maxLength: 8 }),
      fc.string({ minLength: 0, maxLength: 30 })
    );

    fc.assert(
      fc.property(testArb, ([varNames, filler]) => {
        // Build content with known variables interspersed with filler
        const content = varNames
          .map((name) => `${filler}{{${name}}}`)
          .join(filler) + filler;

        const result = parseVariables(content);

        // Should contain exactly the variable names we embedded (as a set)
        expect(new Set(result)).toEqual(new Set(varNames));
        // No duplicates
        expect(result.length).toBe(new Set(result).size);
      }),
      { numRuns: 100 }
    );
  });

  it("Property 2b: parseVariables ignores malformed tokens", () => {
    // Malformed tokens that should NOT be extracted
    const malformedTokens = [
      "{{}}",           // empty
      "{{UPPER}}",      // uppercase
      "{{ spaced }}",   // spaces
      "{{has-dash}}",   // dash
      "{{has.dot}}",    // dot
      "{single}",       // single braces
      "{{MixedCase}}", // mixed case
    ];

    for (const token of malformedTokens) {
      const result = parseVariables(`before ${token} after`);
      expect(result).toEqual([]);
    }
  });

  it("parseVariables returns empty array for content with no variables", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.includes("{{") || !s.includes("}}")),
        (content) => {
          const result = parseVariables(content);
          // May or may not be empty depending on accidental matches,
          // but for strings without {{ or }}, should be empty
          if (!content.includes("{{")) {
            expect(result).toEqual([]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
