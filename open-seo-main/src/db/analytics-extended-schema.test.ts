/**
 * Tests for analytics-extended-schema.ts
 * Phase 96-05: Client Portal Schema
 *
 * TDD RED phase - tests for client_visibility, brand_terms, report_schedules tables
 */
import { describe, it, expect } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  clientVisibility,
  brandTerms,
  analyticsReportSchedules,
  DEFAULT_VISIBILITY,
  type VisibilityConfig,
  type BrandTerm,
  type ReportSchedule,
} from "./analytics-extended-schema";

describe("analytics-extended-schema", () => {
  describe("clientVisibility table", () => {
    it("should have correct table name", () => {
      const config = getTableConfig(clientVisibility);
      expect(config.name).toBe("client_visibility");
    });

    it("should have all required columns", () => {
      const columns = Object.keys(clientVisibility);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("workspaceId");
      expect(columns).toContain("showClicks");
      expect(columns).toContain("showImpressions");
      expect(columns).toContain("showPosition");
      expect(columns).toContain("showCtr");
      expect(columns).toContain("showQueries");
      expect(columns).toContain("showPages");
      expect(columns).toContain("showCompetitors");
      expect(columns).toContain("canViewGrowing");
      expect(columns).toContain("canViewDecaying");
      expect(columns).toContain("canViewCannibalization");
      expect(columns).toContain("canExport");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("updatedAt");
    });

    it("should have uuid primary key", () => {
      expect(clientVisibility.id.columnType).toBe("PgUUID");
      expect(clientVisibility.id.notNull).toBe(true);
    });

    it("should have clientId as uuid foreign key", () => {
      expect(clientVisibility.clientId.columnType).toBe("PgUUID");
      expect(clientVisibility.clientId.notNull).toBe(true);
    });

    it("should have workspaceId as text foreign key", () => {
      expect(clientVisibility.workspaceId.columnType).toBe("PgText");
      expect(clientVisibility.workspaceId.notNull).toBe(true);
    });
  });

  describe("brandTerms table", () => {
    it("should have correct table name", () => {
      const config = getTableConfig(brandTerms);
      expect(config.name).toBe("brand_terms");
    });

    it("should have all required columns", () => {
      const columns = Object.keys(brandTerms);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("term");
      expect(columns).toContain("isAutoDetected");
      expect(columns).toContain("createdAt");
    });

    it("should have uuid primary key", () => {
      expect(brandTerms.id.columnType).toBe("PgUUID");
      expect(brandTerms.id.notNull).toBe(true);
    });

    it("should have term as non-null text", () => {
      expect(brandTerms.term.columnType).toBe("PgText");
      expect(brandTerms.term.notNull).toBe(true);
    });
  });

  describe("analyticsReportSchedules table", () => {
    it("should have correct table name", () => {
      const config = getTableConfig(analyticsReportSchedules);
      expect(config.name).toBe("analytics_report_schedules");
    });

    it("should have all required columns", () => {
      const columns = Object.keys(analyticsReportSchedules);
      expect(columns).toContain("id");
      expect(columns).toContain("workspaceId");
      expect(columns).toContain("clientId");
      expect(columns).toContain("frequency");
      expect(columns).toContain("recipients");
      expect(columns).toContain("nextRunAt");
      expect(columns).toContain("lastRunAt");
      expect(columns).toContain("isActive");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("updatedAt");
    });

    it("should allow null clientId for workspace-wide reports", () => {
      expect(analyticsReportSchedules.clientId.notNull).toBe(false);
    });

    it("should have recipients as jsonb", () => {
      expect(analyticsReportSchedules.recipients.columnType).toBe("PgJsonb");
    });
  });

  describe("DEFAULT_VISIBILITY constant", () => {
    it("should have all visibility fields", () => {
      expect(DEFAULT_VISIBILITY).toHaveProperty("showClicks", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("showImpressions", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("showPosition", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("showCtr", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("showQueries", false); // Hidden by default
      expect(DEFAULT_VISIBILITY).toHaveProperty("showPages", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("showCompetitors", false); // Hidden by default
    });

    it("should have report access fields", () => {
      expect(DEFAULT_VISIBILITY).toHaveProperty("canViewGrowing", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("canViewDecaying", true);
      expect(DEFAULT_VISIBILITY).toHaveProperty("canViewCannibalization", false); // Hidden by default
      expect(DEFAULT_VISIBILITY).toHaveProperty("canExport", false); // Disabled by default
    });
  });

  describe("type exports", () => {
    it("should export VisibilityConfig type", () => {
      const config: VisibilityConfig = {
        showClicks: true,
        showImpressions: true,
        showPosition: true,
        showCtr: true,
        showQueries: false,
        showPages: true,
        showCompetitors: false,
        canViewGrowing: true,
        canViewDecaying: true,
        canViewCannibalization: false,
        canExport: false,
      };
      expect(config).toBeDefined();
    });

    it("should export BrandTerm type", () => {
      const term: BrandTerm = {
        id: "123",
        clientId: "456",
        term: "example",
        isAutoDetected: true,
        createdAt: new Date(),
      };
      expect(term).toBeDefined();
    });

    it("should export ReportSchedule type", () => {
      const schedule: ReportSchedule = {
        id: "123",
        workspaceId: "456",
        clientId: null,
        frequency: "weekly",
        recipients: ["test@example.com"],
        nextRunAt: new Date(),
        lastRunAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(schedule).toBeDefined();
    });
  });
});
