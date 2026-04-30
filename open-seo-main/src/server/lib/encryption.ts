/**
 * Credential Encryption Utilities
 * Phase 54-01: Multi-Provider Payments
 *
 * AES-256-GCM encryption for payment provider credentials.
 * Uses PAYMENT_ENCRYPTION_KEY environment variable.
 *
 * Security:
 * - AES-256-GCM provides authenticated encryption
 * - Random IV for each encryption (12 bytes)
 * - Auth tag prevents tampering (16 bytes)
 * - Key never logged or exposed
 *
 * Format: base64(iv:ciphertext:authTag)
 */
import * as crypto from "crypto";
import { getRequiredEnvValueSync } from "./runtime-env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment.
 * Must be a base64-encoded 32-byte (256-bit) key.
 *
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * @throws Error if PAYMENT_ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = getRequiredEnvValueSync("PAYMENT_ENCRYPTION_KEY");
  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== 32) {
    throw new Error(
      `PAYMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key. ` +
        `Got ${key.length} bytes after decoding. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }

  return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded ciphertext in format: iv:ciphertext:authTag
 * @throws Error if PAYMENT_ENCRYPTION_KEY is not configured
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine iv + ciphertext + authTag and base64 encode
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString("base64");
}

/**
 * Decrypt a ciphertext string encrypted with encryptCredential.
 *
 * @param ciphertext - Base64-encoded ciphertext from encryptCredential
 * @returns The original plaintext string
 * @throws Error if decryption fails (wrong key, tampering, or corruption)
 */
export function decryptCredential(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext: too short");
  }

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(
    IV_LENGTH,
    combined.length - AUTH_TAG_LENGTH
  );

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    // GCM auth failure or other decryption error
    throw new Error(
      "Decryption failed: invalid ciphertext or wrong encryption key"
    );
  }
}

/**
 * Check if a string looks like an encrypted credential.
 * Does not validate the encryption, just checks format.
 *
 * @param value - String to check
 * @returns true if the value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== "string") {
    return false;
  }

  try {
    const decoded = Buffer.from(value, "base64");
    // Minimum length: IV (12) + at least 1 byte ciphertext + auth tag (16)
    return decoded.length >= IV_LENGTH + 1 + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Safely encrypt a credential, returning null if input is null/undefined.
 * Useful for optional fields.
 *
 * @param plaintext - The string to encrypt, or null/undefined
 * @returns Encrypted string or null
 */
export function encryptCredentialSafe(
  plaintext: string | null | undefined
): string | null {
  if (plaintext === null || plaintext === undefined) {
    return null;
  }
  return encryptCredential(plaintext);
}

/**
 * Safely decrypt a credential, returning null if input is null/undefined.
 * Useful for optional fields.
 *
 * @param ciphertext - The encrypted string, or null/undefined
 * @returns Decrypted string or null
 */
export function decryptCredentialSafe(
  ciphertext: string | null | undefined
): string | null {
  if (ciphertext === null || ciphertext === undefined) {
    return null;
  }
  return decryptCredential(ciphertext);
}
