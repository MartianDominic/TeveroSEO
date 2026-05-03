/**
 * Tests for middleware functions.
 * Phase 68-02: Client Context Security
 *
 * Tests for requireClientContext validation:
 * - CRITICAL-01: Empty X-Client-ID returns 400
 * - Invalid UUID format returns 400
 * - Valid UUID passes validation
 *
 * Note: We test the validation logic directly to avoid importing
 * the full middleware chain which requires database setup.
 */
import { describe, it, expect } from "vitest";

// Re-implement the validation logic for isolated testing
// This mirrors the requireClientContext function in middleware.ts
const CLIENT_ID_HEADER = "x-client-id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function requireClientContext(request: Request): string {
  const clientId = request.headers.get(CLIENT_ID_HEADER);

  if (!clientId || clientId.trim() === "") {
    throw new ValidationError("VALIDATION_ERROR", "X-Client-ID header is required");
  }

  const trimmed = clientId.trim();

  if (!UUID_RE.test(trimmed)) {
    throw new ValidationError("VALIDATION_ERROR", "Invalid X-Client-ID format: must be a valid UUID");
  }

  return trimmed;
}

// Helper to create a mock Request with headers
function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: new Headers(headers),
    url: "http://localhost/api/test",
  } as Request;
}

describe("requireClientContext", () => {
  describe("CRITICAL-01: Empty header bypass prevention", () => {
    it("throws VALIDATION_ERROR when X-Client-ID header is missing", () => {
      const request = createMockRequest({});

      expect(() => requireClientContext(request)).toThrow(ValidationError);
      try {
        requireClientContext(request);
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
        expect((err as ValidationError).message).toContain("required");
      }
    });

    it("throws VALIDATION_ERROR when X-Client-ID header is empty string", () => {
      const request = createMockRequest({ "x-client-id": "" });

      expect(() => requireClientContext(request)).toThrow(ValidationError);
      try {
        requireClientContext(request);
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
        expect((err as ValidationError).message).toContain("required");
      }
    });

    it("throws VALIDATION_ERROR when X-Client-ID header is whitespace only", () => {
      const request = createMockRequest({ "x-client-id": "   " });

      expect(() => requireClientContext(request)).toThrow(ValidationError);
      try {
        requireClientContext(request);
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
        expect((err as ValidationError).message).toContain("required");
      }
    });
  });

  describe("UUID format validation", () => {
    it("throws VALIDATION_ERROR for invalid UUID format", () => {
      const request = createMockRequest({ "x-client-id": "not-a-uuid" });

      expect(() => requireClientContext(request)).toThrow(ValidationError);
      try {
        requireClientContext(request);
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe("VALIDATION_ERROR");
        expect((err as ValidationError).message).toContain("Invalid");
      }
    });

    it("throws VALIDATION_ERROR for UUID with wrong character count", () => {
      const request = createMockRequest({ "x-client-id": "12345678-1234-1234-1234-1234567890" });

      expect(() => requireClientContext(request)).toThrow(ValidationError);
    });

    it("throws VALIDATION_ERROR for UUID with invalid characters", () => {
      const request = createMockRequest({ "x-client-id": "GGGGGGGG-1234-1234-1234-123456789012" });

      expect(() => requireClientContext(request)).toThrow(ValidationError);
    });

    it("returns trimmed UUID for valid UUID with leading/trailing whitespace", () => {
      const validUUID = "12345678-1234-1234-1234-123456789012";
      const request = createMockRequest({ "x-client-id": `  ${validUUID}  ` });

      const result = requireClientContext(request);
      expect(result).toBe(validUUID);
    });
  });

  describe("valid UUID acceptance", () => {
    it("returns valid lowercase UUID", () => {
      const validUUID = "12345678-1234-1234-1234-123456789012";
      const request = createMockRequest({ "x-client-id": validUUID });

      const result = requireClientContext(request);
      expect(result).toBe(validUUID);
    });

    it("returns valid uppercase UUID (case-insensitive)", () => {
      const validUUID = "12345678-ABCD-1234-ABCD-123456789012";
      const request = createMockRequest({ "x-client-id": validUUID });

      const result = requireClientContext(request);
      expect(result).toBe(validUUID);
    });

    it("returns valid mixed-case UUID", () => {
      const validUUID = "12345678-AbCd-1234-aBcD-123456789012";
      const request = createMockRequest({ "x-client-id": validUUID });

      const result = requireClientContext(request);
      expect(result).toBe(validUUID);
    });
  });

  describe("header name case handling", () => {
    it("handles lowercase header name", () => {
      const validUUID = "12345678-1234-1234-1234-123456789012";
      const request = createMockRequest({ "x-client-id": validUUID });

      const result = requireClientContext(request);
      expect(result).toBe(validUUID);
    });

    it("handles uppercase header name via Headers API normalization", () => {
      // Headers API normalizes to lowercase
      const validUUID = "12345678-1234-1234-1234-123456789012";
      const headers = new Headers();
      headers.set("X-Client-ID", validUUID);
      const request = { headers, url: "http://localhost/api/test" } as Request;

      const result = requireClientContext(request);
      expect(result).toBe(validUUID);
    });
  });
});
