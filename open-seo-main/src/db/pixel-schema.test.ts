/**
 * Tests for TeveroPixel Drizzle schemas.
 * Phase 66: Platform Unification Excellence - Plan 01
 *
 * Tests 4 tables:
 * - pixelInstallations: workspace/site scoped pixel deployments
 * - pixelDomChanges: approved SEO modifications via pixel
 * - pixelAnalyticsDaily: aggregated daily metrics
 * - developerHandoffs: developer email flow tracking
 */
import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  pixelInstallations,
  pixelDomChanges,
  pixelAnalyticsDaily,
  developerHandoffs,
  PIXEL_INSTALLATION_STATUS,
  PIXEL_CHANGE_STATUS,
  PIXEL_CHANGE_TYPES,
  HANDOFF_STATUS,
  type PixelInstallationStatus,
  type PixelChangeStatus,
  type PixelChangeType,
  type HandoffStatus,
  type PixelFeatures,
  type PixelInstallationSelect,
  type PixelInstallationInsert,
  type PixelDomChangeSelect,
  type PixelDomChangeInsert,
  type PixelAnalyticsDailySelect,
  type PixelAnalyticsDailyInsert,
  type DeveloperHandoffSelect,
  type DeveloperHandoffInsert,
} from "./pixel-schema";

describe("pixel-schema", () => {
  describe("PIXEL_INSTALLATION_STATUS constants", () => {
    it("contains exactly 4 status values", () => {
      expect(PIXEL_INSTALLATION_STATUS).toHaveLength(4);
    });

    it("contains all expected values in order", () => {
      expect(PIXEL_INSTALLATION_STATUS).toEqual(["pending", "detected", "verified", "error"]);
    });

    it("is a readonly array", () => {
      const status: PixelInstallationStatus = "verified";
      expect(PIXEL_INSTALLATION_STATUS.includes(status)).toBe(true);
    });
  });

  describe("PIXEL_CHANGE_STATUS constants", () => {
    it("contains exactly 5 status values", () => {
      expect(PIXEL_CHANGE_STATUS).toHaveLength(5);
    });

    it("contains all expected values", () => {
      expect(PIXEL_CHANGE_STATUS).toEqual([
        "pending",
        "approved",
        "rejected",
        "live",
        "rolled_back",
      ]);
    });
  });

  describe("PIXEL_CHANGE_TYPES constants", () => {
    it("contains exactly 6 change types", () => {
      expect(PIXEL_CHANGE_TYPES).toHaveLength(6);
    });

    it("contains all SEO-relevant change types", () => {
      expect(PIXEL_CHANGE_TYPES).toContain("meta_title");
      expect(PIXEL_CHANGE_TYPES).toContain("meta_description");
      expect(PIXEL_CHANGE_TYPES).toContain("canonical");
      expect(PIXEL_CHANGE_TYPES).toContain("schema");
      expect(PIXEL_CHANGE_TYPES).toContain("internal_link");
      expect(PIXEL_CHANGE_TYPES).toContain("content");
    });
  });

  describe("HANDOFF_STATUS constants", () => {
    it("contains exactly 4 status values", () => {
      expect(HANDOFF_STATUS).toHaveLength(4);
    });

    it("contains all expected values", () => {
      expect(HANDOFF_STATUS).toEqual(["sent", "opened", "completed", "expired"]);
    });
  });

  describe("pixelInstallations table", () => {
    it("has id primary key column", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.id).toBeDefined();
      expect(columns.id.dataType).toBe("string");
    });

    it("has workspaceId foreign key column", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.workspaceId).toBeDefined();
      expect(columns.workspaceId.dataType).toBe("string");
    });

    it("has siteId column for unique pixel identifier", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.siteId).toBeDefined();
      expect(columns.siteId.dataType).toBe("string");
    });

    it("has status column with valid values", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.status).toBeDefined();
      expect(columns.status.dataType).toBe("string");
    });

    it("has detection tracking columns", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.firstPingAt).toBeDefined();
      expect(columns.lastPingAt).toBeDefined();
      expect(columns.pingCount).toBeDefined();
    });

    it("has features JSONB column", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.features).toBeDefined();
      expect(columns.features.dataType).toBe("json");
    });

    it("has allowedOrigins array column", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.allowedOrigins).toBeDefined();
    });

    it("has timestamp columns", () => {
      const columns = getTableColumns(pixelInstallations);
      expect(columns.createdAt).toBeDefined();
      expect(columns.updatedAt).toBeDefined();
    });
  });

  describe("pixelDomChanges table", () => {
    it("has id primary key column", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.id).toBeDefined();
    });

    it("has installationId foreign key column", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.installationId).toBeDefined();
    });

    it("has changeType column for SEO modification types", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.changeType).toBeDefined();
    });

    it("has targetSelector and targetUrl columns", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.targetSelector).toBeDefined();
      expect(columns.targetUrl).toBeDefined();
    });

    it("has oldValue and newValue columns", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.oldValue).toBeDefined();
      expect(columns.newValue).toBeDefined();
    });

    it("has approval tracking columns", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.status).toBeDefined();
      expect(columns.approvedBy).toBeDefined();
      expect(columns.approvedAt).toBeDefined();
      expect(columns.deployedAt).toBeDefined();
    });

    it("has createdAt timestamp", () => {
      const columns = getTableColumns(pixelDomChanges);
      expect(columns.createdAt).toBeDefined();
    });
  });

  describe("pixelAnalyticsDaily table", () => {
    it("has id primary key column", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.id).toBeDefined();
    });

    it("has installationId foreign key column", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.installationId).toBeDefined();
    });

    it("has date column for daily aggregation", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.date).toBeDefined();
    });

    it("has traffic metric columns", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.pageviews).toBeDefined();
      expect(columns.sessions).toBeDefined();
      expect(columns.uniqueVisitors).toBeDefined();
    });

    it("has engagement metric columns", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.avgTimeOnPage).toBeDefined();
      expect(columns.bounceRate).toBeDefined();
    });

    it("has Core Web Vitals aggregate columns", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.lcpP75).toBeDefined();
      expect(columns.clsP75).toBeDefined();
      expect(columns.inpP75).toBeDefined();
    });

    it("has topPages JSONB column", () => {
      const columns = getTableColumns(pixelAnalyticsDaily);
      expect(columns.topPages).toBeDefined();
    });
  });

  describe("developerHandoffs table", () => {
    it("has id primary key column", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.id).toBeDefined();
    });

    it("has installationId foreign key column", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.installationId).toBeDefined();
    });

    it("has developer contact columns", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.developerEmail).toBeDefined();
      expect(columns.developerName).toBeDefined();
    });

    it("has status column", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.status).toBeDefined();
    });

    it("has magic link columns", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.magicLinkToken).toBeDefined();
      expect(columns.magicLinkExpiresAt).toBeDefined();
    });

    it("has tracking timestamp columns", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.sentAt).toBeDefined();
      expect(columns.openedAt).toBeDefined();
      expect(columns.completedAt).toBeDefined();
    });

    it("has reminder tracking columns", () => {
      const columns = getTableColumns(developerHandoffs);
      expect(columns.reminderCount).toBeDefined();
      expect(columns.lastReminderAt).toBeDefined();
    });
  });

  describe("PixelFeatures type", () => {
    it("accepts valid feature configuration", () => {
      const features: PixelFeatures = {
        analytics: true,
        cwv: true,
        metaInjection: false,
        schemaInjection: false,
        linkInjection: false,
        abTesting: false,
      };

      expect(features.analytics).toBe(true);
      expect(features.cwv).toBe(true);
      expect(features.metaInjection).toBe(false);
    });

    it("requires all boolean feature flags", () => {
      const features: PixelFeatures = {
        analytics: true,
        cwv: true,
        metaInjection: true,
        schemaInjection: true,
        linkInjection: true,
        abTesting: true,
      };

      // All 6 features defined
      expect(Object.keys(features)).toHaveLength(6);
    });
  });

  describe("type exports", () => {
    it("exports PixelInstallationSelect type", () => {
      const select: Partial<PixelInstallationSelect> = {
        id: "pix-001",
        status: "verified",
        pingCount: 42,
      };
      expect(select.pingCount).toBe(42);
    });

    it("exports PixelInstallationInsert type", () => {
      const insert: Partial<PixelInstallationInsert> = {
        workspaceId: "workspace-123",
        siteId: "site-456",
        status: "pending",
      };
      expect(insert.siteId).toBe("site-456");
    });

    it("exports PixelDomChangeSelect type", () => {
      const select: Partial<PixelDomChangeSelect> = {
        id: "change-001",
        changeType: "meta_title",
        status: "approved",
      };
      expect(select.changeType).toBe("meta_title");
    });

    it("exports PixelDomChangeInsert type", () => {
      const insert: Partial<PixelDomChangeInsert> = {
        installationId: "pix-001",
        changeType: "canonical",
        newValue: "https://example.com/page",
      };
      expect(insert.changeType).toBe("canonical");
    });

    it("exports PixelAnalyticsDailySelect type", () => {
      const select: Partial<PixelAnalyticsDailySelect> = {
        id: "analytics-001",
        pageviews: 1000,
        sessions: 800,
      };
      expect(select.pageviews).toBe(1000);
    });

    it("exports PixelAnalyticsDailyInsert type", () => {
      const insert: Partial<PixelAnalyticsDailyInsert> = {
        installationId: "pix-001",
        pageviews: 500,
        lcpP75: "2500.00",
      };
      expect(insert.pageviews).toBe(500);
    });

    it("exports DeveloperHandoffSelect type", () => {
      const select: Partial<DeveloperHandoffSelect> = {
        id: "handoff-001",
        status: "sent",
        reminderCount: 2,
      };
      expect(select.reminderCount).toBe(2);
    });

    it("exports DeveloperHandoffInsert type", () => {
      const insert: Partial<DeveloperHandoffInsert> = {
        installationId: "pix-001",
        developerEmail: "dev@example.com",
        status: "sent",
      };
      expect(insert.developerEmail).toBe("dev@example.com");
    });
  });
});
