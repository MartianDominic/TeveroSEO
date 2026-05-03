/**
 * Credential Encryption Utilities
 * Phase 54-01: Multi-Provider Payments
 * Phase 54-FIX: Added key versioning for rotation support
 *
 * AES-256-GCM encryption for payment provider credentials.
 * Supports key rotation via versioned keys.
 *
 * Security:
 * - AES-256-GCM provides authenticated encryption
 * - Random IV for each encryption (12 bytes)
 * - Auth tag prevents tampering (16 bytes)
 * - Key versioning for seamless rotation
 * - Key never logged or exposed
 *
 * Format: v{version}:{base64(iv:ciphertext:authTag)}
 * Legacy format (v1): base64(iv:ciphertext:authTag)
 */
import * as crypto from "crypto";
import { getRequiredEnvValueSync } from "./runtime-env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Current encryption key version.
 * Increment when rotating keys.
 */
const CURRENT_KEY_VERSION = 2;

/**
 * Get encryption key for a specific version.
 * Supports version 1 (legacy) and version 2 (current).
 *
 * Key configuration:
 * - PAYMENT_ENCRYPTION_KEY: Current key (v2)
 * - PAYMENT_ENCRYPTION_KEY_V1: Previous key for decryption fallback
 *
 * @param version - Key version to retrieve
 * @returns Buffer containing the 32-byte key
 * @throws Error if key not found or invalid
 */
function getEncryptionKeyByVersion(version: number): Buffer {
  let keyBase64: string | undefined;

  if (version === CURRENT_KEY_VERSION) {
    // Current key
    keyBase64 = getRequiredEnvValueSync("PAYMENT_ENCRYPTION_KEY");
  } else if (version === 1) {
    // Legacy key for backward compatibility
    const v1Key = process.env.PAYMENT_ENCRYPTION_KEY_V1?.trim();
    keyBase64 = v1Key && v1Key.length > 0 ? v1Key : undefined;
    if (!keyBase64) {
      // Fall back to current key for v1 if no explicit v1 key set
      // This handles the case where key versioning was just enabled
      keyBase64 = getRequiredEnvValueSync("PAYMENT_ENCRYPTION_KEY");
    }
  } else {
    throw new Error(`Unsupported encryption key version: ${version}`);
  }

  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== 32) {
    throw new Error(
      `Encryption key v${version} must be a base64-encoded 32-byte key. ` +
        `Got ${key.length} bytes after decoding. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }

  return key;
}

/**
 * Get the current encryption key from environment.
 * Must be a base64-encoded 32-byte (256-bit) key.
 *
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * @throws Error if PAYMENT_ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey(): Buffer {
  return getEncryptionKeyByVersion(CURRENT_KEY_VERSION);
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Uses current key version and prefixes output with version.
 *
 * @param plaintext - The string to encrypt
 * @returns Versioned ciphertext in format: v{version}:{base64(iv:ciphertext:authTag)}
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
  const encoded = combined.toString("base64");

  // Prefix with version for future key rotation support
  return `v${CURRENT_KEY_VERSION}:${encoded}`;
}

/**
 * Parse versioned ciphertext format.
 * Returns version number and the base64-encoded payload.
 *
 * @param ciphertext - Potentially versioned ciphertext
 * @returns Object with version and payload
 */
function parseVersionedCiphertext(ciphertext: string): {
  version: number;
  payload: string;
} {
  const versionMatch = ciphertext.match(/^v(\d+):(.+)$/);
  if (versionMatch) {
    return {
      version: parseInt(versionMatch[1], 10),
      payload: versionMatch[2],
    };
  }
  // Legacy format (no version prefix) - treat as v1
  return {
    version: 1,
    payload: ciphertext,
  };
}

/**
 * Decrypt a ciphertext string encrypted with encryptCredential.
 * Supports versioned format (v{n}:payload) and legacy format.
 * Automatically uses the correct key based on version.
 *
 * @param ciphertext - Versioned or legacy ciphertext from encryptCredential
 * @returns The original plaintext string
 * @throws Error if decryption fails (wrong key, tampering, or corruption)
 */
export function decryptCredential(ciphertext: string): string {
  const { version, payload } = parseVersionedCiphertext(ciphertext);

  // Try with the detected version's key first
  try {
    return decryptWithKey(payload, getEncryptionKeyByVersion(version));
  } catch (error) {
    // If current version fails and we have a fallback, try it
    if (version === CURRENT_KEY_VERSION) {
      try {
        // Try with previous version key as fallback
        const previousKey = getEncryptionKeyByVersion(1);
        return decryptWithKey(payload, previousKey);
      } catch {
        // Both keys failed, throw original error
      }
    }
    throw error;
  }
}

/**
 * Internal decryption with a specific key.
 *
 * @param payload - Base64-encoded ciphertext (without version prefix)
 * @param key - The encryption key to use
 * @returns Decrypted plaintext
 */
function decryptWithKey(payload: string, key: Buffer): string {
  const combined = Buffer.from(payload, "base64");

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
 * Supports both versioned (v{n}:payload) and legacy formats.
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
    // Check for versioned format
    const { payload } = parseVersionedCiphertext(value);

    const decoded = Buffer.from(payload, "base64");
    // Minimum length: IV (12) + at least 1 byte ciphertext + auth tag (16)
    return decoded.length >= IV_LENGTH + 1 + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Get the current encryption key version.
 * Useful for diagnostics and migration scripts.
 */
export function getCurrentKeyVersion(): number {
  return CURRENT_KEY_VERSION;
}

/**
 * Re-encrypt a credential with the current key version.
 * Use during key rotation to update stored credentials.
 *
 * @param ciphertext - Existing encrypted credential
 * @returns Newly encrypted credential with current key version
 */
export function reencryptCredential(ciphertext: string): string {
  const plaintext = decryptCredential(ciphertext);
  return encryptCredential(plaintext);
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
