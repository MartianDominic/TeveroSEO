/**
 * Tests for branding-schema.ts
 * Phase 16 Plan 03: Client branding for white-label reports.
 *
 * TDD: Tests written before implementation.
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  clientBranding,
  type ClientBrandingSelect,
  type ClientBrandingInsert,
} from "./branding-schema";

describe("branding-schema", () => {
  describe("clientBranding table", () => {
    it("should have table name 'client_branding'", () => {
      expect(getTableName(clientBranding)).toBe("client_branding");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(clientBranding);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("logoUrl");
      expect(columnNames).toContain("primaryColor");
      expect(columnNames).toContain("secondaryColor");
      expect(columnNames).toContain("footerText");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have id as uuid primary key", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.id.dataType).toBe("string"); // Drizzle reports uuid as string
      expect(columns.id.notNull).toBe(true);
    });

    it("should have clientId as non-null uuid", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.clientId.dataType).toBe("string");
      expect(columns.clientId.notNull).toBe(true);
    });

    it("should have logoUrl as nullable text", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.logoUrl.dataType).toBe("string");
      expect(columns.logoUrl.notNull).toBe(false);
    });

    it("should have primaryColor with Tevero default (#3b82f6)", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.primaryColor.dataType).toBe("string");
      expect(columns.primaryColor.notNull).toBe(true);
      expect(columns.primaryColor.hasDefault).toBe(true);
      expect(columns.primaryColor.default).toBe("#3b82f6");
    });

    it("should have secondaryColor with Tevero default (#10b981)", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.secondaryColor.dataType).toBe("string");
      expect(columns.secondaryColor.notNull).toBe(true);
      expect(columns.secondaryColor.hasDefault).toBe(true);
      expect(columns.secondaryColor.default).toBe("#10b981");
    });

    it("should have footerText as nullable text", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.footerText.dataType).toBe("string");
      expect(columns.footerText.notNull).toBe(false);
    });

    it("should have createdAt as non-null timestamp with default", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.createdAt.dataType).toBe("date");
      expect(columns.createdAt.notNull).toBe(true);
      expect(columns.createdAt.hasDefault).toBe(true);
    });

    it("should have updatedAt as non-null timestamp with default", () => {
      const columns = getTableColumns(clientBranding);
      expect(columns.updatedAt.dataType).toBe("date");
      expect(columns.updatedAt.notNull).toBe(true);
      expect(columns.updatedAt.hasDefault).toBe(true);
    });
  });

  describe("Type exports", () => {
    it("should export ClientBrandingSelect type", () => {
      // Type-level test: if this compiles, the type exists
      const _typeCheck: ClientBrandingSelect = {
        id: "uuid",
        clientId: "uuid",
        logoUrl: "/branding/uuid/logo.png",
        primaryColor: "#3b82f6",
        secondaryColor: "#10b981",
        footerText: "Footer text",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export ClientBrandingInsert type", () => {
      // Type-level test: if this compiles, the type exists
      // Insert type should allow optional fields with defaults
      const _typeCheck: ClientBrandingInsert = {
        clientId: "uuid",
        // id, logoUrl, primaryColor, secondaryColor, footerText, createdAt, updatedAt should be optional
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
