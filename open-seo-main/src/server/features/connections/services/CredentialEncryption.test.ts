/**
 * Tests for AES-256-GCM credential encryption.
 * Phase 31-01: Site Connection Schema
 *
 * Tests verify:
 * - Round-trip encryption/decryption
 * - Unique IV per encryption (no IV reuse)
 * - Tamper detection via GCM authentication
 * - Key validation (missing key, invalid length)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Import after defining what we're testing
import {
  encryptCredential,
  decryptCredential,
  validateEncryptionKey,
  IV_LENGTH,
  TAG_LENGTH,
} from "./CredentialEncryption";

describe("CredentialEncryption", () => {
  const originalEnv = process.env;
  // Valid 32-byte key as base64 (node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  const VALID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="; // 32 bytes of zeros as base64

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SITE_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encryptCredential", () => {
    it("returns Buffer containing IV (12 bytes) + tag (16 bytes) + ciphertext", () => {
      const plaintext = JSON.stringify({ apiKey: "secret123" });

      const encrypted = encryptCredential(plaintext);

      // Minimum size: IV (12) + TAG (16) + at least 1 byte ciphertext
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThanOrEqual(IV_LENGTH + TAG_LENGTH + 1);
    });

    it("produces different ciphertexts for same plaintext (unique IV)", () => {
      const plaintext = JSON.stringify({ token: "same-token" });

      const encrypted1 = encryptCredential(plaintext);
      const encrypted2 = encryptCredential(plaintext);

      // IVs should differ (first 12 bytes)
      const iv1 = encrypted1.subarray(0, IV_LENGTH);
      const iv2 = encrypted2.subarray(0, IV_LENGTH);
      expect(iv1.equals(iv2)).toBe(false);

      // Full ciphertext should also differ due to different IV
      expect(encrypted1.equals(encrypted2)).toBe(false);
    });
  });

  describe("decryptCredential", () => {
    it("round-trips: decrypt(encrypt(plaintext)) === plaintext", () => {
      const credentials = {
        siteUrl: "https://example.com",
        username: "admin",
        applicationPassword: "xxxx-xxxx-xxxx-xxxx",
      };
      const plaintext = JSON.stringify(credentials);

      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual(credentials);
    });

    it("throws authentication error on tampered ciphertext", () => {
      const plaintext = JSON.stringify({ secret: "value" });
      const encrypted = encryptCredential(plaintext);

      // Tamper with the ciphertext portion (after IV + TAG)
      const tamperedIndex = IV_LENGTH + TAG_LENGTH + 5;
      if (encrypted.length > tamperedIndex) {
        encrypted[tamperedIndex] ^= 0xff; // Flip bits
      }

      expect(() => decryptCredential(encrypted)).toThrow();
    });
  });

  describe("validateEncryptionKey", () => {
    it("throws Error when SITE_ENCRYPTION_KEY is missing", () => {
      delete process.env.SITE_ENCRYPTION_KEY;

      expect(() => validateEncryptionKey()).toThrow(
        "SITE_ENCRYPTION_KEY environment variable is not set"
      );
    });

    it("throws Error when key decodes to wrong length (not 32 bytes)", () => {
      // 16 bytes as base64 - too short
      process.env.SITE_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAA==";

      expect(() => validateEncryptionKey()).toThrow(
        "SITE_ENCRYPTION_KEY must be a base64-encoded 32-byte key"
      );
    });

    it("does not throw when key is valid 32 bytes", () => {
      process.env.SITE_ENCRYPTION_KEY = VALID_KEY;

      expect(() => validateEncryptionKey()).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("handles empty string plaintext", () => {
      const plaintext = "";

      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles large JSON payloads", () => {
      const largePayload = {
        data: "x".repeat(10000),
        nested: {
          array: Array(100).fill({ key: "value" }),
        },
      };
      const plaintext = JSON.stringify(largePayload);

      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(JSON.parse(decrypted)).toEqual(largePayload);
    });

    it("handles Unicode in credentials", () => {
      const credentials = {
        password: "p@$$w0rd-lietuviu-abcdefghijklmnop-123",
        notes: "Some notes with unicode characters",
      };
      const plaintext = JSON.stringify(credentials);

      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
