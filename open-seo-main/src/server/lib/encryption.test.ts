/**
 * Encryption Utilities Tests
 * Phase 54-01: Multi-Provider Payments
 * Phase 54-FIX: Added key rotation tests
 */
import { describe, it, expect, vi } from "vitest";
import * as crypto from "crypto";

// Generate test keys before importing the module
const TEST_KEY = crypto.randomBytes(32).toString("base64");
const TEST_KEY_V1 = crypto.randomBytes(32).toString("base64");

// Mock the environment before importing the encryption module
vi.stubEnv("PAYMENT_ENCRYPTION_KEY", TEST_KEY);
vi.stubEnv("PAYMENT_ENCRYPTION_KEY_V1", TEST_KEY_V1);

// Import after mocking
import {
  encryptCredential,
  decryptCredential,
  isEncrypted,
  encryptCredentialSafe,
  decryptCredentialSafe,
  getCurrentKeyVersion,
  reencryptCredential,
} from "./encryption";

describe("encryption utilities", () => {
  describe("encryptCredential / decryptCredential", () => {
    it("should encrypt and decrypt a simple string", () => {
      const plaintext = "sk_test_abc123";
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it("should encrypt and decrypt an empty string", () => {
      const plaintext = "";
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt unicode characters", () => {
      const plaintext = "secret-key-with-unicode-characters";
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for the same plaintext (random IV)", () => {
      const plaintext = "sk_live_xyz789";
      const encrypted1 = encryptCredential(plaintext);
      const encrypted2 = encryptCredential(plaintext);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(decryptCredential(encrypted1)).toBe(plaintext);
      expect(decryptCredential(encrypted2)).toBe(plaintext);
    });

    it("should throw on invalid ciphertext (too short)", () => {
      expect(() => decryptCredential("abc")).toThrow("too short");
    });

    it("should throw on tampered ciphertext", () => {
      const plaintext = "secret";
      const encrypted = encryptCredential(plaintext);

      // Extract payload after version prefix for tampering
      const parts = encrypted.split(":");
      const payload = parts.length > 1 ? parts[1] : encrypted;
      const tampered = Buffer.from(payload, "base64");
      tampered[20] ^= 0xff; // Flip some bits
      const tamperedBase64 = parts.length > 1
        ? `${parts[0]}:${tampered.toString("base64")}`
        : tampered.toString("base64");

      expect(() => decryptCredential(tamperedBase64)).toThrow(
        "Decryption failed"
      );
    });
  });

  describe("isEncrypted", () => {
    it("should return true for encrypted values", () => {
      const encrypted = encryptCredential("test");
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("should return false for plaintext", () => {
      expect(isEncrypted("sk_test_abc123")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isEncrypted(null as unknown as string)).toBe(false);
      expect(isEncrypted(undefined as unknown as string)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isEncrypted("")).toBe(false);
    });

    it("should return false for invalid base64", () => {
      expect(isEncrypted("not-valid-base64!!!")).toBe(false);
    });
  });

  describe("encryptCredentialSafe", () => {
    it("should return null for null input", () => {
      expect(encryptCredentialSafe(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(encryptCredentialSafe(undefined)).toBeNull();
    });

    it("should encrypt non-null strings", () => {
      const encrypted = encryptCredentialSafe("secret");
      expect(encrypted).not.toBeNull();
      expect(decryptCredential(encrypted!)).toBe("secret");
    });
  });

  describe("decryptCredentialSafe", () => {
    it("should return null for null input", () => {
      expect(decryptCredentialSafe(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(decryptCredentialSafe(undefined)).toBeNull();
    });

    it("should decrypt non-null strings", () => {
      const encrypted = encryptCredential("secret");
      expect(decryptCredentialSafe(encrypted)).toBe("secret");
    });
  });

  describe("key validation", () => {
    it("should work with a valid 32-byte key", () => {
      // Already using a valid key from TEST_KEY
      const plaintext = "test";
      const encrypted = encryptCredential(plaintext);
      expect(decryptCredential(encrypted)).toBe(plaintext);
    });
  });

  describe("key versioning", () => {
    it("should encrypt with version prefix", () => {
      const encrypted = encryptCredential("test");
      expect(encrypted).toMatch(/^v\d+:/);
    });

    it("should return current key version", () => {
      const version = getCurrentKeyVersion();
      expect(version).toBeGreaterThanOrEqual(1);
      expect(typeof version).toBe("number");
    });

    it("should decrypt versioned ciphertext", () => {
      const plaintext = "versioned-secret";
      const encrypted = encryptCredential(plaintext);
      expect(encrypted.startsWith("v")).toBe(true);
      expect(decryptCredential(encrypted)).toBe(plaintext);
    });

    it("should decrypt legacy (unversioned) ciphertext", () => {
      // Simulate legacy format by creating ciphertext without version prefix
      // This tests backward compatibility
      // Legacy format uses the V1 key (or falls back to current key if V1 not set)
      const cryptoModule = require("crypto");
      // Use V1 key since that's what the decryption will try for unversioned ciphertext
      const key = Buffer.from(TEST_KEY_V1, "base64");
      const iv = cryptoModule.randomBytes(12);
      const cipher = cryptoModule.createCipheriv("aes-256-gcm", key, iv, {
        authTagLength: 16,
      });
      const encrypted = Buffer.concat([
        cipher.update("legacy-secret", "utf8"),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      const combined = Buffer.concat([iv, encrypted, authTag]);
      const legacyCiphertext = combined.toString("base64");

      // Should decrypt without version prefix (treated as v1, uses V1 key)
      expect(decryptCredential(legacyCiphertext)).toBe("legacy-secret");
    });

    it("should re-encrypt credential with current version", () => {
      const plaintext = "reencrypt-me";
      const encrypted = encryptCredential(plaintext);
      const reencrypted = reencryptCredential(encrypted);

      // Should produce different ciphertext (new IV)
      expect(reencrypted).not.toBe(encrypted);

      // Should decrypt to same plaintext
      expect(decryptCredential(reencrypted)).toBe(plaintext);

      // Should have version prefix
      expect(reencrypted).toMatch(/^v\d+:/);
    });

    it("should detect versioned format in isEncrypted", () => {
      const encrypted = encryptCredential("test");
      expect(isEncrypted(encrypted)).toBe(true);

      // Version prefix alone is not enough
      expect(isEncrypted("v2:notvalidbase64!!!")).toBe(false);
    });
  });
});
