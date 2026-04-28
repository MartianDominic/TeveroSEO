/**
 * Tests for keyword_rankings Drizzle schema.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  keywordRankings,
  type KeywordRankingSelect,
  type KeywordRankingInsert,
} from "./ranking-schema";

describe("ranking-schema", () => {
  describe("keywordRankings table", () => {
    it("should have table name 'keyword_rankings'", () => {
      expect(getTableName(keywordRankings)).toBe("keyword_rankings");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(keywordRankings);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("keywordId");
      expect(columnNames).toContain("position");
      expect(columnNames).toContain("previousPosition");
      expect(columnNames).toContain("url");
      expect(columnNames).toContain("date");
      expect(columnNames).toContain("serpFeatures");
      expect(columnNames).toContain("createdAt");
    });

    it("should have id as text primary key", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);
    });

    it("should have keywordId as non-null text (FK to savedKeywords)", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.keywordId.dataType).toBe("string");
      expect(columns.keywordId.notNull).toBe(true);
    });

    it("should have position as non-null integer", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.position.dataType).toBe("number");
      expect(columns.position.notNull).toBe(true);
    });

    it("should have previousPosition as nullable integer", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.previousPosition.dataType).toBe("number");
      expect(columns.previousPosition.notNull).toBe(false);
    });

    it("should have url as nullable text", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.url.dataType).toBe("string");
      expect(columns.url.notNull).toBe(false);
    });

    it("should have date as non-null timestamp", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.date.dataType).toBe("date");
      expect(columns.date.notNull).toBe(true);
    });

    it("should have serpFeatures as nullable jsonb", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.serpFeatures.dataType).toBe("json");
      expect(columns.serpFeatures.notNull).toBe(false);
    });

    it("should have createdAt as non-null timestamp with default", () => {
      const columns = getTableColumns(keywordRankings);
      expect(columns.createdAt.dataType).toBe("date");
      expect(columns.createdAt.notNull).toBe(true);
      expect(columns.createdAt.hasDefault).toBe(true);
    });
  });

  describe("Type exports", () => {
    it("should export KeywordRankingSelect type", () => {
      // Type-level test: if this compiles, the type exists
      const _typeCheck: KeywordRankingSelect = {
        id: "uuid-v7",
        keywordId: "keyword-id",
        position: 5,
        previousPosition: 7,
        url: "https://example.com/page",
        date: new Date(),
        serpFeatures: ["featured_snippet", "local_pack"],
        createdAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export KeywordRankingInsert type", () => {
      // Type-level test: if this compiles, the type exists
      // Insert type should allow optional fields with defaults
      const _typeCheck: KeywordRankingInsert = {
        id: "uuid-v7",
        keywordId: "keyword-id",
        position: 5,
        date: new Date(),
        // previousPosition, url, serpFeatures, createdAt should be optional
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
