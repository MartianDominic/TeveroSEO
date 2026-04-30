/**
 * Tests for onboarding checklists Drizzle schema.
 * Phase 45: Data Foundation - Onboarding Checklists
 */
import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  onboardingChecklists,
  SERVICE_TIERS,
  CHECKLIST_CATEGORIES,
  type ServiceTier,
  type ChecklistCategory,
  type ChecklistItem,
  type OnboardingChecklistSelect,
  type OnboardingChecklistInsert,
} from "./onboarding-schema";

describe("onboarding-schema", () => {
  describe("SERVICE_TIERS", () => {
    it("contains exactly 3 tier values", () => {
      expect(SERVICE_TIERS).toHaveLength(3);
    });

    it("contains all expected values in order", () => {
      expect(SERVICE_TIERS).toEqual(["starter", "growth", "enterprise"]);
    });

    it("is a readonly array", () => {
      const tier: ServiceTier = "growth";
      expect(SERVICE_TIERS.includes(tier)).toBe(true);
    });
  });

  describe("CHECKLIST_CATEGORIES", () => {
    it("contains exactly 4 category values", () => {
      expect(CHECKLIST_CATEGORIES).toHaveLength(4);
    });

    it("contains all expected values", () => {
      expect(CHECKLIST_CATEGORIES).toEqual([
        "setup",
        "credentials",
        "kickoff",
        "content",
      ]);
    });
  });

  describe("onboardingChecklists table", () => {
    it("has expected columns", () => {
      const columns = getTableColumns(onboardingChecklists);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("serviceTier");
      expect(columnNames).toContain("items");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("has progress tracking fields", () => {
      const columns = getTableColumns(onboardingChecklists);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("completedCount");
      expect(columnNames).toContain("totalCount");
    });
  });

  describe("ChecklistItem type", () => {
    it("accepts valid checklist item structure", () => {
      const item: ChecklistItem = {
        id: "item-001",
        label: "Connect Google Search Console",
        category: "credentials",
        autoCompleteEvent: "gsc_connected",
      };

      expect(item.id).toBe("item-001");
      expect(item.category).toBe("credentials");
      expect(item.autoCompleteEvent).toBe("gsc_connected");
    });

    it("accepts completed item with timestamps", () => {
      const item: ChecklistItem = {
        id: "item-002",
        label: "Schedule kickoff call",
        category: "kickoff",
        completedAt: "2026-04-30T10:00:00Z",
        completedBy: "user-123",
      };

      expect(item.completedAt).toBeDefined();
      expect(item.completedBy).toBe("user-123");
    });

    it("validates items array", () => {
      const items: ChecklistItem[] = [
        { id: "1", label: "Setup GSC", category: "credentials" },
        { id: "2", label: "Initial audit", category: "setup" },
        { id: "3", label: "Kickoff meeting", category: "kickoff" },
        { id: "4", label: "Content plan", category: "content" },
      ];

      expect(items).toHaveLength(4);
      expect(items.filter((i) => i.category === "credentials")).toHaveLength(1);
    });
  });

  describe("type exports", () => {
    it("exports OnboardingChecklistSelect type", () => {
      const select: Partial<OnboardingChecklistSelect> = {
        id: "checklist-001",
        serviceTier: "growth",
        completedCount: 3,
        totalCount: 10,
      };
      expect(select.completedCount).toBe(3);
    });

    it("exports OnboardingChecklistInsert type", () => {
      const insert: Partial<OnboardingChecklistInsert> = {
        serviceTier: "enterprise",
        totalCount: 15,
      };
      expect(insert.serviceTier).toBe("enterprise");
    });
  });
});
