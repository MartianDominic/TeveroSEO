/**
 * Portal Audit Log Schema Tests
 * Phase 96: CPR-006
 */
import { describe, it, expect } from "vitest";
import {
  PORTAL_ACTIONS,
  PORTAL_RESOURCES,
  PORTAL_AUDIT_RETENTION_DAYS,
  type PortalAction,
  type PortalResource,
  type PortalAuditMetadata,
} from "./portal-audit-log-schema";

describe("Portal Audit Log Schema", () => {
  describe("PORTAL_ACTIONS", () => {
    it("should contain all expected dashboard actions", () => {
      expect(PORTAL_ACTIONS).toContain("view_dashboard");
      expect(PORTAL_ACTIONS).toContain("view_metrics");
    });

    it("should contain all expected report actions", () => {
      expect(PORTAL_ACTIONS).toContain("view_report");
      expect(PORTAL_ACTIONS).toContain("export_csv");
      expect(PORTAL_ACTIONS).toContain("export_sheets");
      expect(PORTAL_ACTIONS).toContain("export_pdf");
    });

    it("should contain all expected keyword actions", () => {
      expect(PORTAL_ACTIONS).toContain("view_keywords");
      expect(PORTAL_ACTIONS).toContain("view_keyword_details");
    });

    it("should contain all expected trend actions", () => {
      expect(PORTAL_ACTIONS).toContain("view_growing_keywords");
      expect(PORTAL_ACTIONS).toContain("view_decaying_keywords");
      expect(PORTAL_ACTIONS).toContain("view_cannibalization");
    });

    it("should contain all expected auth actions", () => {
      expect(PORTAL_ACTIONS).toContain("portal_login");
      expect(PORTAL_ACTIONS).toContain("portal_logout");
      expect(PORTAL_ACTIONS).toContain("session_extended");
    });

    it("should have 16 total actions", () => {
      expect(PORTAL_ACTIONS).toHaveLength(16);
    });
  });

  describe("PORTAL_RESOURCES", () => {
    it("should contain all expected resource types", () => {
      expect(PORTAL_RESOURCES).toContain("dashboard");
      expect(PORTAL_RESOURCES).toContain("report");
      expect(PORTAL_RESOURCES).toContain("keyword");
      expect(PORTAL_RESOURCES).toContain("export");
      expect(PORTAL_RESOURCES).toContain("settings");
      expect(PORTAL_RESOURCES).toContain("session");
    });

    it("should have 6 total resources", () => {
      expect(PORTAL_RESOURCES).toHaveLength(6);
    });
  });

  describe("PORTAL_AUDIT_RETENTION_DAYS", () => {
    it("should be 90 days (matching main audit log)", () => {
      expect(PORTAL_AUDIT_RETENTION_DAYS).toBe(90);
    });
  });

  describe("Type exports", () => {
    it("should export PortalAction as valid union type", () => {
      const action: PortalAction = "view_dashboard";
      expect(action).toBe("view_dashboard");
    });

    it("should export PortalResource as valid union type", () => {
      const resource: PortalResource = "dashboard";
      expect(resource).toBe("dashboard");
    });

    it("should export PortalAuditMetadata interface", () => {
      const metadata: PortalAuditMetadata = {
        exportFormat: "csv",
        exportRowCount: 100,
        reportType: "monthly",
        dateRange: { start: "2026-01-01", end: "2026-01-31" },
        keywordId: "kw-123",
        sessionId: "session-456",
      };

      expect(metadata.exportFormat).toBe("csv");
      expect(metadata.exportRowCount).toBe(100);
      expect(metadata.dateRange?.start).toBe("2026-01-01");
    });
  });
});
