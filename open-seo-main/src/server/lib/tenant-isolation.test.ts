/**
 * Tenant Isolation Helper Tests
 * Phase 72-01: Multi-Tenancy Verification
 *
 * Tests for tenant isolation assertion utilities.
 */
import { describe, it, expect } from "vitest";
import {
  assertTenantAccess,
  assertTenantAccessOrThrow,
  filterByTenant,
  assertWorkspaceMatch,
  createTenantContext,
  type TenantContext,
  type WorkspaceOwned,
} from "./tenant-isolation";
import { AppError } from "./errors";

describe("assertTenantAccess", () => {
  const ctx: TenantContext = { workspaceId: "workspace-1", userId: "user-1" };

  it("passes when workspaceId matches", () => {
    const entity: WorkspaceOwned = { workspaceId: "workspace-1" };
    expect(() => assertTenantAccess(ctx, entity, "contract")).not.toThrow();
  });

  it("throws FORBIDDEN when workspaceId differs", () => {
    const entity: WorkspaceOwned = { workspaceId: "workspace-2" };
    expect(() => assertTenantAccess(ctx, entity, "contract")).toThrow(AppError);
    try {
      assertTenantAccess(ctx, entity, "contract");
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
    }
  });

  it("includes entity type in error message", () => {
    const entity: WorkspaceOwned = { workspaceId: "workspace-2" };
    try {
      assertTenantAccess(ctx, entity, "proposal");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).message).toContain("proposal");
    }
  });

  it("uses default entity type if not provided", () => {
    const entity: WorkspaceOwned = { workspaceId: "workspace-2" };
    try {
      assertTenantAccess(ctx, entity);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as AppError).message).toContain("resource");
    }
  });
});

describe("assertTenantAccessOrThrow", () => {
  const ctx: TenantContext = { workspaceId: "workspace-1" };

  it("returns entity when workspaceId matches", () => {
    const entity = { workspaceId: "workspace-1", id: "test-id", name: "Test" };
    const result = assertTenantAccessOrThrow(ctx, entity, "contract");
    expect(result).toBe(entity);
    expect(result.id).toBe("test-id");
  });

  it("throws NOT_FOUND when entity is null", () => {
    expect(() => assertTenantAccessOrThrow(ctx, null, "contract")).toThrow(AppError);
    try {
      assertTenantAccessOrThrow(ctx, null, "contract");
    } catch (e) {
      expect((e as AppError).code).toBe("NOT_FOUND");
      expect((e as AppError).message).toContain("contract");
    }
  });

  it("throws NOT_FOUND when entity is undefined", () => {
    expect(() => assertTenantAccessOrThrow(ctx, undefined, "contract")).toThrow(AppError);
    try {
      assertTenantAccessOrThrow(ctx, undefined, "contract");
    } catch (e) {
      expect((e as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("throws FORBIDDEN when workspaceId differs", () => {
    const entity = { workspaceId: "workspace-2", id: "test-id" };
    expect(() => assertTenantAccessOrThrow(ctx, entity, "contract")).toThrow(AppError);
    try {
      assertTenantAccessOrThrow(ctx, entity, "contract");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
    }
  });
});

describe("filterByTenant", () => {
  const ctx: TenantContext = { workspaceId: "workspace-1" };

  it("returns only entities matching workspaceId", () => {
    const entities = [
      { workspaceId: "workspace-1", id: "1" },
      { workspaceId: "workspace-2", id: "2" },
      { workspaceId: "workspace-1", id: "3" },
      { workspaceId: "workspace-3", id: "4" },
    ];

    const filtered = filterByTenant(ctx, entities);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("returns empty array when no entities match", () => {
    const entities = [
      { workspaceId: "workspace-2", id: "1" },
      { workspaceId: "workspace-3", id: "2" },
    ];

    const filtered = filterByTenant(ctx, entities);
    expect(filtered).toHaveLength(0);
  });

  it("returns all entities when all match", () => {
    const entities = [
      { workspaceId: "workspace-1", id: "1" },
      { workspaceId: "workspace-1", id: "2" },
    ];

    const filtered = filterByTenant(ctx, entities);
    expect(filtered).toHaveLength(2);
  });

  it("handles empty array", () => {
    const filtered = filterByTenant(ctx, []);
    expect(filtered).toHaveLength(0);
  });
});

describe("assertWorkspaceMatch", () => {
  const ctx: TenantContext = { workspaceId: "workspace-1" };

  it("passes when workspace IDs match", () => {
    expect(() => assertWorkspaceMatch(ctx, "workspace-1")).not.toThrow();
  });

  it("throws FORBIDDEN when workspace IDs differ", () => {
    expect(() => assertWorkspaceMatch(ctx, "workspace-2")).toThrow(AppError);
    try {
      assertWorkspaceMatch(ctx, "workspace-2");
    } catch (e) {
      expect((e as AppError).code).toBe("FORBIDDEN");
      expect((e as AppError).message).toContain("another workspace");
    }
  });
});

describe("createTenantContext", () => {
  it("creates context with workspaceId only", () => {
    const ctx = createTenantContext("workspace-1");
    expect(ctx.workspaceId).toBe("workspace-1");
    expect(ctx.userId).toBeUndefined();
  });

  it("creates context with workspaceId and userId", () => {
    const ctx = createTenantContext("workspace-1", "user-123");
    expect(ctx.workspaceId).toBe("workspace-1");
    expect(ctx.userId).toBe("user-123");
  });
});
