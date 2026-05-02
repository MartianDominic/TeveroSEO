/**
 * Test: Follow-ups and workflow schema tables
 * Phase 62-01: Database schema for Agency Command Center
 *
 * TDD RED phase: These tests define the expected schema structure.
 */
import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";

// Import the schemas (will fail until implemented)
import {
  followUps,
  followUpRules,
  FOLLOW_UP_TYPES,
  FOLLOW_UP_STATUS,
  FOLLOW_UP_PRIORITY,
  ENTITY_TYPES,
  followUpsRelations,
  followUpRulesRelations,
  type FollowUpSelect,
  type FollowUpInsert,
  type FollowUpRuleSelect,
  type FollowUpRuleInsert,
  RULE_ACTION_TYPES,
} from "./follow-ups";

import {
  workflowTemplates,
  workflowTemplatesRelations,
  WORKFLOW_TRIGGER_EVENTS,
  type WorkflowTemplateSelect,
  type WorkflowTemplateInsert,
} from "./workflow-templates";

import {
  workflowInstances,
  workflowEvents,
  workflowInstancesRelations,
  workflowEventsRelations,
  WORKFLOW_INSTANCE_STATUS,
  WORKFLOW_EVENT_TYPES,
  type WorkflowInstanceSelect,
  type WorkflowInstanceInsert,
  type WorkflowEventSelect,
  type WorkflowEventInsert,
} from "./workflow-instances";

describe("Follow-ups Schema", () => {
  describe("followUps table", () => {
    it("has polymorphic entity_type column with valid types", () => {
      expect(ENTITY_TYPES).toContain("prospect");
      expect(ENTITY_TYPES).toContain("proposal");
      expect(ENTITY_TYPES).toContain("contract");
      expect(ENTITY_TYPES).toContain("invoice");
      expect(ENTITY_TYPES).toContain("client");
      expect(ENTITY_TYPES.length).toBe(5);
    });

    it("has follow_up_type column with valid types", () => {
      expect(FOLLOW_UP_TYPES).toContain("reminder");
      expect(FOLLOW_UP_TYPES).toContain("check_in");
      expect(FOLLOW_UP_TYPES).toContain("escalation");
      expect(FOLLOW_UP_TYPES).toContain("deadline");
      expect(FOLLOW_UP_TYPES).toContain("custom");
      expect(FOLLOW_UP_TYPES.length).toBe(5);
    });

    it("has status column with all states", () => {
      expect(FOLLOW_UP_STATUS).toContain("pending");
      expect(FOLLOW_UP_STATUS).toContain("snoozed");
      expect(FOLLOW_UP_STATUS).toContain("completed");
      expect(FOLLOW_UP_STATUS).toContain("cancelled");
      expect(FOLLOW_UP_STATUS).toContain("auto_resolved");
      expect(FOLLOW_UP_STATUS.length).toBe(5);
    });

    it("has priority column with valid levels", () => {
      expect(FOLLOW_UP_PRIORITY).toContain("low");
      expect(FOLLOW_UP_PRIORITY).toContain("medium");
      expect(FOLLOW_UP_PRIORITY).toContain("high");
      expect(FOLLOW_UP_PRIORITY).toContain("critical");
      expect(FOLLOW_UP_PRIORITY.length).toBe(4);
    });

    it("exports type definitions", () => {
      const selectType: FollowUpSelect = {} as FollowUpSelect;
      const insertType: FollowUpInsert = {} as FollowUpInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });

    it("has required columns", () => {
      expect(followUps.id).toBeDefined();
      expect(followUps.workspaceId).toBeDefined();
      expect(followUps.entityType).toBeDefined();
      expect(followUps.entityId).toBeDefined();
      expect(followUps.followUpType).toBeDefined();
      expect(followUps.title).toBeDefined();
      expect(followUps.scheduledAt).toBeDefined();
      expect(followUps.status).toBeDefined();
      expect(followUps.priority).toBeDefined();
      expect(followUps.createdBy).toBeDefined();
      expect(followUps.metadata).toBeDefined();
      expect(followUps.createdAt).toBeDefined();
      expect(followUps.updatedAt).toBeDefined();
    });
  });

  describe("followUpRules table", () => {
    it("has trigger_conditions JSONB column", () => {
      expect(followUpRules.triggerConditions).toBeDefined();
    });

    it("has action_type column with valid types", () => {
      expect(RULE_ACTION_TYPES).toContain("create_follow_up");
      expect(RULE_ACTION_TYPES).toContain("send_notification");
      expect(RULE_ACTION_TYPES).toContain("escalate");
      expect(RULE_ACTION_TYPES).toContain("auto_reminder");
      expect(RULE_ACTION_TYPES.length).toBe(4);
    });

    it("exports type definitions", () => {
      const selectType: FollowUpRuleSelect = {} as FollowUpRuleSelect;
      const insertType: FollowUpRuleInsert = {} as FollowUpRuleInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });

    it("has required columns", () => {
      expect(followUpRules.id).toBeDefined();
      expect(followUpRules.workspaceId).toBeDefined();
      expect(followUpRules.name).toBeDefined();
      expect(followUpRules.entityType).toBeDefined();
      expect(followUpRules.triggerConditions).toBeDefined();
      expect(followUpRules.actionType).toBeDefined();
      expect(followUpRules.actionConfig).toBeDefined();
      expect(followUpRules.isActive).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines followUps relations", () => {
      expect(followUpsRelations).toBeDefined();
    });

    it("defines followUpRules relations", () => {
      expect(followUpRulesRelations).toBeDefined();
    });
  });
});

describe("Workflow Templates Schema", () => {
  describe("workflowTemplates table", () => {
    it("has steps JSONB column", () => {
      expect(workflowTemplates.steps).toBeDefined();
    });

    it("has anti-annoyance fields", () => {
      expect(workflowTemplates.maxTouchesPerWeek).toBeDefined();
      expect(workflowTemplates.cooldownHours).toBeDefined();
      expect(workflowTemplates.skipOnResponse).toBeDefined();
      expect(workflowTemplates.pauseOnNegativeSignal).toBeDefined();
    });

    it("has trigger_event values", () => {
      expect(WORKFLOW_TRIGGER_EVENTS).toContain("proposal_sent");
      expect(WORKFLOW_TRIGGER_EVENTS).toContain("contract_sent");
      expect(WORKFLOW_TRIGGER_EVENTS).toContain("invoice_sent");
      expect(WORKFLOW_TRIGGER_EVENTS).toContain("prospect_qualified");
    });

    it("exports type definitions", () => {
      const selectType: WorkflowTemplateSelect = {} as WorkflowTemplateSelect;
      const insertType: WorkflowTemplateInsert = {} as WorkflowTemplateInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });

    it("has required columns", () => {
      expect(workflowTemplates.id).toBeDefined();
      expect(workflowTemplates.name).toBeDefined();
      expect(workflowTemplates.entityType).toBeDefined();
      expect(workflowTemplates.triggerEvent).toBeDefined();
      expect(workflowTemplates.steps).toBeDefined();
      expect(workflowTemplates.isActive).toBeDefined();
      expect(workflowTemplates.isSystem).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines workflowTemplates relations", () => {
      expect(workflowTemplatesRelations).toBeDefined();
    });
  });
});

describe("Workflow Instances Schema", () => {
  describe("workflowInstances table", () => {
    it("has state machine status with snooze support", () => {
      expect(WORKFLOW_INSTANCE_STATUS).toContain("pending");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("active");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("paused");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("snoozed");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("completed");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("cancelled");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("won");
      expect(WORKFLOW_INSTANCE_STATUS).toContain("lost");
      expect(WORKFLOW_INSTANCE_STATUS.length).toBe(8);
    });

    it("has snooze support fields", () => {
      expect(workflowInstances.snoozedUntil).toBeDefined();
      expect(workflowInstances.snoozeReason).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: WorkflowInstanceSelect = {} as WorkflowInstanceSelect;
      const insertType: WorkflowInstanceInsert = {} as WorkflowInstanceInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("workflowEvents table", () => {
    it("has event_type enum with all types", () => {
      expect(WORKFLOW_EVENT_TYPES).toContain("started");
      expect(WORKFLOW_EVENT_TYPES).toContain("step_executed");
      expect(WORKFLOW_EVENT_TYPES).toContain("step_skipped");
      expect(WORKFLOW_EVENT_TYPES).toContain("paused");
      expect(WORKFLOW_EVENT_TYPES).toContain("resumed");
      expect(WORKFLOW_EVENT_TYPES).toContain("snoozed");
      expect(WORKFLOW_EVENT_TYPES).toContain("unsnoozed");
      expect(WORKFLOW_EVENT_TYPES).toContain("response_detected");
      expect(WORKFLOW_EVENT_TYPES).toContain("completed");
      expect(WORKFLOW_EVENT_TYPES).toContain("cancelled");
      expect(WORKFLOW_EVENT_TYPES).toContain("error");
      expect(WORKFLOW_EVENT_TYPES.length).toBe(11);
    });

    it("has instance_id foreign key", () => {
      expect(workflowEvents.instanceId).toBeDefined();
    });

    it("exports type definitions", () => {
      const selectType: WorkflowEventSelect = {} as WorkflowEventSelect;
      const insertType: WorkflowEventInsert = {} as WorkflowEventInsert;
      expect(selectType).toBeDefined();
      expect(insertType).toBeDefined();
    });
  });

  describe("relations", () => {
    it("defines workflowInstances relations", () => {
      expect(workflowInstancesRelations).toBeDefined();
    });

    it("defines workflowEvents relations", () => {
      expect(workflowEventsRelations).toBeDefined();
    });
  });
});
