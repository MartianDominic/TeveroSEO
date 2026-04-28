/**
 * Tests for dashboard metrics Drizzle schema.
 * Phase 21: Agency Command Center
 */
import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import {
  clientDashboardMetrics,
  portfolioActivity,
  dashboardViews,
  type ClientDashboardMetricsSelect,
  type ClientDashboardMetricsInsert,
  type PortfolioActivitySelect,
  type PortfolioActivityInsert,
  type DashboardViewSelect,
  type DashboardViewInsert,
} from "./dashboard-schema";

describe("dashboard-schema", () => {
  describe("clientDashboardMetrics table", () => {
    it("should have table name 'client_dashboard_metrics'", () => {
      expect(getTableName(clientDashboardMetrics)).toBe("client_dashboard_metrics");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(clientDashboardMetrics);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("healthScore");
      expect(columnNames).toContain("healthBreakdown");
      expect(columnNames).toContain("trafficCurrent");
      expect(columnNames).toContain("trafficPrevious");
      expect(columnNames).toContain("trafficTrendPct");
      expect(columnNames).toContain("keywordsTotal");
      expect(columnNames).toContain("keywordsTop10");
      expect(columnNames).toContain("keywordsTop3");
      expect(columnNames).toContain("keywordsPosition1");
      expect(columnNames).toContain("keywordsDistribution");
      expect(columnNames).toContain("backlinksTotal");
      expect(columnNames).toContain("backlinksNewMonth");
      expect(columnNames).toContain("alertsOpen");
      expect(columnNames).toContain("alertsCritical");
      expect(columnNames).toContain("lastReportAt");
      expect(columnNames).toContain("lastAuditAt");
      // Goal-based metrics (Phase 22)
      expect(columnNames).toContain("goalAttainmentPct");
      expect(columnNames).toContain("goalsMetCount");
      expect(columnNames).toContain("goalsTotalCount");
      expect(columnNames).toContain("primaryGoalName");
      expect(columnNames).toContain("primaryGoalPct");
      expect(columnNames).toContain("primaryGoalTrend");
      expect(columnNames).toContain("priorityScore");
      expect(columnNames).toContain("computedAt");
    });

    it("should have healthScore as integer", () => {
      const columns = getTableColumns(clientDashboardMetrics);
      expect(columns.healthScore.dataType).toBe("number");
      expect(columns.healthScore.notNull).toBe(true);
    });

    it("should have clientId as unique non-null text", () => {
      const columns = getTableColumns(clientDashboardMetrics);
      expect(columns.clientId.dataType).toBe("string");
      expect(columns.clientId.notNull).toBe(true);
    });
  });

  describe("portfolioActivity table", () => {
    it("should have table name 'portfolio_activity'", () => {
      expect(getTableName(portfolioActivity)).toBe("portfolio_activity");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(portfolioActivity);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("clientId");
      expect(columnNames).toContain("eventType");
      expect(columnNames).toContain("eventData");
      expect(columnNames).toContain("createdAt");
    });

    it("should have eventType as non-null text", () => {
      const columns = getTableColumns(portfolioActivity);
      expect(columns.eventType.dataType).toBe("string");
      expect(columns.eventType.notNull).toBe(true);
    });

    it("should have clientId as nullable text", () => {
      const columns = getTableColumns(portfolioActivity);
      expect(columns.clientId.dataType).toBe("string");
      expect(columns.clientId.notNull).toBe(false);
    });
  });

  describe("dashboardViews table", () => {
    it("should have table name 'dashboard_views'", () => {
      expect(getTableName(dashboardViews)).toBe("dashboard_views");
    });

    it("should have all required columns", () => {
      const columns = getTableColumns(dashboardViews);
      const columnNames = Object.keys(columns);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("workspaceId");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("filters");
      expect(columnNames).toContain("layout");
      expect(columnNames).toContain("isDefault");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    it("should have isDefault as boolean", () => {
      const columns = getTableColumns(dashboardViews);
      expect(columns.isDefault.dataType).toBe("boolean");
      expect(columns.isDefault.notNull).toBe(true);
    });
  });

  describe("Type exports", () => {
    it("should export ClientDashboardMetricsSelect type", () => {
      const _typeCheck: ClientDashboardMetricsSelect = {
        id: "uuid",
        clientId: "client-123",
        healthScore: 85,
        healthBreakdown: { traffic: 25, rankings: 20, technical: 18, backlinks: 12, content: 10 },
        trafficCurrent: 1000,
        trafficPrevious: 800,
        trafficTrendPct: "0.2500",
        keywordsTotal: 50,
        keywordsTop10: 30,
        keywordsTop3: 15,
        keywordsPosition1: 5,
        keywordsDistribution: { top10: 30, top3: 15, position1: 5 },
        backlinksTotal: 200,
        backlinksNewMonth: 10,
        alertsOpen: 2,
        alertsCritical: 0,
        lastReportAt: new Date(),
        lastAuditAt: new Date(),
        // Goal-based metrics (Phase 22)
        goalAttainmentPct: "85.50",
        goalsMetCount: 3,
        goalsTotalCount: 5,
        primaryGoalName: "Keywords in Top 10",
        primaryGoalPct: "70.00",
        primaryGoalTrend: "up",
        priorityScore: 250,
        computedAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export PortfolioActivitySelect type", () => {
      const _typeCheck: PortfolioActivitySelect = {
        id: "uuid",
        workspaceId: "workspace-123",
        clientId: "client-123",
        eventType: "alert_triggered",
        eventData: { alertId: "alert-456", severity: "critical" },
        createdAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });

    it("should export DashboardViewSelect type", () => {
      const _typeCheck: DashboardViewSelect = {
        id: "uuid",
        workspaceId: "workspace-123",
        userId: "user-123",
        name: "My View",
        filters: { status: "active" },
        layout: { cardOrder: ["health", "traffic", "keywords"] },
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(_typeCheck).toBeDefined();
    });
  });
});
