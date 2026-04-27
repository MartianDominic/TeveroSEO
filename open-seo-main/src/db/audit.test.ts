/**
 * Tests for audit logging system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./index", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  },
}));

import { logAudit, withAudit, getAuditHistory } from "./audit";
import { db } from "./index";

describe("Audit Logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logAudit", () => {
    it("should log audit entry with basic fields", async () => {
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert);

      await logAudit({
        entityType: "client",
        entityId: "client_123",
        action: "create",
        userId: "user_456",
      });

      expect(mockInsert).toHaveBeenCalled();
    });

    it("should calculate changed fields between old and new values", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      await logAudit({
        entityType: "client",
        entityId: "client_123",
        action: "update",
        oldValues: { name: "Old Name", status: "active" },
        newValues: { name: "New Name", status: "active" },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "client",
          entityId: "client_123",
          action: "update",
          changedFields: ["name"],
        })
      );
    });

    it("should redact sensitive fields in logged values", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      await logAudit({
        entityType: "api_key",
        entityId: "key_123",
        action: "create",
        newValues: {
          name: "My API Key",
          keyHash: "super_secret_hash",
          password: "should_be_redacted",
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: {
            name: "My API Key",
            keyHash: "[REDACTED]",
            password: "[REDACTED]",
          },
        })
      );
    });

    it("should handle nested sensitive fields", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      await logAudit({
        entityType: "connection",
        entityId: "conn_123",
        action: "create",
        newValues: {
          name: "GSC Connection",
          credentials: {
            accessToken: "token_value",
            refreshToken: "refresh_value",
          },
        },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: {
            name: "GSC Connection",
            credentials: "[REDACTED]",
          },
        })
      );
    });

    it("should not throw on database errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error("DB Error")),
      } as never);

      // Should not throw
      await expect(
        logAudit({
          entityType: "client",
          entityId: "client_123",
          action: "create",
        })
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[AUDIT] Failed to log audit entry:",
        expect.any(Error),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("withAudit", () => {
    it("should create audit helper with context", () => {
      const audit = withAudit<{ id: string; name: string }>("client", {
        userId: "user_123",
        organizationId: "org_456",
      });

      expect(audit).toHaveProperty("logCreate");
      expect(audit).toHaveProperty("logUpdate");
      expect(audit).toHaveProperty("logDelete");
      expect(audit).toHaveProperty("logSensitiveRead");
    });

    it("should log create operation", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      const audit = withAudit<{ id: string; name: string }>("client", {
        userId: "user_123",
      });

      await audit.logCreate("client_new", { id: "client_new", name: "Test" });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "client",
          entityId: "client_new",
          action: "create",
          userId: "user_123",
          newValues: { id: "client_new", name: "Test" },
        })
      );
    });

    it("should log update operation with changed fields", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      const audit = withAudit<{ id: string; name: string; status: string }>(
        "client",
        { userId: "user_123" }
      );

      await audit.logUpdate(
        "client_1",
        { id: "client_1", name: "Old", status: "active" },
        { id: "client_1", name: "New", status: "active" }
      );

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "update",
          changedFields: ["name"],
        })
      );
    });

    it("should log delete operation", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      const audit = withAudit<{ id: string; name: string }>("client", {
        userId: "user_123",
      });

      await audit.logDelete("client_1", { id: "client_1", name: "Deleted" });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delete",
          oldValues: { id: "client_1", name: "Deleted" },
        })
      );
    });

    it("should log sensitive read operation", async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.insert).mockReturnValue({
        values: mockValues,
      } as never);

      const audit = withAudit<{ id: string }>("api_key", {
        userId: "user_123",
      });

      await audit.logSensitiveRead("key_1", ["keyHash", "scopes"]);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "read_sensitive",
          metadata: expect.objectContaining({
            accessedFields: ["keyHash", "scopes"],
          }),
        })
      );
    });
  });

  describe("getAuditHistory", () => {
    it("should query audit logs for an entity", async () => {
      const mockLimit = vi.fn().mockResolvedValue([
        { id: "log_1", action: "create" },
        { id: "log_2", action: "update" },
      ]);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }),
      } as never);

      const history = await getAuditHistory("client", "client_123", 10);

      expect(history).toHaveLength(2);
      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });
});
