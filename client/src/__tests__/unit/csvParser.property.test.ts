import * as fc from "fast-check";
import { parseCsv, matchVariablesToColumns } from "@/lib/csvParser";

// Generate a simple email address
const emailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z]{1,8}$/),
    fc.stringMatching(/^[a-z]{1,6}$/),
    fc.constantFrom("com", "org", "net")
  )
  .map(([user, domain, tld]) => `${user}@${domain}.${tld}`);

// Generate a simple column header (no commas, no newlines)
const headerArb = fc.stringMatching(/^[a-zA-Z_]{1,10}$/);

// Generate a simple cell value (no commas, no newlines)
const cellArb = fc.stringMatching(/^[a-zA-Z0-9 ]{0,15}$/);

describe("CSV Parser — Property-Based Tests", () => {
  /**
   * Feature: email-templates, Property 9: CSV parsing extracts email and columnData
   *
   * For any valid CSV string with a header row, the CSV parser should extract
   * the email address from the first column of each data row and build a
   * columnData record from the remaining columns, keyed by the header names.
   *
   * Validates: Requirements 9.1, 9.2, 9.4
   */
  it("Property 9: parseCsv extracts email from first column and columnData from rest", () => {
    fc.assert(
      fc.property(
        // Generate 1-4 extra column headers
        fc.array(headerArb, { minLength: 1, maxLength: 4 }),
        // Generate 1-5 rows of data
        fc.array(
          fc.tuple(emailArb, fc.array(cellArb, { minLength: 1, maxLength: 4 })),
          { minLength: 1, maxLength: 5 }
        ),
        (extraHeaders, rows) => {
          // Build CSV string — pad cells to match header count
          const headerRow = ["email", ...extraHeaders].join(",");
          const dataRows = rows.map(([email, cells]) => {
            const paddedCells = extraHeaders.map((_, i) => cells[i] ?? "");
            return [email, ...paddedCells].join(",");
          });
          const csv = [headerRow, ...dataRows].join("\n");

          const result = parseCsv(csv);

          expect(result.length).toBe(rows.length);

          for (let i = 0; i < result.length; i++) {
            const [expectedEmail] = rows[i];
            expect(result[i].email).toBe(expectedEmail);

            // columnData keys should be a subset of extra headers
            for (const key of Object.keys(result[i].columnData)) {
              expect(extraHeaders).toContain(key);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-templates, Property 10: Variable-to-CSV column matching
   *
   * For any set of template variable names and any set of CSV column headers,
   * the matching function should correctly partition variables into matched
   * (has a corresponding CSV column, case-insensitive) and unmatched sets.
   *
   * Validates: Requirements 9.3
   */
  it("Property 10: matchVariablesToColumns correctly partitions matched and unmatched", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(headerArb, { minLength: 1, maxLength: 6 }),
        fc.uniqueArray(headerArb, { minLength: 1, maxLength: 6 }),
        (variables, columns) => {
          const { matched, unmatched } = matchVariablesToColumns(variables, columns);

          // Every variable should be in exactly one of matched or unmatched
          expect(matched.length + unmatched.length).toBe(variables.length);

          const lowerColumns = new Set(columns.map((c) => c.toLowerCase()));

          // All matched variables should have a corresponding column (case-insensitive)
          for (const v of matched) {
            expect(lowerColumns.has(v.toLowerCase())).toBe(true);
          }

          // All unmatched variables should NOT have a corresponding column
          for (const v of unmatched) {
            expect(lowerColumns.has(v.toLowerCase())).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
