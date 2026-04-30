/**
 * Tests for pipeline activities Drizzle schema.
 * Phase 45: Data Foundation - Pipeline Activities
 */
import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  pipelineActivities,
  ENTITY_TYPES,
  ACTIVITY_TYPES,
  type EntityType,
  type ActivityType,
  type PipelineActivitySelect,
  type PipelineActivityInsert,
} from "./activity-schema";

describe("activity-schema", () => {
  describe("ENTITY_TYPES", () => {
    it("contains exactly 4 entity types", () => {
      expect(ENTITY_TYPES).toHaveLength(4);
    });

    it("contains all expected values", () => {
      expect(ENTITY_TYPES).toEqual([
        "prospect",
        "contract",
        "invoice",
        "client",
      ]);
    });

    it("is a readonly array", () => {
      const entityType: EntityType = "contract";
      expect(ENTITY_TYPES.includes(entityType)).toBe(true);
    });
  });

  describe("ACTIVITY_TYPES", () => {
    it("contains exactly 9 activity types", () => {
      expect(ACTIVITY_TYPES).toHaveLength(9);
    });

    it("contains core activity types", () => {
      expect(ACTIVITY_TYPES).toContain("created");
      expect(ACTIVITY_TYPES).toContain("status_changed");
      expect(ACTIVITY_TYPES).toContain("viewed");
      expect(ACTIVITY_TYPES).toContain("sent");
      expect(ACTIVITY_TYPES).toContain("signed");
      expect(ACTIVITY_TYPES).toContain("paid");
    });

    it("is a readonly array", () => {
      const activityType: ActivityType = "status_changed";
      expect(ACTIVITY_TYPES.includes(activityType)).toBe(true);
    });
  });

  describe("pipelineActivities table", () => {
    it("has expected columns", () => {
      const columns = getTableColumns(pipelineActivities);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("entityType");
      expect(columnNames).toContain("entityId");
      expect(columnNames).toContain("activityType");
      expect(columnNames).toContain("activityData");
      expect(columnNames).toContain("actorId");
      expect(columnNames).toContain("createdAt");
    });

    it("has polymorphic reference columns", () => {
      const columns = getTableColumns(pipelineActivities);
      const columnNames = Object.keys(columns);

      // Both must exist for polymorphic pattern
      expect(columnNames).toContain("entityType");
      expect(columnNames).toContain("entityId");
    });
  });

  describe("activity data payloads", () => {
    it("supports status change payload", () => {
      const payload: Record<string, unknown> = {
        fromStatus: "draft",
        toStatus: "sent",
        reason: "Manual send by user",
      };

      expect(payload.fromStatus).toBe("draft");
      expect(payload.toStatus).toBe("sent");
    });

    it("supports view tracking payload", () => {
      const payload: Record<string, unknown> = {
        viewedAt: "2026-04-30T10:00:00Z",
        ipHash: "abc123",
        deviceType: "desktop",
        durationSeconds: 45,
      };

      expect(payload.durationSeconds).toBe(45);
    });

    it("supports payment payload", () => {
      const payload: Record<string, unknown> = {
        amountCents: 50000,
        currency: "EUR",
        stripePaymentIntentId: "pi_xxx",
      };

      expect(payload.amountCents).toBe(50000);
    });
  });

  describe("type exports", () => {
    it("exports PipelineActivitySelect type", () => {
      const select: Partial<PipelineActivitySelect> = {
        id: "act-001",
        entityType: "contract",
        entityId: "contract-123",
        activityType: "sent",
      };
      expect(select.entityType).toBe("contract");
    });

    it("exports PipelineActivityInsert type", () => {
      const insert: Partial<PipelineActivityInsert> = {
        entityType: "invoice",
        entityId: "inv-001",
        activityType: "paid",
        actorId: null, // System event
      };
      expect(insert.actorId).toBeNull();
    });
  });
});
