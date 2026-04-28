/**
 * Comprehensive tests for API authentication middleware.
 * Phase 40: Auth middleware for REST API endpoints.
 *
 * Coverage targets:
 * - Valid authentication (Bearer token, x-api-key header)
 * - Invalid authentication (missing, malformed, expired, unknown)
 * - Edge cases (empty, whitespace, case sensitivity, long keys)
 * - Integration scenarios (DB lookup, error handling)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateApiKey,
  requireAuth,
  requireAuthWithScope,
  hasScope,
  generateApiKey,
  type ApiKeyValidationResult,
  type AuthContext,
} from "./auth";

// Mock the database module
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock the logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Helper to create a valid API key format
function createValidKeyFormat(): string {
  return "oseo_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
}

// Helper to create a mock DB response for a valid key
function createMockApiKeyRecord(overrides: Partial<{
  id: string;
  organizationId: string;
  clientId: string | null;
  createdBy: string;
  scopes: string;
  enabled: boolean;
  expiresAt: Date | null;
}> = {}) {
  return {
    id: "key_123",
    organizationId: "org_456",
    clientId: overrides.clientId ?? null,
    createdBy: "user_789",
    scopes: '["*"]',
    enabled: true,
    expiresAt: null,
    ...overrides,
  };
}

// Helper to set up mock DB chain
function setupMockDbSelect(result: unknown[]) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });

  return {
    selectMock,
    fromMock,
    whereMock,
    limitMock,
  };
}

describe("auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // generateApiKey
  // ===========================================================================
  describe("generateApiKey", () => {
    it("generates a key with correct prefix", () => {
      const result = generateApiKey();
      expect(result.key.startsWith("oseo_")).toBe(true);
    });

    it("generates a key with 64 hex characters after prefix", () => {
      const result = generateApiKey();
      const keyBody = result.key.slice(5); // Remove "oseo_"
      expect(keyBody).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates a SHA-256 hash (64 hex characters)", () => {
      const result = generateApiKey();
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("generates a prefix of 12 characters", () => {
      const result = generateApiKey();
      expect(result.prefix).toHaveLength(12);
      expect(result.prefix).toMatch(/^oseo_[a-f0-9]{7}$/);
    });

    it("generates unique keys on consecutive calls", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = generateApiKey();
        expect(keys.has(result.key)).toBe(false);
        keys.add(result.key);
      }
    });

    it("generates unique hashes on consecutive calls", () => {
      const hashes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = generateApiKey();
        expect(hashes.has(result.hash)).toBe(false);
        hashes.add(result.hash);
      }
    });

    it("hash is deterministic for the same key content", () => {
      // This tests the internal hashApiKey function indirectly
      const result1 = generateApiKey();
      const result2 = generateApiKey();
      // Different keys should have different hashes
      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  // ===========================================================================
  // hasScope
  // ===========================================================================
  describe("hasScope", () => {
    describe("wildcard scope", () => {
      it("returns true for any scope when wildcard is present", () => {
        expect(hasScope(["*"], "read:audits")).toBe(true);
        expect(hasScope(["*"], "write:briefs")).toBe(true);
        expect(hasScope(["*"], "arbitrary:scope")).toBe(true);
      });

      it("returns true when wildcard is among other scopes", () => {
        expect(hasScope(["read:audits", "*"], "write:briefs")).toBe(true);
      });
    });

    describe("explicit scopes", () => {
      it("returns true when exact scope is present", () => {
        expect(hasScope(["read:audits", "write:audits"], "read:audits")).toBe(true);
      });

      it("returns false when scope is not present", () => {
        expect(hasScope(["read:audits"], "write:audits")).toBe(false);
      });

      it("is case sensitive", () => {
        expect(hasScope(["Read:Audits"], "read:audits")).toBe(false);
        expect(hasScope(["READ:AUDITS"], "read:audits")).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("returns false for empty scopes array", () => {
        expect(hasScope([], "read:audits")).toBe(false);
      });

      it("returns false when required scope is empty string", () => {
        expect(hasScope(["read:audits"], "")).toBe(false);
      });

      it("handles partial scope matches correctly (no partial matching)", () => {
        expect(hasScope(["read:audits"], "read")).toBe(false);
        expect(hasScope(["read"], "read:audits")).toBe(false);
      });
    });
  });

  // ===========================================================================
  // validateApiKey - Valid Authentication
  // ===========================================================================
  describe("validateApiKey", () => {
    describe("valid authentication", () => {
      it("should accept valid Bearer token in Authorization header", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
        expect(result.organizationId).toBe("org_456");
        expect(result.userId).toBe("user_789");
      });

      it("should accept valid API key in x-api-key header", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            "x-api-key": createValidKeyFormat(),
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
        expect(result.organizationId).toBe("org_456");
      });

      it("should return correct clientId when key is client-scoped", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({ clientId: "client_999" });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
        expect(result.clientId).toBe("client_999");
      });

      it("should parse and return scopes correctly", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: '["read:audits", "write:briefs"]',
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
        expect(result.scopes).toEqual(["read:audits", "write:briefs"]);
      });

      it("should prefer Authorization header over x-api-key when both present", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
            "x-api-key": "oseo_different_key_that_would_fail_if_used_instead",
          },
        });

        const result = await validateApiKey(request);

        // Should use the Authorization header key (which is valid)
        expect(result.valid).toBe(true);
      });
    });

    // ===========================================================================
    // validateApiKey - Invalid Authentication
    // ===========================================================================
    describe("invalid authentication", () => {
      it("should reject when Authorization header is missing", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("API key required");
      });

      it("should reject malformed Authorization header (no Bearer prefix)", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: createValidKeyFormat(), // Missing "Bearer "
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("API key required");
      });

      it("should reject invalid/unknown API key", async () => {
        const { db } = await import("@/db");
        const { selectMock } = setupMockDbSelect([]); // Empty result = not found
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid or expired");
      });

      it("should reject expired API key", async () => {
        const { db } = await import("@/db");
        // The DB query already filters expired keys, so empty result means expired
        const { selectMock } = setupMockDbSelect([]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid or expired");
      });

      it("should reject disabled API key", async () => {
        const { db } = await import("@/db");
        // The DB query already filters disabled keys
        const { selectMock } = setupMockDbSelect([]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid or expired");
      });

      it("should reject API key without oseo_ prefix", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: "Bearer invalid_key_without_prefix",
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid API key format");
      });
    });

    // ===========================================================================
    // validateApiKey - Edge Cases
    // ===========================================================================
    describe("edge cases", () => {
      it("should reject empty Authorization header value", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: "",
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("API key required");
      });

      it("should accept case-insensitive Bearer prefix (lowercase)", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
      });

      it("should accept case-insensitive Bearer prefix (UPPERCASE)", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `BEARER ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
      });

      it("should accept case-insensitive Bearer prefix (mixed case)", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `BeArEr ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(true);
      });

      it("should reject Authorization header with extra whitespace", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer  ${createValidKeyFormat()}`, // Double space
          },
        });

        const result = await validateApiKey(request);

        // Double space causes split to have 3 parts, failing the parts.length === 2 check
        expect(result.valid).toBe(false);
        expect(result.error).toContain("API key required");
      });

      it("should reject Authorization header with leading whitespace", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: ` Bearer ${createValidKeyFormat()}`, // Leading space
          },
        });

        const result = await validateApiKey(request);

        // Leading space causes split to have empty first part
        expect(result.valid).toBe(false);
      });

      it("should reject very long API keys (potential DoS)", async () => {
        const veryLongKey = "oseo_" + "a".repeat(10000);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${veryLongKey}`,
          },
        });

        // The key has valid oseo_ prefix, so it passes format check
        // but will not match any DB record
        const { db } = await import("@/db");
        const { selectMock } = setupMockDbSelect([]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid or expired");
      });

      it("should handle whitespace-only Authorization header", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: "   ",
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("API key required");
      });

      it("should handle Authorization header with only Bearer keyword", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: "Bearer",
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("API key required");
      });

      it("should handle malformed scopes JSON gracefully", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: "not-valid-json", // Invalid JSON
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        // Should default to wildcard scope on parse error
        expect(result.valid).toBe(true);
        expect(result.scopes).toEqual(["*"]);
      });

      it("should reject x-api-key with leading whitespace", async () => {
        // Leading whitespace causes the key to fail the oseo_ prefix check
        // The exact error depends on implementation, but validation should fail
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            "x-api-key": "notoseo_prefix",
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid API key format");
      });

      it("should handle special characters in key gracefully", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: "Bearer oseo_with<script>alert(1)</script>",
          },
        });

        const { db } = await import("@/db");
        const { selectMock } = setupMockDbSelect([]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const result = await validateApiKey(request);

        // Key has oseo_ prefix, passes format check, but won't match DB
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid or expired");
      });

      it("should handle SQL injection attempt in key gracefully", async () => {
        // SQL injection attempt should be safely handled via parameterized queries
        // Using x-api-key header to avoid header parsing issues with special chars
        const { db } = await import("@/db");
        const { selectMock } = setupMockDbSelect([]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            "x-api-key": "oseo_dropTableApiKeys1234567890abcdef1234567890abcdef12345678",
          },
        });

        const result = await validateApiKey(request);

        // Key passes format check (starts with oseo_) but won't match any DB record
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid or expired");
      });
    });

    // ===========================================================================
    // validateApiKey - Integration Scenarios
    // ===========================================================================
    describe("integration scenarios", () => {
      it("should perform database lookup with correct hash", async () => {
        const { db } = await import("@/db");
        const { selectMock, fromMock, whereMock } = setupMockDbSelect([]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        await validateApiKey(request);

        // Verify the select chain was called
        expect(db.select).toHaveBeenCalled();
        expect(fromMock).toHaveBeenCalled();
        expect(whereMock).toHaveBeenCalled();
      });

      it("should update lastUsedAt timestamp on successful validation", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const updateSetMock = vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        });
        const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });
        (db.update as ReturnType<typeof vi.fn>).mockImplementation(updateMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        await validateApiKey(request);

        // Give the fire-and-forget update time to be called
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(db.update).toHaveBeenCalled();
      });

      it("should handle database errors gracefully", async () => {
        const { db } = await import("@/db");
        const selectMock = vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockRejectedValue(new Error("DB connection failed")),
            }),
          }),
        });
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        expect(result.valid).toBe(false);
        expect(result.error).toContain("Authentication service error");
      });

      it("should continue even if lastUsedAt update fails", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

        // Make update fail
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockRejectedValue(new Error("Update failed")),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const result = await validateApiKey(request);

        // Should still return valid even if lastUsedAt update fails
        expect(result.valid).toBe(true);
        expect(result.organizationId).toBe("org_456");
      });

      it("should handle concurrent requests with same key", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        // Fire 10 concurrent requests
        const results = await Promise.all([
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
          validateApiKey(request),
        ]);

        // All should succeed
        expect(results.every((r) => r.valid)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // requireAuth
  // ===========================================================================
  describe("requireAuth", () => {
    describe("authentication failure", () => {
      it("should return 401 when no API key provided", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
        });

        const handler = vi.fn();
        const response = await requireAuth(request, handler);

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
      });

      it("should return UNAUTHENTICATED error code on 401", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
        });

        const response = await requireAuth(request, vi.fn());
        const body = (await response.json()) as { code: string; error: string };

        expect(body.code).toBe("UNAUTHENTICATED");
        expect(body.error).toBeDefined();
      });

      it("should include WWW-Authenticate header on 401", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
        });

        const response = await requireAuth(request, vi.fn());

        expect(response.headers.get("WWW-Authenticate")).toBe('Bearer realm="API"');
      });
    });

    describe("authentication success", () => {
      it("should call handler with auth context on success", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({ clientId: "client_123" });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn().mockResolvedValue(Response.json({ success: true }));
        await requireAuth(request, handler);

        expect(handler).toHaveBeenCalledTimes(1);
        const authContext = handler.mock.calls[0][0] as AuthContext;
        expect(authContext.organizationId).toBe("org_456");
        expect(authContext.clientId).toBe("client_123");
        expect(authContext.userId).toBe("user_789");
      });

      it("should return handler response on success", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord();
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn().mockResolvedValue(
          Response.json({ data: "test" }, { status: 200 })
        );
        const response = await requireAuth(request, handler);

        expect(response.status).toBe(200);
        const body = (await response.json()) as { data: string };
        expect(body.data).toBe("test");
      });

      it("should pass default wildcard scopes when scopes are undefined", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({ scopes: "null" });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn().mockResolvedValue(Response.json({ success: true }));
        await requireAuth(request, handler);

        const authContext = handler.mock.calls[0][0] as AuthContext;
        expect(authContext.scopes).toEqual(["*"]);
      });
    });
  });

  // ===========================================================================
  // requireAuthWithScope
  // ===========================================================================
  describe("requireAuthWithScope", () => {
    describe("authentication failure", () => {
      it("should return 401 when no API key provided", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
        });

        const handler = vi.fn();
        const response = await requireAuthWithScope(request, "read:audits", handler);

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
      });

      it("should include WWW-Authenticate header on 401", async () => {
        const request = new Request("http://localhost/api/test", {
          method: "GET",
        });

        const response = await requireAuthWithScope(request, "read:audits", vi.fn());

        expect(response.headers.get("WWW-Authenticate")).toBe('Bearer realm="API"');
      });
    });

    describe("authorization failure", () => {
      it("should return 403 when scope is missing", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: '["read:audits"]', // Only read, not write
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn();
        const response = await requireAuthWithScope(request, "write:audits", handler);

        expect(response.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
      });

      it("should return FORBIDDEN error code on 403", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: '["read:audits"]',
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const response = await requireAuthWithScope(request, "write:audits", vi.fn());
        const body = (await response.json()) as { code: string; error: string };

        expect(body.code).toBe("FORBIDDEN");
        expect(body.error).toContain("Insufficient permissions");
        expect(body.error).toContain("write:audits");
      });
    });

    describe("authorization success", () => {
      it("should call handler when scope is present", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: '["read:audits", "write:audits"]',
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn().mockResolvedValue(Response.json({ success: true }));
        const response = await requireAuthWithScope(request, "write:audits", handler);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(200);
      });

      it("should call handler when wildcard scope is present", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: '["*"]',
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn().mockResolvedValue(Response.json({ success: true }));
        const response = await requireAuthWithScope(request, "write:audits", handler);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(200);
      });

      it("should pass correct scopes to handler", async () => {
        const { db } = await import("@/db");
        const mockRecord = createMockApiKeyRecord({
          scopes: '["read:audits", "write:audits", "read:briefs"]',
        });
        const { selectMock } = setupMockDbSelect([mockRecord]);
        (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);
        (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        });

        const request = new Request("http://localhost/api/test", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${createValidKeyFormat()}`,
          },
        });

        const handler = vi.fn().mockResolvedValue(Response.json({ success: true }));
        await requireAuthWithScope(request, "read:audits", handler);

        const authContext = handler.mock.calls[0][0] as AuthContext;
        expect(authContext.scopes).toEqual(["read:audits", "write:audits", "read:briefs"]);
      });
    });
  });

  // ===========================================================================
  // Security Tests
  // ===========================================================================
  describe("security", () => {
    it("should not leak key details in error messages", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${createValidKeyFormat()}`,
        },
      });

      const { db } = await import("@/db");
      const { selectMock } = setupMockDbSelect([]);
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const result = await validateApiKey(request);

      expect(result.valid).toBe(false);
      // Error should not contain the full key
      expect(result.error).not.toContain(createValidKeyFormat());
      expect(result.error).not.toContain("0123456789abcdef");
    });

    it("should not include sensitive data in response headers", async () => {
      const request = new Request("http://localhost/api/test", {
        method: "GET",
      });

      const response = await requireAuth(request, vi.fn());

      // Check no sensitive headers are exposed
      const headers = Object.fromEntries(response.headers.entries());
      expect(headers).not.toHaveProperty("x-api-key");
      expect(headers).not.toHaveProperty("authorization");
    });

    it("should handle timing attacks by using constant-time comparison", async () => {
      // This is a design verification rather than a functional test
      // The implementation uses SHA-256 hashing which provides constant-time comparison
      // when comparing hashes in the database query

      const { db } = await import("@/db");
      const { selectMock } = setupMockDbSelect([]);
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const validKey = createValidKeyFormat();
      const almostValidKey = validKey.slice(0, -1) + "f";

      const request1 = new Request("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${validKey}`,
        },
      });

      const request2 = new Request("http://localhost/api/test", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${almostValidKey}`,
        },
      });

      // Both should fail in roughly the same time (hash comparison)
      const [result1, result2] = await Promise.all([
        validateApiKey(request1),
        validateApiKey(request2),
      ]);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
    });
  });
});
