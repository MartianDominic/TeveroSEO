/**
 * RulesEngine tests
 * Phase 62-02: Follow-up system with rules engine
 *
 * Tests:
 * - evaluateTriggerConditions returns true when status_changed_to matches
 * - evaluateTriggerConditions returns true when days_since threshold met
 * - evaluateTriggerConditions returns false when conditions not met
 * - processEntityEvent finds matching rules and creates follow-ups
 * - processEntityEvent respects is_active flag on rules
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EntityType, TriggerConditions, FollowUpRuleSelect } from "@/db/follow-up-schema";

// Use vi.hoisted() for mock functions
const {
  mockFindByEntityType,
  mockCreateAutomated,
  mockQueueAdd,
} = vi.hoisted(() => ({
  mockFindByEntityType: vi.fn(),
  mockCreateAutomated: vi.fn(),
  mockQueueAdd: vi.fn(),
}));

vi.mock("../repositories/FollowUpRulesRepository", () => ({
  FollowUpRulesRepository: {
    findByEntityType: mockFindByEntityType,
  },
}));

vi.mock("./FollowUpService", () => ({
  FollowUpService: {
    createAutomated: mockCreateAutomated,
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import after mocks
import { RulesEngine, evaluateTriggerConditions, type EntityEvent } from "./RulesEngine";

describe("RulesEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateTriggerConditions", () => {
    it("should return true when status_changed_to matches", () => {
      const conditions: TriggerConditions = {
        status_changed_to: "sent",
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        previousStatus: "draft",
        currentStatus: "sent",
      };

      const entityData = { status: "sent" };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(true);
    });

    it("should return false when status_changed_to does not match", () => {
      const conditions: TriggerConditions = {
        status_changed_to: "accepted",
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        previousStatus: "draft",
        currentStatus: "sent",
      };

      const entityData = { status: "sent" };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(false);
    });

    it("should return true when status_equals matches", () => {
      const conditions: TriggerConditions = {
        status_equals: "overdue",
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "invoice",
        entityId: "invoice-1",
        eventType: "updated",
      };

      const entityData = { status: "overdue" };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(true);
    });

    it("should return true when days_since threshold met", () => {
      const conditions: TriggerConditions = {
        days_since: 3,
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "updated",
      };

      // Entity was created 5 days ago
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const entityData = {
        status: "sent",
        created_at: fiveDaysAgo.toISOString(),
      };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(true);
    });

    it("should return false when days_since threshold not met", () => {
      const conditions: TriggerConditions = {
        days_since: 7,
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "updated",
      };

      // Entity was created 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const entityData = {
        status: "sent",
        created_at: threeDaysAgo.toISOString(),
      };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(false);
    });

    it("should return true when days_overdue_gte threshold met", () => {
      const conditions: TriggerConditions = {
        days_overdue_gte: 7,
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "invoice",
        entityId: "invoice-1",
        eventType: "overdue",
      };

      // Invoice was due 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const entityData = {
        status: "overdue",
        due_date: tenDaysAgo.toISOString(),
      };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(true);
    });

    it("should return true when value_gte_cents threshold met", () => {
      const conditions: TriggerConditions = {
        value_gte_cents: 500000, // 5000 EUR
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "created",
      };

      const entityData = {
        status: "draft",
        total_value_cents: 750000, // 7500 EUR
      };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(true);
    });

    it("should return false when conditions not met", () => {
      const conditions: TriggerConditions = {
        status_changed_to: "accepted",
        value_gte_cents: 1000000,
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        currentStatus: "sent",
      };

      const entityData = {
        status: "sent",
        total_value_cents: 500000,
      };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(false);
    });

    it("should require all conditions to match (AND logic)", () => {
      const conditions: TriggerConditions = {
        status_changed_to: "sent",
        value_gte_cents: 500000,
      };

      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        currentStatus: "sent",
      };

      // Value is too low
      const entityData = {
        status: "sent",
        total_value_cents: 300000,
      };

      const result = evaluateTriggerConditions(conditions, event, entityData);
      expect(result).toBe(false);
    });
  });

  describe("processEntityEvent", () => {
    it("should find matching rules and create follow-ups", async () => {
      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        currentStatus: "sent",
      };

      const entityData = {
        status: "sent",
        total_value_cents: 500000,
      };

      const mockRule: Partial<FollowUpRuleSelect> = {
        id: "rule-1",
        workspaceId: "workspace-1",
        name: "Proposal follow-up",
        entityType: "proposal",
        triggerConditions: { status_changed_to: "sent" },
        actionType: "create_follow_up",
        actionConfig: {
          follow_up_type: "reminder",
          priority: "high",
          assign_to: "owner",
          title_template: "Follow up on proposal",
        },
        delayHours: 0,
        isActive: true,
      };

      mockFindByEntityType.mockResolvedValue([mockRule]);
      mockCreateAutomated.mockResolvedValue({ id: "followup-1" });

      const engine = new RulesEngine(mockQueueAdd);
      const result = await engine.processEntityEvent(event, entityData);

      expect(result).toHaveLength(1);
      expect(mockCreateAutomated).toHaveBeenCalled();
    });

    it("should respect is_active flag on rules", async () => {
      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        currentStatus: "sent",
      };

      const entityData = { status: "sent" };

      // Rule is inactive
      const mockRule: Partial<FollowUpRuleSelect> = {
        id: "rule-1",
        workspaceId: "workspace-1",
        name: "Inactive rule",
        entityType: "proposal",
        triggerConditions: { status_changed_to: "sent" },
        actionType: "create_follow_up",
        actionConfig: {
          follow_up_type: "reminder",
          priority: "high",
          assign_to: "owner",
        },
        delayHours: 0,
        isActive: false, // Inactive
      };

      // findByEntityType only returns active rules, so this simulates empty result
      mockFindByEntityType.mockResolvedValue([]);

      const engine = new RulesEngine(mockQueueAdd);
      const result = await engine.processEntityEvent(event, entityData);

      expect(result).toHaveLength(0);
      expect(mockCreateAutomated).not.toHaveBeenCalled();
    });

    it("should schedule delayed follow-up when delay_hours > 0", async () => {
      const event: EntityEvent = {
        workspaceId: "workspace-1",
        entityType: "proposal",
        entityId: "proposal-1",
        eventType: "status_changed",
        currentStatus: "sent",
      };

      const entityData = { status: "sent" };

      const mockRule: Partial<FollowUpRuleSelect> = {
        id: "rule-1",
        workspaceId: "workspace-1",
        name: "Delayed follow-up",
        entityType: "proposal",
        triggerConditions: { status_changed_to: "sent" },
        actionType: "create_follow_up",
        actionConfig: {
          follow_up_type: "reminder",
          priority: "medium",
          assign_to: "owner",
          title_template: "Check proposal status",
        },
        delayHours: 72, // 3 days delay
        isActive: true,
      };

      mockFindByEntityType.mockResolvedValue([mockRule]);

      const engine = new RulesEngine(mockQueueAdd);
      const result = await engine.processEntityEvent(event, entityData);

      // Should not create immediately, but schedule
      expect(result).toHaveLength(0);
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "create_scheduled",
        expect.objectContaining({
          ruleId: "rule-1",
          entityType: "proposal",
          entityId: "proposal-1",
        }),
        expect.objectContaining({
          delay: 72 * 60 * 60 * 1000, // 72 hours in ms
        })
      );
    });
  });
});
