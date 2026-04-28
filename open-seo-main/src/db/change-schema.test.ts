/**
 * Tests for change-schema.ts
 * Phase 33-01: Auto-fix change tracking schema
 *
 * Tests verify table structure, column types, and exported constants.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  siteChanges,
  changeBackups,
  rollbackTriggers,
  CHANGE_STATUS,
  CHANGE_TYPES,
  TRIGGER_TYPES,
  type SiteChangeSelect,
  type SiteChangeInsert,
  type ChangeBackupSelect,
  type ChangeBackupInsert,
  type RollbackTriggerSelect,
  type RollbackTriggerInsert,
  type ChangeStatus,
  type ChangeType,
  type TriggerType,
} from "./change-schema";

describe("change-schema", () => {
  describe("siteChanges table", () => {
    it("should have table name 'site_changes'", () => {
      expect(getTableName(siteChanges)).toBe("site_changes");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(siteChanges);
      const columnNames = Object.keys(columns);

      // Core identification
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("connectionId");

      // Classification
      expect(columnNames).toContain("changeType");
      expect(columnNames).toContain("category");
      expect(columnNames).toContain("resourceType");
      expect(columnNames).toContain("resourceId");
      expect(columnNames).toContain("resourceUrl");

      // Change details
      expect(columnNames).toContain("field");
      expect(columnNames).toContain("beforeValue");
      expect(columnNames).toContain("afterValue");
      expect(columnNames).toContain("beforeSnapshot");
      expect(columnNames).toContain("afterSnapshot");

      // Provenance
      expect(columnNames).toContain("triggeredBy");
      expect(columnNames).toContain("auditId");
      expect(columnNames).toContain("findingId");
      expect(columnNames).toContain("userId");

      // Status
      expect(columnNames).toContain("status");
      expect(columnNames).toContain("appliedAt");
      expect(columnNames).toContain("verifiedAt");
      expect(columnNames).toContain("revertedAt");
      expect(columnNames).toContain("revertedByChangeId");

      // Batch grouping
      expect(columnNames).toContain("batchId");
      expect(columnNames).toContain("batchSequence");

      // Timestamps
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have status with default 'pending'", () => {
      const columns = getTableColumns(siteChanges);
      expect(columns.status.notNull).toBe(true);
      expect(columns.status.hasDefault).toBe(true);
      expect(columns.status.default).toBe("pending");
    });

    it("should have nullable beforeValue and afterValue", () => {
      const columns = getTableColumns(siteChanges);
      expect(columns.beforeValue.notNull).toBe(false);
      expect(columns.afterValue.notNull).toBe(false);
    });
  });

  describe("changeBackups table", () => {
    it("should have table name 'change_backups'", () => {
      expect(getTableName(changeBackups)).toBe("change_backups");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(changeBackups);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("scope");
      expect(columnNames).toContain("resourceIds");
      expect(columnNames).toContain("snapshotData");
      expect(columnNames).toContain("createdBeforeChangeId");
      expect(columnNames).toContain("sizeBytes");
      expect(columnNames).toContain("expiresAt");
      expect(columnNames).toContain("isPinned");
      expect(columnNames).toContain("createdAt");
    });

    it("should have isPinned with default false", () => {
      const columns = getTableColumns(changeBackups);
      expect(columns.isPinned.notNull).toBe(true);
      expect(columns.isPinned.hasDefault).toBe(true);
      expect(columns.isPinned.default).toBe(false);
    });
  });

  describe("rollbackTriggers table", () => {
    it("should have table name 'rollback_triggers'", () => {
      expect(getTableName(rollbackTriggers)).toBe("rollback_triggers");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(rollbackTriggers);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("triggerType");
      expect(columnNames).toContain("config");
      expect(columnNames).toContain("rollbackScope");
      expect(columnNames).toContain("isEnabled");
      expect(columnNames).toContain("lastTriggeredAt");
      expect(columnNames).toContain("lastCheckAt");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have isEnabled with default true", () => {
      const columns = getTableColumns(rollbackTriggers);
      expect(columns.isEnabled.notNull).toBe(true);
      expect(columns.isEnabled.hasDefault).toBe(true);
      expect(columns.isEnabled.default).toBe(true);
    });
  });

  describe("constants", () => {
    it("exports CHANGE_STATUS with expected values", () => {
      expect(CHANGE_STATUS).toContain("pending");
      expect(CHANGE_STATUS).toContain("applied");
      expect(CHANGE_STATUS).toContain("verified");
      expect(CHANGE_STATUS).toContain("reverted");
      expect(CHANGE_STATUS).toContain("failed");
      expect(CHANGE_STATUS).toHaveLength(5);
    });

    it("exports CHANGE_TYPES with expected values", () => {
      expect(CHANGE_TYPES).toContain("meta_title");
      expect(CHANGE_TYPES).toContain("meta_description");
      expect(CHANGE_TYPES).toContain("image_alt");
      expect(CHANGE_TYPES).toContain("canonical");
      expect(CHANGE_TYPES).toContain("lazy_loading");
      expect(CHANGE_TYPES).toContain("og_tags");
      expect(CHANGE_TYPES).toContain("h1");
      expect(CHANGE_TYPES).toContain("headings");
      expect(CHANGE_TYPES).toContain("schema_markup");
    });

    it("exports TRIGGER_TYPES with expected values", () => {
      expect(TRIGGER_TYPES).toContain("traffic_drop");
      expect(TRIGGER_TYPES).toContain("ranking_drop");
      expect(TRIGGER_TYPES).toContain("error_spike");
      expect(TRIGGER_TYPES).toContain("manual");
      expect(TRIGGER_TYPES).toHaveLength(4);
    });
  });

  describe("type exports", () => {
    it("SiteChangeInsert type allows valid insert", () => {
      const validInsert: SiteChangeInsert = {
        id: "change-1",
        clientId: "client-1",
        connectionId: "conn-1",
        changeType: "meta_title",
        category: "meta_tags",
        resourceType: "page",
        resourceId: "page-123",
        resourceUrl: "https://example.com/page",
        field: "title",
        triggeredBy: "audit",
        status: "pending",
      };
      expect(validInsert.id).toBe("change-1");
    });

    it("SiteChangeSelect type includes all fields", () => {
      const validSelect: SiteChangeSelect = {
        id: "change-1",
        clientId: "client-1",
        connectionId: "conn-1",
        changeType: "meta_title",
        category: "meta_tags",
        resourceType: "page",
        resourceId: "page-123",
        resourceUrl: "https://example.com/page",
        field: "title",
        beforeValue: "Old title",
        afterValue: "New title",
        beforeSnapshot: null,
        afterSnapshot: null,
        triggeredBy: "audit",
        auditId: null,
        findingId: null,
        userId: null,
        status: "applied",
        appliedAt: new Date(),
        verifiedAt: null,
        revertedAt: null,
        revertedByChangeId: null,
        batchId: null,
        batchSequence: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(validSelect.id).toBe("change-1");
    });

    it("ChangeBackupInsert type allows valid insert", () => {
      const validInsert: ChangeBackupInsert = {
        id: "backup-1",
        clientId: "client-1",
        scope: "page",
      };
      expect(validInsert.id).toBe("backup-1");
    });

    it("ChangeBackupSelect type includes all fields", () => {
      const validSelect: ChangeBackupSelect = {
        id: "backup-1",
        clientId: "client-1",
        scope: "site",
        resourceIds: ["page-1", "page-2"],
        snapshotData: {
          pages: [
            {
              resourceId: "page-1",
              resourceUrl: "https://example.com/page-1",
              resourceType: "page",
              fields: { title: "Page 1" },
              capturedAt: "2024-01-01T00:00:00Z",
            },
          ],
        },
        createdBeforeChangeId: null,
        sizeBytes: 1024,
        expiresAt: new Date(),
        isPinned: false,
        createdAt: new Date(),
      };
      expect(validSelect.id).toBe("backup-1");
    });

    it("RollbackTriggerInsert type allows valid insert", () => {
      const validInsert: RollbackTriggerInsert = {
        id: "trigger-1",
        clientId: "client-1",
        triggerType: "traffic_drop",
      };
      expect(validInsert.id).toBe("trigger-1");
    });

    it("RollbackTriggerSelect type includes all fields", () => {
      const validSelect: RollbackTriggerSelect = {
        id: "trigger-1",
        clientId: "client-1",
        triggerType: "ranking_drop",
        config: {
          type: "ranking_drop",
          keywords: "all_tracked",
          positionDrop: 5,
          minimumKeywords: 3,
        },
        rollbackScope: {
          type: "category",
          category: "meta_tags",
        },
        isEnabled: true,
        lastTriggeredAt: null,
        lastCheckAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(validSelect.id).toBe("trigger-1");
    });
  });
});
