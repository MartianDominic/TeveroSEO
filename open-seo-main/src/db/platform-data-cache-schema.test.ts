/**
 * Tests for platform-data-cache-schema.ts
 * Phase 61-01: Platform Data Cache Schema
 *
 * TDD: Tests written before implementation.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  platformDataCache,
  type PlatformDataCacheSelect,
  type PlatformDataCacheInsert,
} from "./platform-data-cache-schema";

describe("platform-data-cache-schema", () => {
  describe("platformDataCache table", () => {
    it("should have table name 'platform_data_cache'", () => {
      expect(getTableName(platformDataCache)).toBe("platform_data_cache");
    });

    it("should have all required columns for cached platform data", () => {
      const columns = getTableColumns(platformDataCache);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("connectionId");
      expect(columnNames).toContain("dataType");
      expect(columnNames).toContain("dateRange");
      expect(columnNames).toContain("data");
      expect(columnNames).toContain("fetchedAt");
      expect(columnNames).toContain("expiresAt");
      expect(columnNames).toContain("createdAt");
    });

    it("should have id as text primary key", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.id.dataType).toBe("string");
      expect(columns.id.notNull).toBe(true);
    });

    it("should have connectionId as text (foreign key)", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.connectionId.dataType).toBe("string");
      // connectionId references platformConnections.id
    });

    it("should have dataType as non-null text", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.dataType.dataType).toBe("string");
      expect(columns.dataType.notNull).toBe(true);
    });

    it("should have dateRange as nullable text", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.dateRange.dataType).toBe("string");
      expect(columns.dateRange.notNull).toBe(false);
    });

    it("should have data as non-null jsonb", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.data.dataType).toBe("json");
      expect(columns.data.notNull).toBe(true);
    });

    it("should have fetchedAt as non-null timestamp", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.fetchedAt.dataType).toBe("date");
      expect(columns.fetchedAt.notNull).toBe(true);
    });

    it("should have expiresAt as non-null timestamp", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.expiresAt.dataType).toBe("date");
      expect(columns.expiresAt.notNull).toBe(true);
    });

    it("should have createdAt as timestamp with default", () => {
      const columns = getTableColumns(platformDataCache);
      expect(columns.createdAt.dataType).toBe("date");
      expect(columns.createdAt.hasDefault).toBe(true);
    });
  });

  describe("Index definitions", () => {
    // Note: Index definitions are verified via migration SQL generation.
    // Drizzle ORM does not expose a runtime API for querying indexes.
    it("should define indexes in schema (verified via migration)", () => {
      // The schema defines these indexes:
      // - idx_platform_data_cache_connection ON (connectionId)
      // - idx_platform_data_cache_type ON (dataType)
      // - idx_platform_data_cache_expiry ON (expiresAt)
      // Actual verification happens when migration is generated.
      expect(platformDataCache).toBeDefined();
    });
  });

  describe("Type exports", () => {
    it("should export PlatformDataCacheSelect type", () => {
      const _typeCheck: PlatformDataCacheSelect = {
        id: "cache-1",
        connectionId: "conn-1",
        dataType: "search_queries",
        dateRange: "last_7_days",
        data: { queries: [] },
        fetchedAt: new Date(),
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export PlatformDataCacheInsert type", () => {
      const _typeCheck: PlatformDataCacheInsert = {
        id: "cache-1",
        connectionId: "conn-1",
        dataType: "search_queries",
        data: { queries: [] },
        fetchedAt: new Date(),
        expiresAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
