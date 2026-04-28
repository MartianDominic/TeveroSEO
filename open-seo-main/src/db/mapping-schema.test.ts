import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  keywordPageMapping,
  MAPPING_ACTIONS,
  type MappingAction,
  type KeywordPageMappingSelect,
  type KeywordPageMappingInsert,
} from "./mapping-schema";

describe("mapping-schema", () => {
  describe("keywordPageMapping table", () => {
    it("exports keywordPageMapping table", () => {
      expect(keywordPageMapping).toBeDefined();
    });

    it("has correct table name", () => {
      expect(getTableName(keywordPageMapping)).toBe("keyword_page_mapping");
    });

    it("has all required columns", () => {
      const columns = Object.keys(keywordPageMapping);
      expect(columns).toContain("id");
      expect(columns).toContain("projectId");
      expect(columns).toContain("keyword");
      expect(columns).toContain("targetUrl");
      expect(columns).toContain("action");
      expect(columns).toContain("relevanceScore");
      expect(columns).toContain("reason");
      expect(columns).toContain("searchVolume");
      expect(columns).toContain("difficulty");
      expect(columns).toContain("currentPosition");
      expect(columns).toContain("currentUrl");
      expect(columns).toContain("isManualOverride");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("updatedAt");
    });
  });

  describe("MAPPING_ACTIONS", () => {
    it("contains optimize and create actions", () => {
      expect(MAPPING_ACTIONS).toContain("optimize");
      expect(MAPPING_ACTIONS).toContain("create");
      expect(MAPPING_ACTIONS).toHaveLength(2);
    });
  });

  describe("type exports", () => {
    it("MappingAction type is correctly defined", () => {
      // Type-only test: this compiles if types are correct
      const action: MappingAction = "optimize";
      expect(["optimize", "create"]).toContain(action);
    });

    it("KeywordPageMappingSelect is exportable", () => {
      // Type assertion test - compilation success means type exists
      const selectType: Partial<KeywordPageMappingSelect> = {
        id: "test-id",
        keyword: "test keyword",
      };
      expect(selectType.id).toBe("test-id");
    });

    it("KeywordPageMappingInsert is exportable", () => {
      // Type assertion test - compilation success means type exists
      const insertType: Partial<KeywordPageMappingInsert> = {
        id: "test-id",
        projectId: "proj-123",
        keyword: "test keyword",
        action: "optimize",
      };
      expect(insertType.keyword).toBe("test keyword");
    });
  });
});
