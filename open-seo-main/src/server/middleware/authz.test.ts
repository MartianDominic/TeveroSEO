/**
 * Unit tests for authorization helpers.
 * Tests the client access check logic with mocked database and Redis.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkClientAccess,
  checkClientAccessWithReason,
  requireClientAccess,
  invalidateClientAccessCache,
  invalidateUserAccessCaches,
  invalidateAllClientAccessCaches,
  AuthorizationError,
} from "./authz";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock Redis
vi.mock("@/server/lib/redis", () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  },
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { db } from "@/db";
import { redis } from "@/server/lib/redis";

describe("authz", () => {
  const mockUserId = "user_123";
  const mockClientId = "client_456";
  const mockWorkspaceId = "org_789";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("checkClientAccess", () => {
    it("returns true when user is a member of client workspace", async () => {
      // Cache miss
      vi.mocked(redis.get).mockResolvedValue(null);

      // Mock DB: client exists with workspace
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValueOnce([{ workspaceId: mockWorkspaceId }]) // Client query
              .mockResolvedValueOnce([{ id: "member_1" }]), // Member query
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await checkClientAccess(mockUserId, mockClientId);

      expect(result).toBe(true);
      expect(redis.setex).toHaveBeenCalled();
    });

    it("returns false when client does not exist", async () => {
      // Cache miss
      vi.mocked(redis.get).mockResolvedValue(null);

      // Mock DB: client not found
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // Empty result
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await checkClientAccess(mockUserId, mockClientId);

      expect(result).toBe(false);
    });

    it("returns false when user is not a member of client workspace", async () => {
      // Cache miss
      vi.mocked(redis.get).mockResolvedValue(null);

      // Mock DB: client exists but user not a member
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValueOnce([{ workspaceId: mockWorkspaceId }]) // Client query
              .mockResolvedValueOnce([]), // Member query - empty
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await checkClientAccess(mockUserId, mockClientId);

      expect(result).toBe(false);
    });

    it("uses cached result when available", async () => {
      // Cache hit
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ allowed: true, workspaceId: mockWorkspaceId })
      );

      const result = await checkClientAccess(mockUserId, mockClientId);

      expect(result).toBe(true);
      expect(db.select).not.toHaveBeenCalled(); // No DB call
    });

    it("falls back to DB when cache read fails", async () => {
      // Cache error
      vi.mocked(redis.get).mockRejectedValue(new Error("Redis connection error"));

      // Mock DB: access granted
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValueOnce([{ workspaceId: mockWorkspaceId }])
              .mockResolvedValueOnce([{ id: "member_1" }]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await checkClientAccess(mockUserId, mockClientId);

      expect(result).toBe(true);
      expect(db.select).toHaveBeenCalled(); // Falls back to DB
    });
  });

  describe("checkClientAccessWithReason", () => {
    it("returns client_not_found reason when client does not exist", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await checkClientAccessWithReason(mockUserId, mockClientId);

      expect(result).toEqual({
        allowed: false,
        reason: "client_not_found",
      });
    });

    it("returns not_member reason when user lacks membership", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValueOnce([{ workspaceId: mockWorkspaceId }])
              .mockResolvedValueOnce([]),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect);

      const result = await checkClientAccessWithReason(mockUserId, mockClientId);

      expect(result).toEqual({
        allowed: false,
        reason: "not_member",
        workspaceId: mockWorkspaceId,
      });
    });
  });

  describe("requireClientAccess", () => {
    it("does not throw when user has access", async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ allowed: true, workspaceId: mockWorkspaceId })
      );

      await expect(
        requireClientAccess(mockUserId, mockClientId)
      ).resolves.not.toThrow();
    });

    it("throws AuthorizationError when user lacks access", async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ allowed: false, reason: "not_member" })
      );

      await expect(requireClientAccess(mockUserId, mockClientId)).rejects.toThrow(
        AuthorizationError
      );
    });

    it("includes correct properties in AuthorizationError", async () => {
      vi.mocked(redis.get).mockResolvedValue(
        JSON.stringify({ allowed: false, reason: "client_not_found" })
      );

      try {
        await requireClientAccess(mockUserId, mockClientId);
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(AuthorizationError);
        const authzErr = err as AuthorizationError;
        expect(authzErr.statusCode).toBe(403);
        expect(authzErr.code).toBe("FORBIDDEN");
        expect(authzErr.userId).toBe(mockUserId);
        expect(authzErr.clientId).toBe(mockClientId);
        expect(authzErr.reason).toBe("client_not_found");
      }
    });
  });

  describe("invalidateClientAccessCache", () => {
    it("deletes the cache key for user-client pair", async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await invalidateClientAccessCache(mockUserId, mockClientId);

      expect(redis.del).toHaveBeenCalledWith(
        `authz:client:${mockUserId}:${mockClientId}`
      );
    });

    it("handles Redis errors gracefully", async () => {
      vi.mocked(redis.del).mockRejectedValue(new Error("Redis error"));

      // Should not throw
      await expect(
        invalidateClientAccessCache(mockUserId, mockClientId)
      ).resolves.not.toThrow();
    });
  });

  describe("invalidateUserAccessCaches", () => {
    it("scans and deletes all user access keys", async () => {
      // First scan returns keys, second scan returns empty (end of iteration)
      vi.mocked(redis.scan)
        .mockResolvedValueOnce(["10", ["authz:client:user_123:c1", "authz:client:user_123:c2"]])
        .mockResolvedValueOnce(["0", []]);
      vi.mocked(redis.del).mockResolvedValue(2);

      await invalidateUserAccessCaches(mockUserId);

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `authz:client:${mockUserId}:*`,
        "COUNT",
        100
      );
      expect(redis.del).toHaveBeenCalledWith(
        "authz:client:user_123:c1",
        "authz:client:user_123:c2"
      );
    });
  });

  describe("invalidateAllClientAccessCaches", () => {
    it("scans and deletes all access keys for a client", async () => {
      vi.mocked(redis.scan)
        .mockResolvedValueOnce(["10", ["authz:client:u1:client_456", "authz:client:u2:client_456"]])
        .mockResolvedValueOnce(["0", []]);
      vi.mocked(redis.del).mockResolvedValue(2);

      await invalidateAllClientAccessCaches(mockClientId);

      expect(redis.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        `authz:client:*:${mockClientId}`,
        "COUNT",
        100
      );
      expect(redis.del).toHaveBeenCalledWith(
        "authz:client:u1:client_456",
        "authz:client:u2:client_456"
      );
    });
  });

  describe("AuthorizationError", () => {
    it("has correct error properties", () => {
      const error = new AuthorizationError(mockUserId, mockClientId, "not_member");

      expect(error.name).toBe("AuthorizationError");
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
      expect(error.userId).toBe(mockUserId);
      expect(error.clientId).toBe(mockClientId);
      expect(error.reason).toBe("not_member");
      expect(error.message).toContain(mockUserId);
      expect(error.message).toContain(mockClientId);
    });

    it("defaults reason to no_workspace_access", () => {
      const error = new AuthorizationError(mockUserId, mockClientId);

      expect(error.reason).toBe("no_workspace_access");
    });
  });
});
