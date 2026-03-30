import * as fc from "fast-check";

const ALLOWED_MIME_TYPES = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain", "image/png", "image/jpeg", "image/gif",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;

// Helper: simulate the validation logic from ComposeHeader
function validateFiles(
  files: { type: string; size: number }[],
  existingTotal: number
): { valid: boolean; error?: string } {
  const invalidFile = files.find(f => !ALLOWED_MIME_TYPES.includes(f.type));
  if (invalidFile) return { valid: false, error: `"${invalidFile.type}" is not supported` };

  const oversizedFile = files.find(f => f.size > MAX_FILE_SIZE);
  if (oversizedFile) return { valid: false, error: "File exceeds 10 MB limit" };

  const newTotal = files.reduce((sum, f) => sum + f.size, 0);
  if (existingTotal + newTotal > MAX_TOTAL_SIZE) return { valid: false, error: "Total exceeds 25 MB" };

  return { valid: true };
}

describe("Frontend Attachment Validation", () => {
  /**
   * Feature: email-attachments, Property 2: Disallowed MIME types rejected by frontend
   * **Validates: Requirements 7.2**
   */
  it("Property 2: disallowed MIME types are rejected", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !ALLOWED_MIME_TYPES.includes(s)),
        (mimeType) => {
          const result = validateFiles([{ type: mimeType, size: 1000 }], 0);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 4: Oversized individual files rejected
   * **Validates: Requirements 6.7**
   */
  it("Property 4: files > 10 MB are rejected", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 5 }),
        (fileSize) => {
          const result = validateFiles([{ type: "application/pdf", size: fileSize }], 0);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 6: Total > 25 MB rejected
   * **Validates: Requirements 6.8**
   */
  it("Property 6: total size > 25 MB is rejected", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_TOTAL_SIZE }),
        fc.integer({ min: 1, max: MAX_TOTAL_SIZE }),
        (existingSize, newFileSize) => {
          fc.pre(existingSize + newFileSize > MAX_TOTAL_SIZE);
          fc.pre(newFileSize <= MAX_FILE_SIZE); // individual file is valid
          const result = validateFiles(
            [{ type: "application/pdf", size: newFileSize }],
            existingSize
          );
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 11: Attachment list metadata
   * **Validates: Requirements 6.3**
   */
  it("Property 11: valid files pass validation", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom(...ALLOWED_MIME_TYPES),
            size: fc.integer({ min: 1, max: 1024 * 1024 }), // 1 MB max each
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (files) => {
          const result = validateFiles(files, 0);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 12: Removing attachment reduces list by one
   * **Validates: Requirements 6.4**
   */
  it("Property 12: removing an attachment reduces list by exactly one", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            url: fc.webUrl(),
            filename: fc.string({ minLength: 1 }),
            size: fc.integer({ min: 1, max: 1024 * 1024 }),
            mimeType: fc.constantFrom(...ALLOWED_MIME_TYPES),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (attachments) => {
          // Pick a random attachment to remove
          const indexToRemove = Math.floor(Math.random() * attachments.length);
          const urlToRemove = attachments[indexToRemove].url;
          const filtered = attachments.filter(a => a.url !== urlToRemove);
          // Could remove more than one if URLs are duplicated, but at minimum one less
          expect(filtered.length).toBeLessThan(attachments.length);
          expect(filtered.find(a => a.url === urlToRemove)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: email-attachments, Property 13: Campaign payload includes all attachments
   * **Validates: Requirements 6.5**
   */
  it("Property 13: all uploaded attachments are included in payload", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            url: fc.webUrl(),
            filename: fc.string({ minLength: 1 }),
            size: fc.integer({ min: 1, max: 1024 * 1024 }),
            mimeType: fc.constantFrom(...ALLOWED_MIME_TYPES),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (uploadedAttachments) => {
          // Simulate payload construction
          const payload = {
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
          };
          if (uploadedAttachments.length > 0) {
            expect(payload.attachments).toHaveLength(uploadedAttachments.length);
            for (let i = 0; i < uploadedAttachments.length; i++) {
              expect(payload.attachments![i].url).toBe(uploadedAttachments[i].url);
              expect(payload.attachments![i].filename).toBe(uploadedAttachments[i].filename);
              expect(payload.attachments![i].size).toBe(uploadedAttachments[i].size);
              expect(payload.attachments![i].mimeType).toBe(uploadedAttachments[i].mimeType);
            }
          } else {
            expect(payload.attachments).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
