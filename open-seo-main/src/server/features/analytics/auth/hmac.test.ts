/**
 * Tests for HMAC Configuration and Validation
 * Phase 96-Security: SEC-003 Fix Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateHmacConfig,
  getHmacConfig,
  isHmacConfigValid,
  createHmacSignature,
  verifyHmacSignature,
  createTimestampedSignature,
  verifyTimestampedSignature,
  resetHmacConfig,
  setTestHmacConfig,
} from "./hmac";

describe("HMAC Configuration (SEC-003)", () => {
  const originalEnv = process.env.INTERNAL_API_HMAC_SECRET;

  beforeEach(() => {
    // Reset config before each test
    vi.stubEnv("NODE_ENV", "test");
    resetHmacConfig();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.INTERNAL_API_HMAC_SECRET = originalEnv;
    } else {
      delete process.env.INTERNAL_API_HMAC_SECRET;
    }
    resetHmacConfig();
  });

  describe("validateHmacConfig", () => {
    it("should throw if INTERNAL_API_HMAC_SECRET is missing", () => {
      delete process.env.INTERNAL_API_HMAC_SECRET;

      expect(() => validateHmacConfig()).toThrow(
        "INTERNAL_API_HMAC_SECRET environment variable is required"
      );
    });

    it("should throw if INTERNAL_API_HMAC_SECRET is too short", () => {
      process.env.INTERNAL_API_HMAC_SECRET = "short-secret-only-20ch";

      expect(() => validateHmacConfig()).toThrow(
        "INTERNAL_API_HMAC_SECRET must be at least 32 characters"
      );
    });

    it("should throw if INTERNAL_API_HMAC_SECRET is exactly 31 characters", () => {
      process.env.INTERNAL_API_HMAC_SECRET = "1234567890123456789012345678901"; // 31 chars

      expect(() => validateHmacConfig()).toThrow(
        "INTERNAL_API_HMAC_SECRET must be at least 32 characters"
      );
    });

    it("should succeed with 32+ character secret", () => {
      process.env.INTERNAL_API_HMAC_SECRET = "12345678901234567890123456789012"; // 32 chars

      const config = validateHmacConfig();

      expect(config).toBeDefined();
      expect(config.secret).toBe("12345678901234567890123456789012");
      expect(config.algorithm).toBe("sha256");
    });

    it("should succeed with longer secrets", () => {
      const longSecret = "a".repeat(64); // 64 chars
      process.env.INTERNAL_API_HMAC_SECRET = longSecret;

      const config = validateHmacConfig();

      expect(config.secret).toBe(longSecret);
    });
  });

  describe("getHmacConfig", () => {
    it("should throw if config not initialized", () => {
      expect(() => getHmacConfig()).toThrow(
        "HMAC configuration not initialized"
      );
    });

    it("should return config after validation", () => {
      process.env.INTERNAL_API_HMAC_SECRET = "12345678901234567890123456789012";
      validateHmacConfig();

      const config = getHmacConfig();

      expect(config.secret).toBe("12345678901234567890123456789012");
    });
  });

  describe("isHmacConfigValid", () => {
    it("should return false before validation", () => {
      expect(isHmacConfigValid()).toBe(false);
    });

    it("should return true after validation", () => {
      process.env.INTERNAL_API_HMAC_SECRET = "12345678901234567890123456789012";
      validateHmacConfig();

      expect(isHmacConfigValid()).toBe(true);
    });
  });

  describe("HMAC Signature Operations", () => {
    const testSecret = "test-secret-that-is-at-least-32-chars-long";

    beforeEach(() => {
      setTestHmacConfig({ secret: testSecret, algorithm: "sha256" });
    });

    describe("createHmacSignature", () => {
      it("should create consistent signatures", () => {
        const message = "test message";

        const sig1 = createHmacSignature(message);
        const sig2 = createHmacSignature(message);

        expect(sig1).toBe(sig2);
      });

      it("should create different signatures for different messages", () => {
        const sig1 = createHmacSignature("message 1");
        const sig2 = createHmacSignature("message 2");

        expect(sig1).not.toBe(sig2);
      });

      it("should return hex-encoded signature", () => {
        const sig = createHmacSignature("test");

        // Hex string should only contain hex characters
        expect(sig).toMatch(/^[0-9a-f]+$/);
        // SHA256 produces 64 hex characters
        expect(sig.length).toBe(64);
      });
    });

    describe("verifyHmacSignature", () => {
      it("should verify valid signature", () => {
        const message = "test message";
        const signature = createHmacSignature(message);

        expect(verifyHmacSignature(message, signature)).toBe(true);
      });

      it("should reject invalid signature", () => {
        const message = "test message";
        const invalidSig = "a".repeat(64); // Valid hex but wrong signature

        expect(verifyHmacSignature(message, invalidSig)).toBe(false);
      });

      it("should reject signature for wrong message", () => {
        const signature = createHmacSignature("original message");

        expect(verifyHmacSignature("different message", signature)).toBe(false);
      });

      it("should reject malformed signatures", () => {
        expect(verifyHmacSignature("message", "not-hex")).toBe(false);
        expect(verifyHmacSignature("message", "")).toBe(false);
      });
    });

    describe("Timestamped Signatures", () => {
      it("should create and verify timestamped signature", () => {
        const timestamp = Date.now();
        const payload = '{"data":"test"}';

        const signature = createTimestampedSignature(timestamp, payload);
        const isValid = verifyTimestampedSignature(timestamp, payload, signature);

        expect(isValid).toBe(true);
      });

      it("should reject signature with wrong timestamp", () => {
        const timestamp = Date.now();
        const payload = '{"data":"test"}';

        const signature = createTimestampedSignature(timestamp, payload);
        const isValid = verifyTimestampedSignature(timestamp + 1000, payload, signature);

        expect(isValid).toBe(false);
      });

      it("should reject signature with wrong payload", () => {
        const timestamp = Date.now();

        const signature = createTimestampedSignature(timestamp, "original");
        const isValid = verifyTimestampedSignature(timestamp, "modified", signature);

        expect(isValid).toBe(false);
      });
    });
  });
});
