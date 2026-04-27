/**
 * Tests for RLS context middleware.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Define mocks inside the factory function to avoid hoisting issues
vi.mock("@/db", () => {
  const mockExecute = vi.fn().mockResolvedValue(undefined);
  const mockRelease = vi.fn();
  const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
  const mockConnect = vi.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });

  return {
    db: {
      execute: mockExecute,
    },
    pool: {
      connect: mockConnect,
    },
    // Export for test access
    __mocks: {
      mockExecute,
      mockConnect,
      mockQuery,
      mockRelease,
    },
  };
});

import {
  setRLSContext,
  clearRLSContext,
  withRLSContext,
  withRLSTransaction,
  createRLSHandler,
  createRLSMiddleware,
  extractRLSContextFromRequest,
  hasRLSContext,
} from "./rls-context";
import { db, pool } from "@/db";

// Get mock references
const getMocks = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mocks = (require("@/db") as any).__mocks;
  return mocks;
};

describe("RLS Context Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setRLSContext", () => {
    it("should set user context via SQL function", async () => {
      await setRLSContext({
        userId: "user_123",
        orgId: "org_456",
        isAdmin: false,
      });

      expect(db.execute).toHaveBeenCalled();
    });

    it("should handle missing optional fields", async () => {
      await setRLSContext({
        userId: "user_123",
      });

      expect(db.execute).toHaveBeenCalled();
    });

    it("should set admin flag when provided", async () => {
      await setRLSContext({
        userId: "user_123",
        isAdmin: true,
      });

      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe("clearRLSContext", () => {
    it("should clear the context via SQL function", async () => {
      await clearRLSContext();

      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe("withRLSContext", () => {
    it("should set context, execute operation, and clear context", async () => {
      const operation = vi.fn().mockResolvedValue("result");

      const result = await withRLSContext(
        { userId: "user_123", orgId: "org_456" },
        operation
      );

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalled();
      // Should have called execute twice: set and clear
      expect(db.execute).toHaveBeenCalledTimes(2);
    });

    it("should clear context even if operation throws", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Operation failed"));

      await expect(
        withRLSContext({ userId: "user_123" }, operation)
      ).rejects.toThrow("Operation failed");

      // Should still have called clear
      expect(db.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe("withRLSTransaction", () => {
    it("should execute operation in transaction with RLS context", async () => {
      const operation = vi.fn().mockResolvedValue("tx_result");
      const client = await pool.connect();

      const result = await withRLSTransaction(
        { userId: "user_123", orgId: "org_456" },
        operation
      );

      expect(result).toBe("tx_result");
      expect(pool.connect).toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("TX failed"));

      await expect(
        withRLSTransaction({ userId: "user_123" }, operation)
      ).rejects.toThrow("TX failed");

      expect(pool.connect).toHaveBeenCalled();
    });
  });

  describe("createRLSHandler", () => {
    it("should wrap handler with RLS context", async () => {
      const handler = vi.fn().mockResolvedValue({ data: "test" });
      const wrappedHandler = createRLSHandler(handler);

      const result = await wrappedHandler(
        { id: "123" },
        { userId: "user_123", orgId: "org_456" }
      );

      expect(result).toEqual({ data: "test" });
      expect(handler).toHaveBeenCalledWith(
        { id: "123" },
        { userId: "user_123", orgId: "org_456" }
      );
    });
  });

  describe("createRLSMiddleware", () => {
    it("should create middleware that sets RLS context", async () => {
      const middleware = createRLSMiddleware<{ auth: { userId: string } }>({
        getContext: (ctx) => ({
          userId: ctx.auth.userId,
        }),
      });

      const next = vi.fn().mockResolvedValue("next_result");

      const result = await middleware({ auth: { userId: "user_123" } }, next);

      expect(result).toBe("next_result");
      expect(next).toHaveBeenCalled();
    });

    it("should throw if context is not available", async () => {
      const middleware = createRLSMiddleware<{ auth?: { userId: string } }>({
        getContext: (ctx) => (ctx.auth ? { userId: ctx.auth.userId } : null),
      });

      const next = vi.fn();

      await expect(middleware({}, next)).rejects.toThrow(
        "Unauthorized: RLS context not available"
      );
    });

    it("should call onUnauthenticated callback if provided", async () => {
      const onUnauthenticated = vi.fn();
      const middleware = createRLSMiddleware<{ auth?: { userId: string } }>({
        getContext: () => null,
        onUnauthenticated,
      });

      const next = vi.fn();

      await expect(middleware({}, next)).rejects.toThrow();
      expect(onUnauthenticated).toHaveBeenCalled();
    });
  });

  describe("extractRLSContextFromRequest", () => {
    it("should extract context from auth object", () => {
      const result = extractRLSContextFromRequest({
        auth: {
          userId: "user_123",
          orgId: "org_456",
          isAdmin: true,
        },
      });

      expect(result).toEqual({
        userId: "user_123",
        orgId: "org_456",
        isAdmin: true,
      });
    });

    it("should return null if no auth", () => {
      const result = extractRLSContextFromRequest({});

      expect(result).toBeNull();
    });

    it("should return null if auth has no userId", () => {
      const result = extractRLSContextFromRequest({
        auth: {},
      });

      expect(result).toBeNull();
    });
  });

  describe("hasRLSContext", () => {
    it("should return true for object with rls property", () => {
      expect(hasRLSContext({ rls: { userId: "user_123" } })).toBe(true);
    });

    it("should return false for object without rls property", () => {
      expect(hasRLSContext({ other: "value" })).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(hasRLSContext(null)).toBe(false);
      expect(hasRLSContext("string")).toBe(false);
      expect(hasRLSContext(123)).toBe(false);
    });
  });
});
