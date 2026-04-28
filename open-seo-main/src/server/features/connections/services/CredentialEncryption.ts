/**
 * AES-256-GCM Credential Encryption Service.
 * Phase 31-01: Site Connection Schema
 *
 * Provides secure encryption and decryption for platform credentials.
 * Uses AES-256-GCM with fresh IV per encryption for authenticated encryption.
 *
 * Storage format: IV (12 bytes) || AUTH_TAG (16 bytes) || CIPHERTEXT
 * All packed into a single Buffer, stored as base64 in the database.
 *
 * Environment:
 *   SITE_ENCRYPTION_KEY - Base64-encoded 32-byte key
 *   Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
import * as crypto from "node:crypto";

// Algorithm constants
const ALGORITHM = "aes-256-gcm";
export const IV_LENGTH = 12; // GCM recommended IV size
export const TAG_LENGTH = 16; // GCM auth tag size
const KEY_LENGTH = 32; // AES-256 key size in bytes

/**
 * Validate the SITE_ENCRYPTION_KEY environment variable.
 * Throws descriptive errors for missing or invalid keys.
 *
 * @throws Error if key is missing or not exactly 32 bytes when decoded
 */
export function validateEncryptionKey(): void {
  const keyBase64 = process.env.SITE_ENCRYPTION_KEY;

  if (!keyBase64) {
    throw new Error(
      "SITE_ENCRYPTION_KEY environment variable is not set. " +
        "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  const keyBuffer = Buffer.from(keyBase64, "base64");

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `SITE_ENCRYPTION_KEY must be a base64-encoded 32-byte key. ` +
        `Got ${keyBuffer.length} bytes after decoding.`
    );
  }
}

/**
 * Get the encryption key from environment.
 * Validates and returns the key as a Buffer.
 *
 * @returns 32-byte key Buffer
 * @throws Error if key is invalid
 */
function getKey(): Buffer {
  validateEncryptionKey();
  return Buffer.from(process.env.SITE_ENCRYPTION_KEY!, "base64");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext - String to encrypt (typically JSON credential data)
 * @returns Buffer containing IV || AUTH_TAG || CIPHERTEXT
 */
export function encryptCredential(plaintext: string): Buffer {
  const key = getKey();

  // Generate fresh random IV for each encryption (critical for GCM security)
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher and encrypt
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Get auth tag (GCM provides authenticated encryption)
  const authTag = cipher.getAuthTag();

  // Pack: IV || TAG || CIPHERTEXT
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypt an encrypted credential buffer using AES-256-GCM.
 *
 * @param packed - Buffer containing IV || AUTH_TAG || CIPHERTEXT
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptCredential(packed: Buffer): string {
  const key = getKey();

  // Validate minimum length
  const minLength = IV_LENGTH + TAG_LENGTH;
  if (packed.length < minLength) {
    throw new Error(
      `Invalid encrypted data: expected at least ${minLength} bytes, got ${packed.length}`
    );
  }

  // Unpack: IV || TAG || CIPHERTEXT
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

  // Create decipher and set auth tag
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt (throws if auth tag verification fails)
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * Encrypt credentials and return as base64 string for database storage.
 *
 * @param credentials - Object to encrypt
 * @returns Base64-encoded encrypted string
 */
export function encryptCredentialsToBase64(credentials: object): string {
  const plaintext = JSON.stringify(credentials);
  const encrypted = encryptCredential(plaintext);
  return encrypted.toString("base64");
}

/**
 * Decrypt base64-encoded credentials from database.
 *
 * @param base64 - Base64-encoded encrypted string from database
 * @returns Decrypted credentials object
 */
export function decryptCredentialsFromBase64<T = object>(base64: string): T {
  const packed = Buffer.from(base64, "base64");
  const plaintext = decryptCredential(packed);
  return JSON.parse(plaintext) as T;
}
