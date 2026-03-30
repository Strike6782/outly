import crypto from "crypto";

// ---------------------------------------------------------------------------
// Module-level key validation (runs at import time)
// ---------------------------------------------------------------------------
// WHY fail-fast on bad key: If the encryption key is missing or malformed,
// every encrypt/decrypt call would fail at runtime with cryptic errors.
// Validating at import time surfaces misconfiguration immediately on startup,
// before any data is processed — preventing silent runtime failures.
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required");
}

if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
  throw new Error(
    "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
  );
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // AES block size in bytes

/**
 * Encrypts a plain text string using AES-256-CBC.
 *
 * WHY random IV per encryption: A unique initialization vector for every call
 * ensures that encrypting the same plaintext twice produces different ciphertext.
 * Without this, an attacker could detect duplicate values in the database by
 * comparing encrypted blobs.
 *
 * @param plainText - The string to encrypt
 * @returns A string in the format "iv_hex:ciphertext_hex"
 */
export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypts a ciphertext string produced by `encrypt()`.
 *
 * WHY format validation in decrypt: Corrupted or tampered ciphertext could cause
 * the crypto library to throw opaque errors or, worse, return garbage data.
 * Validating the expected format (iv_hex:ciphertext_hex) up front gives callers
 * a clear, actionable error message instead.
 *
 * @param cipherText - A string in the format "iv_hex:ciphertext_hex"
 * @returns The original plain text string
 */
export function decrypt(cipherText: string): string {
  const parts = cipherText.split(":");

  if (parts.length !== 2) {
    throw new Error(
      "Malformed ciphertext: expected format 'iv_hex:ciphertext_hex'"
    );
  }

  const [ivHex, encryptedHex] = parts;

  // IV must be exactly 32 hex characters (16 bytes)
  if (ivHex.length !== 32) {
    throw new Error(
      "Malformed ciphertext: expected format 'iv_hex:ciphertext_hex'"
    );
  }

  // Both parts must be valid hexadecimal strings
  if (!/^[0-9a-fA-F]+$/.test(ivHex) || !/^[0-9a-fA-F]+$/.test(encryptedHex)) {
    throw new Error(
      "Malformed ciphertext: expected format 'iv_hex:ciphertext_hex'"
    );
  }

  const ivBuffer = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
