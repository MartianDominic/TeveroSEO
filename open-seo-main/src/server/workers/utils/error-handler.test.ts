/**
 * Tests for Error Handler Utilities
 * Phase 96-Security: SEC-005 Fix Tests - Sanitized Error Responses
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSanitizedErrorResponse,
  handleApiError,
  getErrorCode,
  withApiErrorHandler,
  ERROR_CODES,
  type ErrorCode,
} from "./error-handler";

// Mock the logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("Sanitized Error Responses (SEC-005)", () => {
  describe("createSanitizedErrorResponse", () => {
    it("should return sanitized response without internal details", () => {
      const internalError = new Error("Database connection failed at /var/app/db/connection.ts:45");

      const response = createSanitizedErrorResponse(internalError);

      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INTERNAL_ERROR");
      expect(response.error.message).not.toContain("/var/app");
      expect(response.error.message).not.toContain("Database");
      expect(response.error.message).toBe("An unexpected error occurred. Please try again later.");
      expect(response.error.requestId).toBeDefined();
    });

    it("should include requestId for correlation", () => {
      const response = createSanitizedErrorResponse(new Error("test"));

      expect(response.error.requestId).toBeDefined();
      expect(typeof response.error.requestId).toBe("string");
      expect(response.error.requestId.length).toBeGreaterThan(0);
    });

    it("should handle non-Error objects", () => {
      const response = createSanitizedErrorResponse("string error");

      expect(response.success).toBe(false);
      expect(response.error.code).toBe("INTERNAL_ERROR");
    });

    it("should use provided error code", () => {
      const response = createSanitizedErrorResponse(
        new Error("test"),
        "VALIDATION_ERROR"
      );

      expect(response.error.code).toBe("VALIDATION_ERROR");
      expect(response.error.message).toBe("The request contains invalid data.");
    });

    it("should map all error codes to safe messages", () => {
      const codes: ErrorCode[] = Object.keys(ERROR_CODES) as ErrorCode[];

      for (const code of codes) {
        const response = createSanitizedErrorResponse(new Error("test"), code);
        expect(response.error.code).toBe(code);
        expect(response.error.message).not.toContain("test");
        expect(response.error.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe("handleApiError", () => {
    it("should return Response object with sanitized error", async () => {
      const error = new Error("Internal database error at /path/to/file.ts");

      const response = handleApiError(error);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.message).not.toContain("/path/to");
    });

    it("should use correct status code for each error type", async () => {
      const testCases: Array<{ code: ErrorCode; expectedStatus: number }> = [
        { code: "INTERNAL_ERROR", expectedStatus: 500 },
        { code: "VALIDATION_ERROR", expectedStatus: 400 },
        { code: "BAD_REQUEST", expectedStatus: 400 },
        { code: "UNAUTHORIZED", expectedStatus: 401 },
        { code: "FORBIDDEN", expectedStatus: 403 },
        { code: "NOT_FOUND", expectedStatus: 404 },
        { code: "RATE_LIMITED", expectedStatus: 429 },
        { code: "SERVICE_UNAVAILABLE", expectedStatus: 503 },
      ];

      for (const { code, expectedStatus } of testCases) {
        const response = handleApiError(new Error("test"), undefined, code, expectedStatus);
        expect(response.status).toBe(expectedStatus);
      }
    });

    it("should include path in logging context when request provided", async () => {
      const request = new Request("https://example.com/api/test?foo=bar", {
        method: "POST",
      });

      const response = handleApiError(new Error("test"), request);

      // Response should still be sanitized
      const body = await response.json();
      expect(body.error.message).not.toContain("/api/test");
    });
  });

  describe("getErrorCode", () => {
    it("should detect validation errors", () => {
      expect(getErrorCode(new Error("Invalid email format"))).toBe("VALIDATION_ERROR");
    });

    it("should detect not found errors", () => {
      expect(getErrorCode(new Error("Resource not found"))).toBe("NOT_FOUND");

      const notFoundError = new Error("Not Found");
      notFoundError.name = "NotFoundError";
      expect(getErrorCode(notFoundError)).toBe("NOT_FOUND");
    });

    it("should detect unauthorized errors", () => {
      expect(getErrorCode(new Error("Unauthorized access"))).toBe("UNAUTHORIZED");
    });

    it("should detect forbidden errors", () => {
      expect(getErrorCode(new Error("Permission denied"))).toBe("FORBIDDEN");
    });

    it("should detect rate limit errors", () => {
      expect(getErrorCode(new Error("Rate limit exceeded"))).toBe("RATE_LIMITED");
      expect(getErrorCode(new Error("Too many requests"))).toBe("RATE_LIMITED");
    });

    it("should default to INTERNAL_ERROR for unknown errors", () => {
      expect(getErrorCode(new Error("Something went wrong"))).toBe("INTERNAL_ERROR");
      expect(getErrorCode("string error")).toBe("INTERNAL_ERROR");
      expect(getErrorCode(null)).toBe("INTERNAL_ERROR");
    });
  });

  describe("withApiErrorHandler", () => {
    it("should pass through successful responses", async () => {
      const handler = withApiErrorHandler(async () => {
        return Response.json({ success: true, data: "test" });
      });

      const response = await handler(new Request("https://example.com"));
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toBe("test");
    });

    it("should catch and sanitize errors", async () => {
      const handler = withApiErrorHandler(async () => {
        throw new Error("Secret database password is 12345 at /etc/secrets");
      });

      const response = await handler(new Request("https://example.com"));
      const body = await response.json();

      expect(body.success).toBe(false);
      expect(body.error.message).not.toContain("12345");
      expect(body.error.message).not.toContain("/etc/secrets");
      expect(body.error.requestId).toBeDefined();
    });

    it("should detect error type and use appropriate status", async () => {
      const handler = withApiErrorHandler(async () => {
        throw new Error("Resource not found");
      });

      const response = await handler(new Request("https://example.com"));

      expect(response.status).toBe(404);
    });

    it("should handle async errors", async () => {
      const handler = withApiErrorHandler(async () => {
        await Promise.reject(new Error("Async failure"));
        return Response.json({ success: true });
      });

      const response = await handler(new Request("https://example.com"));
      const body = await response.json();

      expect(body.success).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe("Security: No information leakage", () => {
    const sensitivePatterns = [
      "/home/",
      "/var/",
      "/etc/",
      "password",
      "secret",
      "token",
      "api_key",
      ".ts:",
      ".js:",
      "node_modules",
      "at Object.",
      "at Function.",
      "at process.",
    ];

    it("should not leak file paths in error messages", () => {
      const error = new Error("Error in /home/user/app/src/db/connection.ts:42:15");
      const response = createSanitizedErrorResponse(error);

      for (const pattern of sensitivePatterns) {
        expect(response.error.message).not.toContain(pattern);
      }
    });

    it("should not leak stack traces", () => {
      const error = new Error("Database error");
      error.stack = `Error: Database error
    at Object.<anonymous> (/home/user/app/src/db.ts:10:11)
    at Module._compile (internal/modules/cjs/loader.js:999:30)`;

      const response = createSanitizedErrorResponse(error);

      expect(response.error.message).not.toContain("at Object");
      expect(response.error.message).not.toContain("Module._compile");
    });

    it("should not leak environment details", () => {
      const error = new Error(`Failed to connect to postgres://user:password@localhost:5432/db`);
      const response = createSanitizedErrorResponse(error);

      expect(response.error.message).not.toContain("postgres://");
      expect(response.error.message).not.toContain("password");
      expect(response.error.message).not.toContain("localhost");
    });
  });
});
