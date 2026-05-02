/**
 * Tests for TokenEncryption.ts
 * Phase 61-01: Token Encryption Service
 *
 * TDD: Tests written before implementation.
 * Wraps the existing AES-256-GCM encryption from P54.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the runtime-env module to provide test encryption key
vi.mock("@/server/lib/runtime-env", () => ({
  getRequiredEnvValueSync: vi.fn((key: string) => {
    if (key === "PAYMENT_ENCRYPTION_KEY") {
      // 32-byte key encoded as base64
      return Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
    }
    throw new Error(`Missing required env var: ${key}`);
  }),
}));

// Import after mocking
import {
  encryptToken,
  decryptToken,
  encryptTokenSafe,
  decryptTokenSafe,
} from "./TokenEncryption";

describe("TokenEncryption", () => {
  describe("encryptToken", () => {
    it("should encrypt plaintext and return base64 string", () => {
      const plaintext = "my-secret-access-token";
      const encrypted = encryptToken(plaintext);

      // Should be a non-empty string
      expect(typeof encrypted).toBe("string");
      expect(encrypted.length).toBeGreaterThan(0);

      // Should be base64 encoded
      expect(() => Buffer.from(encrypted, "base64")).not.toThrow();

      // Should not equal the plaintext
      expect(encrypted).not.toBe(plaintext);
    });

    it("should produce different ciphertexts for same plaintext (random IV)", () => {
      const plaintext = "same-token-value";
      const encrypted1 = encryptToken(plaintext);
      const encrypted2 = encryptToken(plaintext);

      // Each encryption should produce different ciphertext due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("decryptToken", () => {
    it("should recover original plaintext from encrypted value", () => {
      const plaintext = "my-secret-refresh-token-12345";
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle various token formats", () => {
      const tokens = [
        "ya29.a0AfH6SMBx...short-token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.jwt-token-format",
        "1//0gtoken-with-slashes/and/paths",
        JSON.stringify({ complex: "token", with: ["nested", "values"] }),
      ];

      for (const token of tokens) {
        const encrypted = encryptToken(token);
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(token);
      }
    });

    it("should throw for tampered ciphertext", () => {
      const plaintext = "sensitive-token";
      const encrypted = encryptToken(plaintext);

      // Tamper with the ciphertext (flip some bits)
      const tamperedBuffer = Buffer.from(encrypted, "base64");
      tamperedBuffer[tamperedBuffer.length - 5] ^= 0xff;
      const tampered = tamperedBuffer.toString("base64");

      expect(() => decryptToken(tampered)).toThrow();
    });

    it("should throw for invalid base64 input", () => {
      expect(() => decryptToken("not-valid-base64!!!")).toThrow();
    });

    it("should throw for truncated ciphertext", () => {
      const plaintext = "token";
      const encrypted = encryptToken(plaintext);
      const truncated = encrypted.slice(0, 10);

      expect(() => decryptToken(truncated)).toThrow();
    });
  });

  describe("encryptTokenSafe", () => {
    it("should return null for null input", () => {
      expect(encryptTokenSafe(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(encryptTokenSafe(undefined)).toBeNull();
    });

    it("should encrypt valid string input", () => {
      const plaintext = "valid-token";
      const encrypted = encryptTokenSafe(plaintext);

      expect(encrypted).not.toBeNull();
      expect(typeof encrypted).toBe("string");

      // Should be decryptable
      const decrypted = decryptToken(encrypted!);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decryptTokenSafe", () => {
    it("should return null for null input", () => {
      expect(decryptTokenSafe(null)).toBeNull();
    });

    it("should return null for undefined input", () => {
      expect(decryptTokenSafe(undefined)).toBeNull();
    });

    it("should decrypt valid encrypted input", () => {
      const plaintext = "decryptable-token";
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptTokenSafe(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("Roundtrip encryption", () => {
    it("should handle empty string", () => {
      const plaintext = "";
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", () => {
      const plaintext = "token-with-unicode-";
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle long tokens (4KB)", () => {
      const plaintext = "x".repeat(4096);
      const encrypted = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });
});
