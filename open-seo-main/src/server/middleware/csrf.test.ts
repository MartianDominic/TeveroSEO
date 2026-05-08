/**
 * CSRF Middleware Tests
 * Tests for double-submit cookie CSRF protection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCsrfToken,
  getCsrfTokenFromCookie,
  getCsrfTokenFromHeader,
  validateCsrfToken,
  csrfProtect,
  csrfErrorResponse,
  buildCsrfCookie,
  setCsrfCookie,
  COOKIE_NAME,
  HEADER_NAME,
} from "./csrf";

describe("CSRF Middleware", () => {
  describe("generateCsrfToken", () => {
    it("should generate a 64-character hex token", () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCsrfToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  describe("getCsrfTokenFromCookie", () => {
    it("should extract token from cookie header", () => {
      const request = new Request("http://test.com", {
        headers: { Cookie: `${COOKIE_NAME}=abc123def456` },
      });
      expect(getCsrfTokenFromCookie(request)).toBe("abc123def456");
    });

    it("should return null when no cookie header", () => {
      const request = new Request("http://test.com");
      expect(getCsrfTokenFromCookie(request)).toBeNull();
    });

    it("should return null when CSRF cookie not present", () => {
      const request = new Request("http://test.com", {
        headers: { Cookie: "other_cookie=value" },
      });
      expect(getCsrfTokenFromCookie(request)).toBeNull();
    });

    it("should handle multiple cookies", () => {
      const request = new Request("http://test.com", {
        headers: { Cookie: `session=xyz; ${COOKIE_NAME}=mytoken; other=abc` },
      });
      expect(getCsrfTokenFromCookie(request)).toBe("mytoken");
    });

    it("should handle cookies with spaces", () => {
      const request = new Request("http://test.com", {
        headers: { Cookie: `  ${COOKIE_NAME}  =  token123  ; other=val` },
      });
      expect(getCsrfTokenFromCookie(request)).toBe("token123");
    });
  });

  describe("getCsrfTokenFromHeader", () => {
    it("should extract token from X-CSRF-Token header", () => {
      const request = new Request("http://test.com", {
        headers: { [HEADER_NAME]: "headertoken123" },
      });
      expect(getCsrfTokenFromHeader(request)).toBe("headertoken123");
    });

    it("should return null when header not present", () => {
      const request = new Request("http://test.com");
      expect(getCsrfTokenFromHeader(request)).toBeNull();
    });
  });

  describe("validateCsrfToken", () => {
    const validToken = generateCsrfToken();

    it("should skip validation for GET requests", () => {
      const request = new Request("http://test.com", { method: "GET" });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("safe_method");
    });

    it("should skip validation for HEAD requests", () => {
      const request = new Request("http://test.com", { method: "HEAD" });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it("should skip validation for OPTIONS requests", () => {
      const request = new Request("http://test.com", { method: "OPTIONS" });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
    });

    it("should skip validation for API key authenticated requests", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: { "x-api-key": "oseo_test_key_123" },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("api_key_auth");
    });

    it("should skip validation for Bearer API key auth", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: { Authorization: "Bearer oseo_test_key_123" },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("api_key_auth");
    });

    it("should skip validation for webhook endpoints", () => {
      const request = new Request("http://test.com/api/stripe/webhook", {
        method: "POST",
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe("webhook");
    });

    it("should fail when cookie token is missing", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: { [HEADER_NAME]: validToken },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cookie missing");
    });

    it("should fail when header token is missing", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: { Cookie: `${COOKIE_NAME}=${validToken}` },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("header missing");
    });

    it("should fail when tokens do not match", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: generateCsrfToken(), // Different token
        },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid CSRF token");
    });

    it("should fail when token lengths differ", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: "short",
        },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid CSRF token");
    });

    it("should succeed when tokens match", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: validToken,
        },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
      expect(result.skipped).toBeUndefined();
    });

    it("should validate PUT requests", () => {
      const request = new Request("http://test.com", {
        method: "PUT",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: validToken,
        },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("should validate PATCH requests", () => {
      const request = new Request("http://test.com", {
        method: "PATCH",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: validToken,
        },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });

    it("should validate DELETE requests", () => {
      const request = new Request("http://test.com", {
        method: "DELETE",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: validToken,
        },
      });
      const result = validateCsrfToken(request);
      expect(result.valid).toBe(true);
    });
  });

  describe("csrfProtect", () => {
    const validToken = generateCsrfToken();

    it("should return null for valid requests", () => {
      const request = new Request("http://test.com", {
        method: "POST",
        headers: {
          Cookie: `${COOKIE_NAME}=${validToken}`,
          [HEADER_NAME]: validToken,
        },
      });
      expect(csrfProtect(request)).toBeNull();
    });

    it("should return Response for invalid requests", () => {
      const request = new Request("http://test.com", {
        method: "POST",
      });
      const response = csrfProtect(request);
      expect(response).toBeInstanceOf(Response);
      expect(response?.status).toBe(403);
    });

    it("should return null for safe methods", () => {
      const request = new Request("http://test.com", { method: "GET" });
      expect(csrfProtect(request)).toBeNull();
    });
  });

  describe("csrfErrorResponse", () => {
    it("should return 403 status", async () => {
      const response = csrfErrorResponse();
      expect(response.status).toBe(403);
    });

    it("should return JSON body with error", async () => {
      const response = csrfErrorResponse();
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("CSRF validation failed");
      expect(body.code).toBe("CSRF_VALIDATION_FAILED");
    });

    it("should use custom error message", async () => {
      const response = csrfErrorResponse("Custom error");
      const body = await response.json();
      expect(body.error).toBe("Custom error");
    });
  });

  describe("buildCsrfCookie", () => {
    it("should include HttpOnly flag", () => {
      const cookie = buildCsrfCookie("token123");
      expect(cookie).toContain("HttpOnly");
    });

    it("should include SameSite=Strict", () => {
      const cookie = buildCsrfCookie("token123");
      expect(cookie).toContain("SameSite=Strict");
    });

    it("should include Path=/", () => {
      const cookie = buildCsrfCookie("token123");
      expect(cookie).toContain("Path=/");
    });

    it("should include Secure flag when secure=true", () => {
      const cookie = buildCsrfCookie("token123", true);
      expect(cookie).toContain("Secure");
    });

    it("should not include Secure flag when secure=false and not production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      const cookie = buildCsrfCookie("token123", false);
      expect(cookie).not.toContain("Secure");
      process.env.NODE_ENV = originalEnv;
    });

    it("should include token value", () => {
      const cookie = buildCsrfCookie("mytoken123");
      expect(cookie).toContain("__csrf=mytoken123");
    });
  });

  describe("setCsrfCookie", () => {
    it("should append Set-Cookie header to response", () => {
      const response = new Response("test");
      const token = "token123";
      const modifiedResponse = setCsrfCookie(response, token);
      expect(modifiedResponse.headers.get("Set-Cookie")).toContain(token);
    });
  });
});
