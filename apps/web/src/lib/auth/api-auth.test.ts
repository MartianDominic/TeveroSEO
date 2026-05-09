/**
 * Tests for api-auth validation functions.
 * Phase 68-02: Client Context Security
 *
 * Tests validateClientAccess format validation:
 * - Missing/empty client ID returns 400
 * - Invalid UUID format returns 400
 * - Valid UUID passes validation
 */
import { describe, it, expect } from "vitest";

import { validateClientAccess, AuthError } from "./api-auth";

describe("validateClientAccess", () => {
  describe("missing/empty client ID", () => {
    it("throws AuthError for null client ID", () => {
      expect(() => validateClientAccess(null)).toThrow(AuthError);
      try {
        validateClientAccess(null);
      } catch (err) {
        expect(err).toBeInstanceOf(AuthError);
        expect((err as AuthError).statusCode).toBe(400);
        expect((err as AuthError).message).toContain("required");
      }
    });

    it("throws AuthError for undefined client ID", () => {
      expect(() => validateClientAccess(undefined)).toThrow(AuthError);
    });

    it("throws AuthError for empty string", () => {
      expect(() => validateClientAccess("")).toThrow(AuthError);
      try {
        validateClientAccess("");
      } catch (err) {
        expect((err as AuthError).statusCode).toBe(400);
      }
    });

    it("throws AuthError for whitespace-only string", () => {
      expect(() => validateClientAccess("   ")).toThrow(AuthError);
    });
  });

  describe("invalid UUID format", () => {
    it("throws AuthError for non-UUID string", () => {
      expect(() => validateClientAccess("not-a-uuid")).toThrow(AuthError);
      try {
        validateClientAccess("not-a-uuid");
      } catch (err) {
        expect((err as AuthError).statusCode).toBe(400);
        expect((err as AuthError).message).toContain("Invalid");
      }
    });

    it("throws AuthError for UUID with wrong length", () => {
      expect(() => validateClientAccess("12345678-1234-1234-1234-12345678901")).toThrow(AuthError);
    });

    it("throws AuthError for UUID with invalid characters", () => {
      expect(() => validateClientAccess("GGGGGGGG-1234-1234-1234-123456789012")).toThrow(AuthError);
    });

    it("throws AuthError for UUID without dashes", () => {
      expect(() => validateClientAccess("12345678123412341234123456789012")).toThrow(AuthError);
    });
  });

  describe("valid UUID acceptance", () => {
    it("returns trimmed lowercase UUID", () => {
      const uuid = "12345678-1234-1234-1234-123456789012";
      expect(validateClientAccess(uuid)).toBe(uuid);
    });

    it("returns uppercase UUID (case-insensitive)", () => {
      const uuid = "12345678-ABCD-1234-ABCD-123456789012";
      expect(validateClientAccess(uuid)).toBe(uuid);
    });

    it("returns mixed-case UUID", () => {
      const uuid = "12345678-AbCd-1234-aBcD-123456789012";
      expect(validateClientAccess(uuid)).toBe(uuid);
    });

    it("trims whitespace from UUID", () => {
      const uuid = "12345678-1234-1234-1234-123456789012";
      expect(validateClientAccess(`  ${uuid}  `)).toBe(uuid);
    });
  });
});

describe("AuthError", () => {
  it("has correct default status code", () => {
    const error = new AuthError("Test error");
    expect(error.statusCode).toBe(401);
  });

  it("accepts custom status code", () => {
    const error = new AuthError("Test error", 403);
    expect(error.statusCode).toBe(403);
  });

  it("extends Error", () => {
    const error = new AuthError("Test error");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuthError");
  });
});
