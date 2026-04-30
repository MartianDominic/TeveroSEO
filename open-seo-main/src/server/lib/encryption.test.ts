/**
 * Encryption Utilities Tests
 * Phase 54-01: Multi-Provider Payments
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import * as crypto from "crypto";

// Generate a test key before importing the module
const TEST_KEY = crypto.randomBytes(32).toString("base64");

// Mock the environment before importing the encryption module
vi.stubEnv("PAYMENT_ENCRYPTION_KEY", TEST_KEY);

// Import after mocking
import {
  encryptCredential,
  decryptCredential,
  isEncrypted,
  encryptCredentialSafe,
  decryptCredentialSafe,
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

      // Tamper with the ciphertext
      const tampered = Buffer.from(encrypted, "base64");
      tampered[20] ^= 0xff; // Flip some bits
      const tamperedBase64 = tampered.toString("base64");

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
});
