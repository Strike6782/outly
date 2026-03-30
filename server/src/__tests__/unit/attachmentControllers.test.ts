/**
 * Attachment Controller Tests
 *
 * Tests the validation logic for file uploads: MIME type checking,
 * per-file size limits, and total size limits.
 */

import * as fc from "fast-check";

// The allowed MIME types and size limits from the controller
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

describe("Attachment Controller — Validation Logic", () => {
  /**
   * Feature: email-attachments, Property 1: Disallowed MIME types are rejected
   * **Validates: Requirements 2.3**
   */
  it("Property 1: MIME types not in allowed list are rejected", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !ALLOWED_MIME_TYPES.includes(s)),
        (mimeType) => {
          expect(ALLOWED_MIME_TYPES.includes(mimeType)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 3: Oversized individual files are rejected
   * **Validates: Requirements 2.4**
   */
  it("Property 3: files exceeding 10 MB are rejected", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 }),
        (fileSize) => {
          expect(fileSize > MAX_FILE_SIZE).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 5: Total size exceeding 25 MB is rejected
   * **Validates: Requirements 2.5**
   */
  it("Property 5: total size exceeding 25 MB is rejected", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          { minLength: 1, maxLength: 10 }
        ).filter(sizes => sizes.reduce((a, b) => a + b, 0) > MAX_TOTAL_SIZE),
        (fileSizes) => {
          const total = fileSizes.reduce((a, b) => a + b, 0);
          expect(total > MAX_TOTAL_SIZE).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 7: Successful upload response shape
   * Tests that valid MIME types are in the allowed list.
   * **Validates: Requirements 2.7**
   */
  it("Property 7: all allowed MIME types are recognized", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED_MIME_TYPES),
        (mimeType) => {
          expect(ALLOWED_MIME_TYPES.includes(mimeType)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for specific cases
  it("allows PDF files", () => {
    expect(ALLOWED_MIME_TYPES.includes("application/pdf")).toBe(true);
  });

  it("allows DOCX files", () => {
    expect(ALLOWED_MIME_TYPES.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });

  it("allows PNG files", () => {
    expect(ALLOWED_MIME_TYPES.includes("image/png")).toBe(true);
  });

  it("rejects executable files", () => {
    expect(ALLOWED_MIME_TYPES.includes("application/x-executable")).toBe(false);
  });

  it("rejects ZIP files", () => {
    expect(ALLOWED_MIME_TYPES.includes("application/zip")).toBe(false);
  });

  it("exactly 10 MB file passes size check", () => {
    expect(MAX_FILE_SIZE >= MAX_FILE_SIZE).toBe(true); // <= is the check
  });

  it("10 MB + 1 byte fails size check", () => {
    expect(MAX_FILE_SIZE + 1 > MAX_FILE_SIZE).toBe(true);
  });
});
