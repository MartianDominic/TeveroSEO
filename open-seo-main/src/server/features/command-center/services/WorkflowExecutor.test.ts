/**
 * WorkflowExecutor Tests
 * Phase 62-03: Engagement Workflow Engine
 *
 * TDD tests for step execution logic.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkflowExecutor } from "./WorkflowExecutor";
import type { WorkflowRepository } from "../repositories/WorkflowRepository";
import type { EngagementService } from "./EngagementService";
import type {
  WorkflowInstanceSelect,
  WorkflowTemplateSelect,
} from "@/db";
import type { Queue } from "bullmq";

// Mock factory functions
const createMockWorkflowRepo = () => ({
  findById: vi.fn(),
  findByEntity: vi.fn(),
  findActiveByWorkspace: vi.fn(),
  findSnoozedDue: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  logEvent: vi.fn(),
  getEvents: vi.fn(),
  getTemplates: vi.fn(),
  getTemplateById: vi.fn(),
  incrementTouchCount: vi.fn(),
});

const createMockEngagementService = () => ({
  canExecuteTouch: vi.fn().mockResolvedValue(true),
  incrementTouchCount: vi.fn(),
  advanceStep: vi.fn(),
  scheduleStepWithDelay: vi.fn(),
  completeWorkflow: vi.fn(),
});

const createMockFollowUpService = () => ({
  create: vi.fn().mockResolvedValue({ id: "followup-001" }),
});

const createMockEmailService = () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, messageId: "msg-001" }),
});

const createMockAlertService = () => ({
  create: vi.fn().mockResolvedValue({ id: "alert-001" }),
  notifyUsers: vi.fn(),
});

const createMockQueue = () => ({
  add: vi.fn().mockResolvedValue({ id: "job-123" }),
});

const createMockInstance = (
  overrides: Partial<WorkflowInstanceSelect> = {}
): WorkflowInstanceSelect => ({
  id: "inst-001",
  workspaceId: "ws-001",
  templateId: "tmpl-001",
  entityType: "proposal",
  entityId: "prop-001",
  status: "active",
  currentStep: 0,
  snoozedUntil: null,
  snoozeReason: null,
  touchesThisWeek: 0,
  lastTouchAt: null,
  lastResponseAt: null,
  completedAt: null,
  outcomeReason: null,
  context: {
    client: { name: "Acme Corp", email: "contact@acme.com" },
    proposal: { id: "prop-001", title: "SEO Services" },
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockTemplate = (
  overrides: Partial<WorkflowTemplateSelect> = {}
): WorkflowTemplateSelect => ({
  id: "tmpl-001",
  workspaceId: "ws-001",
  name: "Test Workflow",
  description: "Test description",
  entityType: "proposal",
  triggerEvent: "proposal_sent",
  maxTouchesPerWeek: 3,
  cooldownHours: 48,
  skipOnResponse: true,
  pauseOnNegativeSignal: true,
  steps: [
    { index: 0, type: "wait", config: { duration: { value: 3, unit: "days" } } },
    {
      index: 1,
      type: "email",
      config: {
        templateId: "followup-1",
        subject: "Following up on {{client.name}}",
        bodyTemplate: "Hi, just checking in about {{proposal.title}}...",
      },
    },
    {
      index: 2,
      type: "task",
      config: {
        title: "Call {{client.name}}",
        description: "Follow up call needed",
        assignTo: "owner",
        dueIn: { value: 1, unit: "days" },
        priority: "high",
      },
    },
    {
      index: 3,
      type: "condition",
      config: {
        field: "proposal.status",
        operator: "equals",
        value: "viewed",
        onTrue: { goto: 5 },
        onFalse: "continue",
      },
    },
    {
      index: 4,
      type: "alert",
      config: {
        severity: "medium",
        title: "Proposal stuck",
        message: "{{client.name}} proposal needs attention",
        notifyUsers: ["owner"],
      },
    },
  ],
  isActive: true,
  isSystem: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("WorkflowExecutor", () => {
  let executor: WorkflowExecutor;
  let mockRepo: ReturnType<typeof createMockWorkflowRepo>;
  let mockEngagement: ReturnType<typeof createMockEngagementService>;
  let mockFollowUp: ReturnType<typeof createMockFollowUpService>;
  let mockEmail: ReturnType<typeof createMockEmailService>;
  let mockAlert: ReturnType<typeof createMockAlertService>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockRepo = createMockWorkflowRepo();
    mockEngagement = createMockEngagementService();
    mockFollowUp = createMockFollowUpService();
    mockEmail = createMockEmailService();
    mockAlert = createMockAlertService();
    mockQueue = createMockQueue();

    executor = new WorkflowExecutor(
      mockRepo as unknown as WorkflowRepository,
      mockEngagement as unknown as EngagementService,
      mockFollowUp as any,
      mockEmail as any,
      mockAlert as any,
      mockQueue as unknown as Queue
    );
  });

  describe("executeStep type='wait'", () => {
    it("calculates delay and schedules next step", async () => {
      const instance = createMockInstance({ currentStep: 0 });
      const template = createMockTemplate();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await executor.executeStep("inst-001");

      expect(result.type).toBe("wait");
      expect(result.scheduled).toBe(true);
      expect(mockEngagement.scheduleStepWithDelay).toHaveBeenCalled();
      // 3 days in milliseconds
      const expectedDelay = 3 * 24 * 60 * 60 * 1000;
      expect(mockEngagement.scheduleStepWithDelay).toHaveBeenCalledWith(
        "inst-001",
        expectedDelay
      );
    });
  });

  describe("executeStep type='email'", () => {
    it("calls emailService.send with interpolated template", async () => {
      const instance = createMockInstance({ currentStep: 1 });
      const template = createMockTemplate();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await executor.executeStep("inst-001");

      expect(result.type).toBe("email");
      expect(mockEmail.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-001",
          // Subject should be interpolated
        })
      );
      expect(mockEngagement.incrementTouchCount).toHaveBeenCalledWith("inst-001");
      expect(mockEngagement.advanceStep).toHaveBeenCalledWith("inst-001");
    });
  });

  describe("executeStep type='task'", () => {
    it("creates follow-up via FollowUpService", async () => {
      const instance = createMockInstance({ currentStep: 2 });
      const template = createMockTemplate();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await executor.executeStep("inst-001");

      expect(result.type).toBe("task");
      expect(mockFollowUp.create).toHaveBeenCalledWith(
        "ws-001",
        expect.any(String), // system user
        expect.objectContaining({
          entityType: "proposal",
          entityId: "prop-001",
          title: "Call Acme Corp", // interpolated
          priority: "high",
        })
      );
      expect(mockEngagement.advanceStep).toHaveBeenCalledWith("inst-001");
    });
  });

  describe("executeStep type='condition'", () => {
    it("evaluates and navigates to correct step on true", async () => {
      const instance = createMockInstance({
        currentStep: 3,
        context: {
          client: { name: "Acme Corp" },
          proposal: { id: "prop-001", status: "viewed" },
        },
      });
      const template = createMockTemplate();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await executor.executeStep("inst-001");

      expect(result.type).toBe("condition");
      expect(result.conditionResult).toBe(true);
      // Should goto step 5 (as defined in onTrue)
      expect(mockRepo.update).toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({ currentStep: 5 })
      );
    });

    it("evaluates and continues on false", async () => {
      const instance = createMockInstance({
        currentStep: 3,
        context: {
          client: { name: "Acme Corp" },
          proposal: { id: "prop-001", status: "sent" }, // not 'viewed'
        },
      });
      const template = createMockTemplate();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await executor.executeStep("inst-001");

      expect(result.type).toBe("condition");
      expect(result.conditionResult).toBe(false);
      // Should continue to next step (4)
      expect(mockEngagement.advanceStep).toHaveBeenCalledWith("inst-001");
    });
  });

  describe("executeStep type='alert'", () => {
    it("creates smart_alert and notifies users", async () => {
      const instance = createMockInstance({ currentStep: 4 });
      const template = createMockTemplate();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await executor.executeStep("inst-001");

      expect(result.type).toBe("alert");
      expect(mockAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-001",
          alertType: "workflow_alert",
          severity: "medium",
          title: "Proposal stuck",
          description: "Acme Corp proposal needs attention", // interpolated
        })
      );
      expect(mockEngagement.advanceStep).toHaveBeenCalledWith("inst-001");
    });
  });

  describe("interpolateTemplate", () => {
    it("replaces {{client.name}} and {{invoice.number}}", () => {
      const template = "Hello {{client.name}}, your invoice #{{invoice.number}} is ready.";
      const context = {
        client: { name: "John Doe" },
        invoice: { number: "INV-001" },
      };

      const result = executor.interpolateTemplate(template, context);

      expect(result).toBe("Hello John Doe, your invoice #INV-001 is ready.");
    });

    it("handles missing variables gracefully", () => {
      const template = "Hello {{client.name}}, order {{order.id}}";
      const context = {
        client: { name: "Jane" },
        // order is missing
      };

      const result = executor.interpolateTemplate(template, context);

      expect(result).toBe("Hello Jane, order {{order.id}}");
    });

    it("handles nested properties", () => {
      const template = "Contact: {{client.contact.email}}";
      const context = {
        client: { contact: { email: "test@example.com" } },
      };

      const result = executor.interpolateTemplate(template, context);

      expect(result).toBe("Contact: test@example.com");
    });
  });
});
