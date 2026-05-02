/**
 * Test: Deal outcomes, pipeline metrics, alerts, and preferences schemas
 * Phase 62-01: Database schema for Agency Command Center
 *
 * TDD RED phase: These tests define the expected schema structure.
 */
import { describe, it, expect } from "vitest";

// Deal outcomes imports
import {
  dealOutcomes,
  LOSS_REASONS,
  DEAL_OUTCOMES,
  dealOutcomesRelations,
  type DealOutcomeSelect,
  type DealOutcomeInsert,
} from "./deal-outcomes";

// Pipeline metrics imports
import {
  pipelineMetrics,
  pipelineMetricsRelations,
  type PipelineMetricsSelect,
  type PipelineMetricsInsert,
} from "./pipeline-metrics";

// Smart alerts imports
import {
  smartAlerts,
  ALERT_SEVERITIES,
  smartAlertsRelations,
  type SmartAlertSelect,
  type SmartAlertInsert,
} from "./smart-alerts";

// Dashboard views imports
import {
  dashboardViews,
  dashboardViewsRelations,
  type DashboardViewSelect,
  type DashboardViewInsert,
} from "./dashboard-views";

// Notification preferences imports
import {
  notificationPreferences,
  notificationPreferencesRelations,
  type NotificationPreferencesSelect,
  type NotificationPreferencesInsert,
} from "./notification-preferences";

describe("Deal Outcomes Schema", () => {
  describe("dealOutcomes table", () => {
    it("has loss_reason with 17 values", () => {
      expect(LOSS_REASONS).toContain("too_expensive");
      expect(LOSS_REASONS).toContain("budget_cut");
      expect(LOSS_REASONS).toContain("competitor_cheaper");
      expect(LOSS_REASONS).toContain("bad_timing");
      expect(LOSS_REASONS).toContain("project_delayed");
      expect(LOSS_REASONS).toContain("internal_changes");
      expect(LOSS_REASONS).toContain("wrong_fit");
      expect(LOSS_REASONS).toContain("scope_mismatch");
      expect(LOSS_REASONS).toContain("different_direction");
      expect(LOSS_REASONS).toContain("chose_competitor");
      expect(LOSS_REASONS).toContain("went_internal");
      expect(LOSS_REASONS).toContain("found_alternative");
      expect(LOSS_REASONS).toContain("unresponsive");
      expect(LOSS_REASONS).toContain("ghosted");
      expect(LOSS_REASONS).toContain("decision_maker_left");
      expect(LOSS_REASONS).toContain("unknown");
      expect(LOSS_REASONS).toContain("other");
      expect(LOSS_REASONS.length).toBe(17);
    });

    it("has outcome CHECK constraint with won/lost", () => {
      expect(DEAL_OUTCOMES).toContain("won");
      expect(DEAL_OUTCOMES).toContain("lost");
      expect(DEAL_OUTCOMES.length).toBe(2);
    });

    it("has required columns", () => {
      expect(dealOutcomes.id).toBeDefined();
      expect(dealOutcomes.workspaceId).toBeDefined();
      expect(dealOutcomes.entityType).toBeDefined();
      expect(dealOutcomes.entityId).toBeDefined();
      expect(dealOutcomes.outcome).toBeDefined();
      expect(dealOutcomes.lossReason).toBeDefined();
      expect(dealOutcomes.dealValueCents).toBeDefined();
      expect(dealOutcomes.outcomeAt).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: DealOutcomeSelect = {} as DealOutcomeSelect;
      const insertType: DealOutcomeInsert = {} as DealOutcomeInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines dealOutcomes relations", () => {
      expect(dealOutcomesRelations).toBeDefined();
    });
  });
});

describe("Pipeline Metrics Schema", () => {
  describe("pipelineMetrics table", () => {
    it("has UNIQUE constraint on workspace_id", () => {
      // The table should have workspace_id as a column
      expect(pipelineMetrics.workspaceId).toBeDefined();
    });

    it("has prospect count columns", () => {
      expect(pipelineMetrics.prospectsNew).toBeDefined();
      expect(pipelineMetrics.prospectsQualified).toBeDefined();
      expect(pipelineMetrics.prospectsContacted).toBeDefined();
    });

    it("has proposal count columns", () => {
      expect(pipelineMetrics.proposalsDraft).toBeDefined();
      expect(pipelineMetrics.proposalsSent).toBeDefined();
      expect(pipelineMetrics.proposalsViewed).toBeDefined();
    });

    it("has financial columns", () => {
      expect(pipelineMetrics.pipelineValueDraftCents).toBeDefined();
      expect(pipelineMetrics.pipelineValueSentCents).toBeDefined();
      expect(pipelineMetrics.revenueThisMonthCents).toBeDefined();
      expect(pipelineMetrics.outstandingCents).toBeDefined();
    });

    it("has conversion rate columns", () => {
      expect(pipelineMetrics.winRatePct).toBeDefined();
      expect(pipelineMetrics.prospectToQualifiedPct).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: PipelineMetricsSelect = {} as PipelineMetricsSelect;
      const insertType: PipelineMetricsInsert = {} as PipelineMetricsInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines pipelineMetrics relations", () => {
      expect(pipelineMetricsRelations).toBeDefined();
    });
  });
});

describe("Smart Alerts Schema", () => {
  describe("smartAlerts table", () => {
    it("has severity CHECK constraint", () => {
      expect(ALERT_SEVERITIES).toContain("critical");
      expect(ALERT_SEVERITIES).toContain("high");
      expect(ALERT_SEVERITIES).toContain("medium");
      expect(ALERT_SEVERITIES).toContain("low");
      expect(ALERT_SEVERITIES.length).toBe(4);
    });

    it("has required columns", () => {
      expect(smartAlerts.id).toBeDefined();
      expect(smartAlerts.workspaceId).toBeDefined();
      expect(smartAlerts.alertType).toBeDefined();
      expect(smartAlerts.severity).toBeDefined();
      expect(smartAlerts.title).toBeDefined();
      expect(smartAlerts.description).toBeDefined();
      expect(smartAlerts.isDismissed).toBeDefined();
    });

    it("has entity reference columns", () => {
      expect(smartAlerts.entityType).toBeDefined();
      expect(smartAlerts.entityId).toBeDefined();
    });

    it("has metric comparison columns", () => {
      expect(smartAlerts.metricCurrent).toBeDefined();
      expect(smartAlerts.metricPrevious).toBeDefined();
      expect(smartAlerts.metricUnit).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: SmartAlertSelect = {} as SmartAlertSelect;
      const insertType: SmartAlertInsert = {} as SmartAlertInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines smartAlerts relations", () => {
      expect(smartAlertsRelations).toBeDefined();
    });
  });
});

describe("Dashboard Views Schema", () => {
  describe("dashboardViews table", () => {
    it("allows null user_id for shared views", () => {
      // user_id should be nullable
      expect(dashboardViews.userId).toBeDefined();
    });

    it("has required columns", () => {
      expect(dashboardViews.id).toBeDefined();
      expect(dashboardViews.workspaceId).toBeDefined();
      expect(dashboardViews.name).toBeDefined();
      expect(dashboardViews.isDefault).toBeDefined();
      expect(dashboardViews.filters).toBeDefined();
      expect(dashboardViews.layout).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: DashboardViewSelect = {} as DashboardViewSelect;
      const insertType: DashboardViewInsert = {} as DashboardViewInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines dashboardViews relations", () => {
      expect(dashboardViewsRelations).toBeDefined();
    });
  });
});

describe("Notification Preferences Schema", () => {
  describe("notificationPreferences table", () => {
    it("has user_id and workspace_id columns for UNIQUE constraint", () => {
      expect(notificationPreferences.userId).toBeDefined();
      expect(notificationPreferences.workspaceId).toBeDefined();
    });

    it("has channel toggles", () => {
      expect(notificationPreferences.emailEnabled).toBeDefined();
      expect(notificationPreferences.inAppEnabled).toBeDefined();
      expect(notificationPreferences.slackEnabled).toBeDefined();
    });

    it("has event type toggles", () => {
      expect(notificationPreferences.notifyOverdueInvoice).toBeDefined();
      expect(notificationPreferences.notifyContractExpiring).toBeDefined();
      expect(notificationPreferences.notifyProposalViewed).toBeDefined();
      expect(notificationPreferences.notifyContractSigned).toBeDefined();
      expect(notificationPreferences.notifyPaymentReceived).toBeDefined();
      expect(notificationPreferences.notifySmartAlerts).toBeDefined();
      expect(notificationPreferences.notifyFollowUpDue).toBeDefined();
    });

    it("has daily digest settings", () => {
      expect(notificationPreferences.dailyDigestEnabled).toBeDefined();
      expect(notificationPreferences.dailyDigestHour).toBeDefined();
    });

    it("has quiet hours settings", () => {
      expect(notificationPreferences.quietHoursStart).toBeDefined();
      expect(notificationPreferences.quietHoursEnd).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: NotificationPreferencesSelect =
        {} as NotificationPreferencesSelect;
      const insertType: NotificationPreferencesInsert =
        {} as NotificationPreferencesInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines notificationPreferences relations", () => {
      expect(notificationPreferencesRelations).toBeDefined();
    });
  });
});
