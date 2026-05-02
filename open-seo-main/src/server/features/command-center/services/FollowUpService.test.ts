/**
 * FollowUpService tests
 * Phase 62-02: Follow-up system with TDD
 *
 * Tests:
 * - createFollowUp stores follow-up with all required fields
 * - snoozeFollowUp updates status to 'snoozed' and sets snoozed_until
 * - completeFollowUp sets status to 'completed' and completed_at
 * - getUpcoming returns pending follow-ups ordered by scheduled_at
 * - getByEntity returns all follow-ups for a specific entity
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EntityType, FollowUpType, Priority, FollowUpSelect } from "@/db/follow-up-schema";

// Use vi.hoisted() to ensure mock functions are available during module mocking
const { mockCreate, mockFindById, mockUpdate, mockFindOverdue, mockFindDueToday, mockFindUpcoming, mockFindByEntity, mockFindDueForUnsnooze } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindOverdue: vi.fn(),
  mockFindDueToday: vi.fn(),
  mockFindUpcoming: vi.fn(),
  mockFindByEntity: vi.fn(),
  mockFindDueForUnsnooze: vi.fn(),
}));

vi.mock("../repositories/FollowUpRepository", () => ({
  FollowUpRepository: {
    create: mockCreate,
    findById: mockFindById,
    update: mockUpdate,
    findOverdue: mockFindOverdue,
    findDueToday: mockFindDueToday,
    findUpcoming: mockFindUpcoming,
    findByEntity: mockFindByEntity,
    findDueForUnsnooze: mockFindDueForUnsnooze,
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-id-123"),
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock("@/server/lib/errors", () => ({
  AppError: class AppError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Import after mocks
import { FollowUpService } from "./FollowUpService";

describe("FollowUpService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a follow-up with all required fields", async () => {
      const workspaceId = "workspace-1";
      const userId = "user-1";
      const data = {
        entityType: "proposal" as EntityType,
        entityId: "proposal-1",
        followUpType: "reminder" as FollowUpType,
        title: "Follow up on proposal",
        scheduledAt: new Date("2026-05-10T10:00:00Z"),
        priority: "high" as Priority,
      };

      const mockResult: FollowUpSelect = {
        id: "test-id-123",
        workspaceId,
        entityType: data.entityType,
        entityId: data.entityId,
        followUpType: data.followUpType,
        title: data.title,
        description: null,
        scheduledAt: data.scheduledAt,
        snoozedUntil: null,
        completedAt: null,
        status: "pending",
        assignedTo: null,
        createdBy: userId,
        priority: data.priority,
        isAutomated: false,
        ruleId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockResult);

      const result = await FollowUpService.create(workspaceId, userId, data);

      expect(result).toBeDefined();
      expect(result.workspaceId).toBe(workspaceId);
      expect(result.entityType).toBe(data.entityType);
      expect(result.entityId).toBe(data.entityId);
      expect(result.followUpType).toBe(data.followUpType);
      expect(result.title).toBe(data.title);
      expect(result.status).toBe("pending");
      expect(result.priority).toBe(data.priority);
      expect(result.createdBy).toBe(userId);
      expect(result.isAutomated).toBe(false);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          entityType: data.entityType,
          entityId: data.entityId,
          status: "pending",
          isAutomated: false,
        })
      );
    });

    it("should create follow-up with default medium priority", async () => {
      const workspaceId = "workspace-1";
      const userId = "user-1";
      const data = {
        entityType: "prospect" as EntityType,
        entityId: "prospect-1",
        followUpType: "check_in" as FollowUpType,
        title: "Check in with prospect",
        scheduledAt: new Date("2026-05-10T10:00:00Z"),
      };

      const mockResult: FollowUpSelect = {
        id: "test-id-123",
        workspaceId,
        entityType: data.entityType,
        entityId: data.entityId,
        followUpType: data.followUpType,
        title: data.title,
        description: null,
        scheduledAt: data.scheduledAt,
        snoozedUntil: null,
        completedAt: null,
        status: "pending",
        assignedTo: null,
        createdBy: userId,
        priority: "medium",
        isAutomated: false,
        ruleId: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockResult);

      const result = await FollowUpService.create(workspaceId, userId, data);

      expect(result.priority).toBe("medium");
    });
  });

  describe("createAutomated", () => {
    it("should create an automated follow-up from rule", async () => {
      const workspaceId = "workspace-1";
      const ruleId = "rule-1";
      const entityType = "invoice" as EntityType;
      const entityId = "invoice-1";
      const data = {
        followUpType: "reminder" as FollowUpType,
        title: "Payment reminder",
        scheduledAt: new Date("2026-05-15T10:00:00Z"),
        priority: "high" as Priority,
      };

      const mockResult: FollowUpSelect = {
        id: "test-id-123",
        workspaceId,
        entityType,
        entityId,
        followUpType: data.followUpType,
        title: data.title,
        description: null,
        scheduledAt: data.scheduledAt,
        snoozedUntil: null,
        completedAt: null,
        status: "pending",
        assignedTo: null,
        createdBy: "system",
        priority: data.priority,
        isAutomated: true,
        ruleId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreate.mockResolvedValue(mockResult);

      const result = await FollowUpService.createAutomated(
        workspaceId,
        ruleId,
        entityType,
        entityId,
        data
      );

      expect(result).toBeDefined();
      expect(result.isAutomated).toBe(true);
      expect(result.ruleId).toBe(ruleId);
      expect(result.entityType).toBe(entityType);
      expect(result.entityId).toBe(entityId);
    });
  });

  describe("snooze", () => {
    it("should update status to snoozed and set snoozed_until", async () => {
      const followUpId = "followup-1";
      const snoozedUntil = new Date("2026-05-20T10:00:00Z");

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "pending",
      });
      mockUpdate.mockResolvedValue({
        id: followUpId,
        status: "snoozed",
        snoozedUntil,
      });

      await FollowUpService.snooze(followUpId, snoozedUntil);

      expect(mockUpdate).toHaveBeenCalledWith(followUpId, {
        status: "snoozed",
        snoozedUntil,
      });
    });

    it("should throw if follow-up is already completed", async () => {
      const followUpId = "completed-followup";
      const snoozedUntil = new Date("2026-05-20T10:00:00Z");

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "completed",
      });

      await expect(
        FollowUpService.snooze(followUpId, snoozedUntil)
      ).rejects.toThrow("Cannot snooze a completed follow-up");
    });

    it("should throw if follow-up not found", async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        FollowUpService.snooze("non-existent", new Date())
      ).rejects.toThrow("Follow-up not found");
    });
  });

  describe("complete", () => {
    it("should set status to completed and completedAt", async () => {
      const followUpId = "followup-1";

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "pending",
      });
      mockUpdate.mockResolvedValue({
        id: followUpId,
        status: "completed",
      });

      await FollowUpService.complete(followUpId);

      expect(mockUpdate).toHaveBeenCalledWith(
        followUpId,
        expect.objectContaining({
          status: "completed",
          completedAt: expect.any(Date),
        })
      );
    });

    it("should be idempotent if already completed", async () => {
      const followUpId = "followup-1";

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "completed",
      });

      await FollowUpService.complete(followUpId);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("should set status to cancelled", async () => {
      const followUpId = "followup-1";

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "pending",
      });
      mockUpdate.mockResolvedValue({
        id: followUpId,
        status: "cancelled",
      });

      await FollowUpService.cancel(followUpId);

      expect(mockUpdate).toHaveBeenCalledWith(followUpId, {
        status: "cancelled",
      });
    });
  });

  describe("getForDashboard", () => {
    it("should return overdue, dueToday, and upcoming follow-ups", async () => {
      const workspaceId = "workspace-1";

      mockFindOverdue.mockResolvedValue([
        { id: "overdue-1", status: "pending" },
      ]);
      mockFindDueToday.mockResolvedValue([
        { id: "today-1", status: "pending" },
      ]);
      mockFindUpcoming.mockResolvedValue([
        { id: "upcoming-1", status: "pending" },
      ]);

      const result = await FollowUpService.getForDashboard(workspaceId);

      expect(result).toHaveProperty("overdue");
      expect(result).toHaveProperty("dueToday");
      expect(result).toHaveProperty("upcoming");
      expect(Array.isArray(result.overdue)).toBe(true);
      expect(Array.isArray(result.dueToday)).toBe(true);
      expect(Array.isArray(result.upcoming)).toBe(true);
      expect(result.overdue).toHaveLength(1);
      expect(result.dueToday).toHaveLength(1);
      expect(result.upcoming).toHaveLength(1);
    });
  });

  describe("reschedule", () => {
    it("should update scheduledAt to new date", async () => {
      const followUpId = "followup-1";
      const newScheduledAt = new Date("2026-05-25T10:00:00Z");

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "pending",
      });
      mockUpdate.mockResolvedValue({
        id: followUpId,
        scheduledAt: newScheduledAt,
      });

      await FollowUpService.reschedule(followUpId, newScheduledAt);

      expect(mockUpdate).toHaveBeenCalledWith(followUpId, {
        scheduledAt: newScheduledAt,
      });
    });

    it("should clear snooze when rescheduling a snoozed follow-up", async () => {
      const followUpId = "followup-1";
      const newScheduledAt = new Date("2026-05-25T10:00:00Z");

      mockFindById.mockResolvedValue({
        id: followUpId,
        status: "snoozed",
        snoozedUntil: new Date("2026-05-20T10:00:00Z"),
      });
      mockUpdate.mockResolvedValue({
        id: followUpId,
        status: "pending",
        scheduledAt: newScheduledAt,
      });

      await FollowUpService.reschedule(followUpId, newScheduledAt);

      expect(mockUpdate).toHaveBeenCalledWith(followUpId, {
        scheduledAt: newScheduledAt,
        status: "pending",
        snoozedUntil: null,
      });
    });
  });

  describe("getByEntity", () => {
    it("should return all follow-ups for a specific entity", async () => {
      const entityType = "proposal" as EntityType;
      const entityId = "proposal-1";

      mockFindByEntity.mockResolvedValue([
        { id: "f1", entityType, entityId },
        { id: "f2", entityType, entityId },
      ]);

      const result = await FollowUpService.getByEntity(entityType, entityId);

      expect(result).toHaveLength(2);
      expect(mockFindByEntity).toHaveBeenCalledWith(
        entityType,
        entityId
      );
    });
  });
});
