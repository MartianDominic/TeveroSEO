/**
 * Token Encryption Service
 * Phase 61-01: Platform Integration Excellence
 *
 * Re-exports encryption functions from the existing P54 AES-256-GCM
 * implementation with token-specific naming for OAuth token handling.
 *
 * Security: Tokens are encrypted at rest using the same PAYMENT_ENCRYPTION_KEY
 * environment variable as payment credentials (both require equivalent protection).
 */

import {
  encryptCredential,
  decryptCredential,
  encryptCredentialSafe,
  decryptCredentialSafe,
} from "@/server/lib/encryption";

/**
 * Encrypt an OAuth access or refresh token.
 *
 * @param plaintext - The token to encrypt
 * @returns Base64-encoded ciphertext (IV + ciphertext + auth tag)
 * @throws Error if PAYMENT_ENCRYPTION_KEY is not configured
 */
export const encryptToken = encryptCredential;

/**
 * Decrypt an encrypted OAuth token.
 *
 * @param ciphertext - Base64-encoded ciphertext from encryptToken
 * @returns The original plaintext token
 * @throws Error if decryption fails (wrong key, tampering, or corruption)
 */
export const decryptToken = decryptCredential;

/**
 * Safely encrypt a token, returning null if input is null/undefined.
 * Useful for optional refresh tokens.
 *
 * @param plaintext - The token to encrypt, or null/undefined
 * @returns Encrypted string or null
 */
export const encryptTokenSafe = encryptCredentialSafe;

/**
 * Safely decrypt a token, returning null if input is null/undefined.
 * Useful for optional refresh tokens.
 *
 * @param ciphertext - The encrypted string, or null/undefined
 * @returns Decrypted string or null
 */
export const decryptTokenSafe = decryptCredentialSafe;
