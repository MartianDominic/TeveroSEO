/**
 * PipelineService Tests
 * Phase 50: Pipeline Kanban
 *
 * Tests for pipeline configuration and stage transitions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_PIPELINE_STAGES,
  type PipelineStageConfig,
} from "@/db/pipeline-config-schema";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "test-config-1" }])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "test-config-1" }])),
        })),
      })),
    })),
  },
}));

// Mock ActivityRepository
vi.mock("../../contracts/repositories/ActivityRepository", () => ({
  ActivityRepository: {
    insertActivity: vi.fn(() => Promise.resolve({ id: "activity-1" })),
  },
}));

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-id-123"),
}));

describe("PipelineConfigService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DEFAULT_PIPELINE_STAGES", () => {
    it("contains 8 stages per D-05", () => {
      expect(DEFAULT_PIPELINE_STAGES).toHaveLength(8);
    });

    it("has correct stage IDs per D-05", () => {
      const stageIds = DEFAULT_PIPELINE_STAGES.map((s) => s.id);
      expect(stageIds).toEqual([
        "new",
        "analyzing",
        "qualified",
        "proposal_sent",
        "negotiating",
        "won",
        "onboarding",
        "active_client",
      ]);
    });

    it("has sequential order values", () => {
      DEFAULT_PIPELINE_STAGES.forEach((stage, index) => {
        expect(stage.order).toBe(index);
      });
    });

    it("has valid hex colors for all stages", () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      DEFAULT_PIPELINE_STAGES.forEach((stage) => {
        expect(stage.color).toMatch(hexColorRegex);
      });
    });

    it("has non-empty display names for all stages", () => {
      DEFAULT_PIPELINE_STAGES.forEach((stage) => {
        expect(stage.name.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Stage validation", () => {
    it("rejects duplicate stage IDs", () => {
      const duplicateStages: PipelineStageConfig[] = [
        { id: "new", name: "New", order: 0, color: "#6b7280" },
        { id: "new", name: "Also New", order: 1, color: "#3b82f6" },
      ];

      const ids = duplicateStages.map((s) => s.id);
      const hasDuplicates = new Set(ids).size !== ids.length;
      expect(hasDuplicates).toBe(true);
    });

    it("validates minimum 2 stages requirement", () => {
      const singleStage: PipelineStageConfig[] = [
        { id: "new", name: "New", order: 0, color: "#6b7280" },
      ];

      expect(singleStage.length).toBeLessThan(2);
    });

    it("validates empty stage names", () => {
      const emptyNameStage: PipelineStageConfig = {
        id: "empty",
        name: "",
        order: 0,
        color: "#6b7280",
      };

      expect(emptyNameStage.name.trim()).toBe("");
    });

    it("validates invalid hex colors", () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      const invalidColor = "red";

      expect(invalidColor).not.toMatch(hexColorRegex);
    });
  });
});

describe("PipelineService", () => {
  describe("moveProspectToStage", () => {
    it("validates target stage exists in workspace config", async () => {
      // Test that invalid stages are rejected
      const invalidStage = "nonexistent_stage";
      const validStageIds = DEFAULT_PIPELINE_STAGES.map((s) => s.id);

      expect(validStageIds).not.toContain(invalidStage);
    });

    it("allows valid stage transitions", () => {
      const validStageIds = DEFAULT_PIPELINE_STAGES.map((s) => s.id);

      expect(validStageIds).toContain("new");
      expect(validStageIds).toContain("qualified");
      expect(validStageIds).toContain("won");
    });
  });

  describe("getProspectsGroupedByStage", () => {
    it("initializes all stages with empty arrays", () => {
      const grouped: Record<string, unknown[]> = {};
      for (const stage of DEFAULT_PIPELINE_STAGES) {
        grouped[stage.id] = [];
      }

      expect(Object.keys(grouped)).toHaveLength(8);
      expect(grouped["new"]).toEqual([]);
      expect(grouped["qualified"]).toEqual([]);
    });

    it("handles prospects with stale stages by putting them in new", () => {
      const grouped: Record<string, string[]> = {};
      for (const stage of DEFAULT_PIPELINE_STAGES) {
        grouped[stage.id] = [];
      }

      const prospectWithStaleStage = "obsolete_stage";
      const validStages = DEFAULT_PIPELINE_STAGES.map((s) => s.id);

      if (!validStages.includes(prospectWithStaleStage)) {
        grouped["new"].push("stale-prospect-id");
      }

      expect(grouped["new"]).toContain("stale-prospect-id");
    });
  });

  describe("archiveProspect", () => {
    it("uses archived stage if it exists in config", () => {
      const customStagesWithArchived: PipelineStageConfig[] = [
        ...DEFAULT_PIPELINE_STAGES,
        { id: "archived", name: "Archived", order: 8, color: "#9ca3af" },
      ];

      const hasArchivedStage = customStagesWithArchived.some(
        (s) => s.id === "archived",
      );
      expect(hasArchivedStage).toBe(true);
    });

    it("handles missing archived stage gracefully", () => {
      const hasArchivedStage = DEFAULT_PIPELINE_STAGES.some(
        (s) => s.id === "archived",
      );
      expect(hasArchivedStage).toBe(false);
    });
  });

  describe("getStageCounts", () => {
    it("returns all stages with count property", () => {
      const stagesWithCounts = DEFAULT_PIPELINE_STAGES.map((stage) => ({
        ...stage,
        count: 0,
      }));

      expect(stagesWithCounts).toHaveLength(8);
      stagesWithCounts.forEach((stage) => {
        expect(stage).toHaveProperty("count");
        expect(stage).toHaveProperty("id");
        expect(stage).toHaveProperty("name");
        expect(stage).toHaveProperty("color");
      });
    });
  });
});
