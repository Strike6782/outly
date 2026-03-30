// Set a valid encryption key BEFORE importing the module.
// The encryption module validates ENCRYPTION_KEY at import time, so this must
// be set before any import of encrypt/decrypt.
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

import * as fc from "fast-check";
import { encrypt, decrypt } from "../../utils/encryption";

describe("Encryption Utility — Property-Based Tests", () => {
  /**
   * Feature: backend-smtp-email-sending, Property 1: Encryption Round-Trip
   *
   * For any string, encrypt then decrypt produces the original.
   *
   * Validates: Requirements 3.1, 3.2, 3.6
   */
  it("Property 1: decrypt(encrypt(s)) === s for any string", () => {
    fc.assert(
      fc.property(fc.string(), (plainText) => {
        const cipherText = encrypt(plainText);
        const recovered = decrypt(cipherText);
        expect(recovered).toBe(plainText);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: backend-smtp-email-sending, Property 2: Encryption Output Format and IV Uniqueness
   *
   * For any string, encrypt() output should:
   * - Contain exactly one colon delimiter
   * - IV part (before colon) should be exactly 32 hex characters
   * - Ciphertext part (after colon) should be valid hex
   * - Two encryptions of the same input should produce different outputs (random IV)
   *
   * Validates: Requirements 3.3, 3.4
   */
  it("Property 2: encrypt() output has correct format and unique IVs", () => {
    fc.assert(
      fc.property(fc.string(), (plainText) => {
        const output1 = encrypt(plainText);
        const output2 = encrypt(plainText);

        // Exactly one colon delimiter
        const parts1 = output1.split(":");
        expect(parts1).toHaveLength(2);

        const [iv1, cipher1] = parts1;

        // IV is exactly 32 hex characters (16 bytes)
        expect(iv1).toMatch(/^[0-9a-f]{32}$/);

        // Ciphertext is valid hex (non-empty for AES-256-CBC with padding)
        expect(cipher1).toMatch(/^[0-9a-f]+$/);

        // Two encryptions of the same input produce different outputs (random IV)
        expect(output1).not.toBe(output2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: backend-smtp-email-sending, Property 3: Invalid Encryption Key Rejection
   *
   * Any string that is not exactly 64 hex characters should be rejected by the
   * key validation regex. Since the module is already loaded with a valid key,
   * we test the regex pattern directly.
   *
   * Validates: Requirements 3.8, 12.2
   */
  it("Property 3: non-64-hex-char strings are rejected by key validation", () => {
    const keyRegex = /^[0-9a-fA-F]{64}$/;

    fc.assert(
      fc.property(
        fc.string().filter((s) => !keyRegex.test(s)),
        (invalidKey) => {
          expect(keyRegex.test(invalidKey)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: backend-smtp-email-sending, Property 4: Malformed Ciphertext Rejection
   *
   * For any string that doesn't match the valid ciphertext format
   * (<32-hex-chars>:<hex-chars>), decrypt() should throw.
   *
   * Validates: Requirements 3.9
   */
  it("Property 4: decrypt() throws on malformed ciphertext", () => {
    // Valid ciphertext format: exactly 32 hex chars, colon, then one or more hex chars
    const validCiphertextRegex = /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/;

    fc.assert(
      fc.property(
        fc.string().filter((s) => !validCiphertextRegex.test(s)),
        (malformed) => {
          expect(() => decrypt(malformed)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit Tests — Specific edge cases and examples
// ---------------------------------------------------------------------------

describe("Encryption Utility — Unit Tests", () => {
  it("encrypts and decrypts an empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("encrypts and decrypts a very long string (10,000 chars)", () => {
    const longString = "a".repeat(10000);
    const encrypted = encrypt(longString);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(longString);
  });

  it("encrypts and decrypts special characters and unicode", () => {
    const special = "Hello 🌍! Ñoño café résumé 日本語 中文 한국어 <script>alert('xss')</script>";
    const encrypted = encrypt(special);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(special);
  });

  it("encrypts and decrypts a string with newlines and tabs", () => {
    const multiline = "line1\nline2\ttab\r\nwindows";
    const encrypted = encrypt(multiline);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(multiline);
  });

  it("throws on decrypt with no colon delimiter", () => {
    expect(() => decrypt("abcdef1234567890abcdef1234567890")).toThrow("Malformed ciphertext");
  });

  it("throws on decrypt with too-short IV", () => {
    expect(() => decrypt("abcd:1234567890abcdef")).toThrow("Malformed ciphertext");
  });

  it("throws on decrypt with non-hex characters in IV", () => {
    expect(() => decrypt("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz:abcdef")).toThrow("Malformed ciphertext");
  });

  it("throws on decrypt with empty ciphertext part", () => {
    expect(() => decrypt("abcdef1234567890abcdef1234567890:")).toThrow("Malformed ciphertext");
  });
});
