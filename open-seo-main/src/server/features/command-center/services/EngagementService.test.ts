/**
 * EngagementService Tests
 * Phase 62-03: Engagement Workflow Engine
 *
 * TDD tests for workflow lifecycle management.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { EngagementService } from "./EngagementService";
import type { WorkflowRepository } from "../repositories/WorkflowRepository";
import type {
  WorkflowInstanceSelect,
  WorkflowTemplateSelect,
} from "@/db/schema/workflow-instances";
import type { Queue } from "bullmq";

// Mock implementations
const createMockWorkflowRepo = (): jest.Mocked<WorkflowRepository> => ({
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
});

const createMockQueue = () => ({
  add: vi.fn().mockResolvedValue({ id: "job-123" }),
  remove: vi.fn(),
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
  context: {},
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
        subject: "Following up",
        bodyTemplate: "Just checking in...",
      },
    },
  ],
  isActive: true,
  isSystem: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("EngagementService", () => {
  let service: EngagementService;
  let mockRepo: ReturnType<typeof createMockWorkflowRepo>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockRepo = createMockWorkflowRepo();
    mockQueue = createMockQueue();
    service = new EngagementService(
      mockRepo as unknown as WorkflowRepository,
      mockQueue as unknown as Queue
    );
  });

  describe("startWorkflow", () => {
    it("creates instance with status 'active' and current_step 0", async () => {
      const template = createMockTemplate();
      mockRepo.getTemplateById.mockResolvedValue(template);
      mockRepo.findByEntity.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(createMockInstance());

      const result = await service.startWorkflow(
        "ws-001",
        "tmpl-001",
        "proposal",
        "prop-001",
        {}
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-001",
          templateId: "tmpl-001",
          entityType: "proposal",
          entityId: "prop-001",
          status: "active",
          currentStep: 0,
        })
      );
      expect(result.status).toBe("active");
      expect(result.currentStep).toBe(0);
    });

    it("throws if active workflow already exists for entity", async () => {
      const existing = createMockInstance();
      mockRepo.findByEntity.mockResolvedValue(existing);

      await expect(
        service.startWorkflow("ws-001", "tmpl-001", "proposal", "prop-001", {})
      ).rejects.toThrow("Active workflow already exists");
    });
  });

  describe("snoozeWorkflow", () => {
    it("sets status 'snoozed' and snoozed_until date", async () => {
      const instance = createMockInstance();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.update.mockResolvedValue(undefined);

      const snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await service.snoozeWorkflow("inst-001", snoozedUntil, "Client busy");

      expect(mockRepo.update).toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({
          status: "snoozed",
          snoozedUntil,
          snoozeReason: "Client busy",
        })
      );
    });

    it("schedules unsnooze job", async () => {
      const instance = createMockInstance();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.update.mockResolvedValue(undefined);

      const snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await service.snoozeWorkflow("inst-001", snoozedUntil);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "unsnooze",
        expect.objectContaining({ type: "unsnooze", instanceId: "inst-001" }),
        expect.objectContaining({ delay: expect.any(Number) })
      );
    });
  });

  describe("resumeWorkflow", () => {
    it("changes status to 'active' and clears snooze fields", async () => {
      const instance = createMockInstance({
        status: "snoozed",
        snoozedUntil: new Date(),
        snoozeReason: "Was busy",
      });
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(createMockTemplate());
      mockRepo.update.mockResolvedValue(undefined);

      await service.resumeWorkflow("inst-001");

      expect(mockRepo.update).toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({
          status: "active",
          snoozedUntil: null,
          snoozeReason: null,
        })
      );
    });
  });

  describe("completeWorkflow", () => {
    it("sets status to outcome ('won'/'lost'/'completed')", async () => {
      const instance = createMockInstance();
      mockRepo.findById.mockResolvedValue(instance);
      mockRepo.update.mockResolvedValue(undefined);

      await service.completeWorkflow("inst-001", "won", "Client signed");

      expect(mockRepo.update).toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({
          status: "won",
          outcomeReason: "Client signed",
          completedAt: expect.any(Date),
        })
      );
    });
  });

  describe("handleResponseDetected", () => {
    it("pauses workflow when skipOnResponse=true", async () => {
      const instance = createMockInstance();
      const template = createMockTemplate({ skipOnResponse: true });
      mockRepo.findByEntity.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(undefined);

      await service.handleResponseDetected("proposal", "prop-001", "email_reply");

      expect(mockRepo.update).toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({
          status: "paused",
          lastResponseAt: expect.any(Date),
        })
      );
    });

    it("updates lastResponseAt but continues when skipOnResponse=false", async () => {
      const instance = createMockInstance();
      const template = createMockTemplate({ skipOnResponse: false });
      mockRepo.findByEntity.mockResolvedValue(instance);
      mockRepo.getTemplateById.mockResolvedValue(template);
      mockRepo.update.mockResolvedValue(undefined);

      await service.handleResponseDetected("proposal", "prop-001", "email_reply");

      expect(mockRepo.update).toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({
          lastResponseAt: expect.any(Date),
        })
      );
      // Status should NOT be paused
      expect(mockRepo.update).not.toHaveBeenCalledWith(
        "inst-001",
        expect.objectContaining({ status: "paused" })
      );
    });
  });

  describe("canExecuteTouch", () => {
    it("returns false when touches_this_week >= maxTouchesPerWeek", async () => {
      const instance = createMockInstance({ touchesThisWeek: 3 });
      const template = createMockTemplate({ maxTouchesPerWeek: 3 });
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await service.canExecuteTouch(instance);

      expect(result).toBe(false);
    });

    it("returns false when within cooldown period", async () => {
      const instance = createMockInstance({
        touchesThisWeek: 1,
        lastTouchAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      });
      const template = createMockTemplate({ cooldownHours: 48 });
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await service.canExecuteTouch(instance);

      expect(result).toBe(false);
    });

    it("returns true when under limits and past cooldown", async () => {
      const instance = createMockInstance({
        touchesThisWeek: 1,
        lastTouchAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 72 hours ago
      });
      const template = createMockTemplate({
        maxTouchesPerWeek: 3,
        cooldownHours: 48,
      });
      mockRepo.getTemplateById.mockResolvedValue(template);

      const result = await service.canExecuteTouch(instance);

      expect(result).toBe(true);
    });
  });
});
