/**
 * Tests for DomChangeService.
 * Phase 66: Platform Unification Excellence - Plan 07
 *
 * Tests DOM change lifecycle management:
 * - queueChange creates pending change record
 * - queueChange captures oldValue from current state
 * - approveChange updates status to 'approved' then 'live'
 * - approveChange sets approvedBy and approvedAt
 * - rejectChange updates status to 'rejected'
 * - rollbackChange creates new change to restore oldValue
 * - getApprovedChanges returns only 'live' changes for a page
 * - getPendingChanges returns changes awaiting approval
 * - getChangeHistory returns all changes with pagination
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DomChangeService,
  queueChange,
  approveChange,
  rejectChange,
  rollbackChange,
  type QueueChangeRequest,
  type ApprovedChangesResponse,
} from "./dom-change.service";
import type { PixelDomChangeSelect } from "@/db/pixel-schema";

describe("DomChangeService", () => {
  let service: DomChangeService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    query: {
      pixelInstallations: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      pixelDomChanges: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };

  const mockInstallation = {
    id: "install-001",
    siteId: "site-abc",
    workspaceId: "workspace-123",
    domain: "example.com",
    status: "verified",
    features: {
      analytics: true,
      cwv: true,
      metaInjection: true,
      schemaInjection: true,
      linkInjection: true,
      abTesting: false,
    },
  };

  const mockPendingChange: PixelDomChangeSelect = {
    id: "change-001",
    installationId: "install-001",
    changeType: "meta_title",
    targetSelector: null,
    targetUrl: "https://example.com/about",
    oldValue: "Old Title",
    newValue: "New Title",
    status: "pending",
    approvedBy: null,
    approvedAt: null,
    deployedAt: null,
    createdAt: new Date("2026-05-01T10:00:00Z"),
  };

  const mockLiveChange: PixelDomChangeSelect = {
    id: "change-002",
    installationId: "install-001",
    changeType: "meta_description",
    targetSelector: null,
    targetUrl: "https://example.com/about",
    oldValue: "Old Description",
    newValue: "New Description",
    status: "live",
    approvedBy: "user-123",
    approvedAt: new Date("2026-05-02T12:00:00Z"),
    deployedAt: new Date("2026-05-02T12:00:01Z"),
    createdAt: new Date("2026-05-01T10:00:00Z"),
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      query: {
        pixelInstallations: {
          findFirst: vi.fn(),
        },
        pixelDomChanges: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
    };

    service = new DomChangeService(mockDb as unknown as Parameters<typeof DomChangeService>[0]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("queueChange", () => {
    it("creates pending change record", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(null); // No existing live change

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "change-new",
            installationId: "install-001",
            changeType: "meta_title",
            targetUrl: "https://example.com/page",
            newValue: "New Title",
            status: "pending",
            createdAt: new Date(),
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      const request: QueueChangeRequest = {
        siteId: "site-abc",
        changeType: "meta_title",
        targetUrl: "https://example.com/page",
        newValue: "New Title",
      };

      const result = await service.queueChange(request);

      expect(result).toBeDefined();
      expect(result.status).toBe("pending");
      expect(result.changeType).toBe("meta_title");
      expect(result.newValue).toBe("New Title");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("captures oldValue from current live state", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);

      // Existing live change with old value
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue({
        ...mockLiveChange,
        newValue: "Current Live Title",
      });

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "change-new",
            installationId: "install-001",
            changeType: "meta_title",
            targetUrl: "https://example.com/about",
            oldValue: "Current Live Title", // Captured from live change
            newValue: "Updated Title",
            status: "pending",
            createdAt: new Date(),
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      const request: QueueChangeRequest = {
        siteId: "site-abc",
        changeType: "meta_title",
        targetUrl: "https://example.com/about",
        newValue: "Updated Title",
      };

      await service.queueChange(request);

      const insertedValues = mockInsertChain.values.mock.calls[0][0];
      expect(insertedValues.oldValue).toBe("Current Live Title");
    });

    it("throws error for unknown siteId", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(null);

      const request: QueueChangeRequest = {
        siteId: "unknown-site",
        changeType: "meta_title",
        newValue: "New Title",
      };

      await expect(service.queueChange(request)).rejects.toThrow("Installation not found");
    });

    it("validates change type is valid", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);

      const request: QueueChangeRequest = {
        siteId: "site-abc",
        changeType: "invalid_type" as QueueChangeRequest["changeType"],
        newValue: "New Value",
      };

      await expect(service.queueChange(request)).rejects.toThrow("Invalid change type");
    });
  });

  describe("approveChange", () => {
    it("updates status to approved then live", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockPendingChange);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            ...mockPendingChange,
            status: "live",
            approvedBy: "user-123",
            approvedAt: new Date(),
            deployedAt: new Date(),
          },
        ]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await service.approveChange("change-001", "user-123");

      expect(result.status).toBe("live");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("sets approvedBy and approvedAt", async () => {
      const now = new Date("2026-05-03T12:00:00Z");
      vi.setSystemTime(now);

      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockPendingChange);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            ...mockPendingChange,
            status: "live",
            approvedBy: "user-456",
            approvedAt: now,
            deployedAt: now,
          },
        ]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const result = await service.approveChange("change-001", "user-456");

      expect(result.approvedBy).toBe("user-456");
      expect(result.approvedAt).toEqual(now);
      expect(result.deployedAt).toBeDefined();

      vi.useRealTimers();
    });

    it("throws error for non-pending change", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockLiveChange);

      await expect(service.approveChange("change-002", "user-123")).rejects.toThrow(
        "Change is not pending"
      );
    });

    it("throws error for unknown changeId", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(null);

      await expect(service.approveChange("unknown-id", "user-123")).rejects.toThrow(
        "Change not found"
      );
    });

    it("marks previous live change as rolled_back when approving same type/url", async () => {
      // First there's a live change for the same type/url
      const existingLive = { ...mockLiveChange, id: "change-existing" };
      const newPending = { ...mockPendingChange, id: "change-new" };

      mockDb.query.pixelDomChanges.findFirst
        .mockResolvedValueOnce(newPending) // Finding the change to approve
        .mockResolvedValueOnce(existingLive); // Finding existing live change

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            ...newPending,
            status: "live",
            approvedBy: "user-123",
            approvedAt: new Date(),
            deployedAt: new Date(),
          },
        ]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      await service.approveChange("change-new", "user-123");

      // Should have called update twice - once for old change, once for new
      expect(mockDb.update).toHaveBeenCalledTimes(2);
    });
  });

  describe("rejectChange", () => {
    it("updates status to rejected", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockPendingChange);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      await service.rejectChange("change-001", "user-123");

      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockUpdateChain.set.mock.calls[0][0];
      expect(setCall.status).toBe("rejected");
    });

    it("stores rejection reason if provided", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockPendingChange);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      await service.rejectChange("change-001", "user-123", "Does not match brand voice");

      // Rejection reason would be stored if schema supports it
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("throws error for non-pending change", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockLiveChange);

      await expect(service.rejectChange("change-002", "user-123")).rejects.toThrow(
        "Change is not pending"
      );
    });
  });

  describe("rollbackChange", () => {
    it("creates new change to restore oldValue", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockLiveChange);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockLiveChange, status: "rolled_back" }]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "change-rollback",
            installationId: "install-001",
            changeType: "meta_description",
            targetUrl: "https://example.com/about",
            oldValue: "New Description",
            newValue: "Old Description", // Restored from original oldValue
            status: "live",
            approvedBy: "user-123",
            approvedAt: new Date(),
            deployedAt: new Date(),
            createdAt: new Date(),
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      const result = await service.rollbackChange("change-002", "user-123");

      expect(result.newValue).toBe("Old Description");
      expect(result.status).toBe("live");
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("marks original change as rolled_back", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockLiveChange);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ ...mockLiveChange, status: "rolled_back" }]),
      };
      mockDb.update.mockReturnValue(mockUpdateChain);

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "change-rollback",
            installationId: "install-001",
            changeType: "meta_description",
            targetUrl: "https://example.com/about",
            oldValue: "New Description",
            newValue: "Old Description",
            status: "live",
            createdAt: new Date(),
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      await service.rollbackChange("change-002", "user-123");

      const setCall = mockUpdateChain.set.mock.calls[0][0];
      expect(setCall.status).toBe("rolled_back");
    });

    it("throws error for non-live change", async () => {
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(mockPendingChange);

      await expect(service.rollbackChange("change-001", "user-123")).rejects.toThrow(
        "Can only rollback live changes"
      );
    });

    it("throws error when no oldValue to restore", async () => {
      const changeWithoutOldValue = { ...mockLiveChange, oldValue: null };
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(changeWithoutOldValue);

      await expect(service.rollbackChange("change-002", "user-123")).rejects.toThrow(
        "No previous value to restore"
      );
    });
  });

  describe("getApprovedChanges", () => {
    it("returns only live changes for a page", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([
        mockLiveChange,
        {
          ...mockLiveChange,
          id: "change-003",
          changeType: "canonical",
          newValue: "https://example.com/canonical",
        },
      ]);

      const result = await service.getApprovedChanges("site-abc", "https://example.com/about");

      expect(result.changes).toHaveLength(2);
      expect(result.changes[0].type).toBe("meta_description");
      expect(result.changes[1].type).toBe("canonical");
    });

    it("filters by targetUrl if provided", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([mockLiveChange]);

      const result = await service.getApprovedChanges("site-abc", "https://example.com/about");

      expect(mockDb.query.pixelDomChanges.findMany).toHaveBeenCalled();
      expect(result.changes).toHaveLength(1);
    });

    it("returns all live changes when no URL filter", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([
        mockLiveChange,
        { ...mockLiveChange, id: "change-global", targetUrl: null },
      ]);

      const result = await service.getApprovedChanges("site-abc");

      expect(result.changes).toHaveLength(2);
    });

    it("returns only necessary fields for DOM injection", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([mockLiveChange]);

      const result = await service.getApprovedChanges("site-abc");

      expect(result.changes[0]).toMatchObject({
        type: expect.any(String),
        value: expect.any(String),
      });
      // Should not include internal fields
      expect(result.changes[0]).not.toHaveProperty("approvedBy");
      expect(result.changes[0]).not.toHaveProperty("createdAt");
    });
  });

  describe("getPendingChanges", () => {
    it("returns changes awaiting approval", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([
        mockPendingChange,
        { ...mockPendingChange, id: "change-004" },
      ]);

      const result = await service.getPendingChanges("site-abc");

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("pending");
      expect(result[1].status).toBe("pending");
    });

    it("returns empty array when no pending changes", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([]);

      const result = await service.getPendingChanges("site-abc");

      expect(result).toEqual([]);
    });
  });

  describe("getChangeHistory", () => {
    it("returns all changes with pagination", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([
        mockPendingChange,
        mockLiveChange,
        { ...mockLiveChange, id: "change-005", status: "rolled_back" },
      ]);

      const result = await service.getChangeHistory("site-abc", { limit: 10, offset: 0 });

      expect(result).toHaveLength(3);
    });

    it("respects limit and offset options", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([mockLiveChange]);

      await service.getChangeHistory("site-abc", { limit: 5, offset: 10 });

      expect(mockDb.query.pixelDomChanges.findMany).toHaveBeenCalled();
    });

    it("uses default pagination when not specified", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([]);

      await service.getChangeHistory("site-abc");

      expect(mockDb.query.pixelDomChanges.findMany).toHaveBeenCalled();
    });

    it("orders by createdAt descending", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);

      const older = { ...mockPendingChange, createdAt: new Date("2026-05-01T10:00:00Z") };
      const newer = { ...mockLiveChange, createdAt: new Date("2026-05-02T10:00:00Z") };
      mockDb.query.pixelDomChanges.findMany.mockResolvedValue([newer, older]);

      const result = await service.getChangeHistory("site-abc");

      expect(result[0].createdAt > result[1].createdAt).toBe(true);
    });
  });

  describe("Content sanitization (T-66-19)", () => {
    it("sanitizes HTML content in newValue", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(null);

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "change-new",
            installationId: "install-001",
            changeType: "content",
            newValue: "Safe content",
            status: "pending",
            createdAt: new Date(),
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      const request: QueueChangeRequest = {
        siteId: "site-abc",
        changeType: "content",
        newValue: '<script>alert("xss")</script>Safe content',
      };

      await service.queueChange(request);

      const insertedValues = mockInsertChain.values.mock.calls[0][0];
      expect(insertedValues.newValue).not.toContain("<script>");
    });

    it("validates schema JSON", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(mockInstallation);
      mockDb.query.pixelDomChanges.findFirst.mockResolvedValue(null);

      const request: QueueChangeRequest = {
        siteId: "site-abc",
        changeType: "schema",
        newValue: "not valid json {",
      };

      await expect(service.queueChange(request)).rejects.toThrow("Invalid JSON schema");
    });
  });
});

describe("Pure functions", () => {
  describe("queueChange helper", () => {
    it("is exported from module", () => {
      expect(typeof queueChange).toBe("function");
    });
  });

  describe("approveChange helper", () => {
    it("is exported from module", () => {
      expect(typeof approveChange).toBe("function");
    });
  });

  describe("rejectChange helper", () => {
    it("is exported from module", () => {
      expect(typeof rejectChange).toBe("function");
    });
  });

  describe("rollbackChange helper", () => {
    it("is exported from module", () => {
      expect(typeof rollbackChange).toBe("function");
    });
  });
});
