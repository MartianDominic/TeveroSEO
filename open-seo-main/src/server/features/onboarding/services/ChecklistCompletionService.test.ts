/**
 * ChecklistCompletionService tests
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Tests event-driven checklist item completion and manual completion.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleAutoCompleteEvent,
  completeItemManually,
} from "./ChecklistCompletionService";

// Mock the repositories
vi.mock("../../contracts/repositories/ChecklistRepository", () => ({
  ChecklistRepository: {
    getChecklistByClient: vi.fn(),
    completeChecklistItem: vi.fn(),
  },
}));

vi.mock("../../contracts/repositories/ActivityRepository", () => ({
  ActivityRepository: {
    insertActivity: vi.fn(),
  },
}));

import { ChecklistRepository } from "../../contracts/repositories/ChecklistRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";

const mockGetChecklistByClient = vi.mocked(ChecklistRepository.getChecklistByClient);
const mockCompleteChecklistItem = vi.mocked(ChecklistRepository.completeChecklistItem);
const mockInsertActivity = vi.mocked(ActivityRepository.insertActivity);

describe("ChecklistCompletionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleAutoCompleteEvent", () => {
    it("completes item with matching autoCompleteEvent", async () => {
      const mockChecklist = {
        id: "checklist-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        serviceTier: "growth",
        items: [
          { id: "item-1", label: "Connect GSC", category: "credentials", autoCompleteEvent: "gsc_connected" },
          { id: "item-2", label: "Connect GA", category: "credentials", autoCompleteEvent: "ga_connected" },
        ],
        completedCount: 0,
        totalCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetChecklistByClient.mockResolvedValue(mockChecklist);
      mockCompleteChecklistItem.mockResolvedValue({
        ...mockChecklist,
        items: [
          { ...mockChecklist.items[0], completedAt: new Date().toISOString(), completedBy: "system" },
          mockChecklist.items[1],
        ],
        completedCount: 1,
      });
      mockInsertActivity.mockResolvedValue({
        id: "activity-1",
        workspaceId: "ws-1",
        entityType: "onboarding",
        entityId: "checklist-1",
        activityType: "item_completed",
        activityData: {},
        actorId: null,
        createdAt: new Date(),
      });

      await handleAutoCompleteEvent("ws-1", "client-1", "gsc_connected");

      expect(mockGetChecklistByClient).toHaveBeenCalledWith("client-1");
      expect(mockCompleteChecklistItem).toHaveBeenCalledWith("checklist-1", "item-1", "system");
      expect(mockInsertActivity).toHaveBeenCalledWith(expect.objectContaining({
        workspaceId: "ws-1",
        entityType: "onboarding",
        entityId: "checklist-1",
        activityType: "item_completed",
        activityData: expect.objectContaining({
          itemId: "item-1",
          event: "gsc_connected",
          automatic: true,
        }),
      }));
    });

    it("is idempotent - already completed item does not error or duplicate activity", async () => {
      const mockChecklist = {
        id: "checklist-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        serviceTier: "growth",
        items: [
          { id: "item-1", label: "Connect GSC", category: "credentials", autoCompleteEvent: "gsc_connected", completedAt: "2026-01-01T00:00:00Z", completedBy: "system" },
        ],
        completedCount: 1,
        totalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetChecklistByClient.mockResolvedValue(mockChecklist);

      // Should not throw
      await expect(handleAutoCompleteEvent("ws-1", "client-1", "gsc_connected")).resolves.not.toThrow();

      // Should not call complete or activity since item already completed
      expect(mockCompleteChecklistItem).not.toHaveBeenCalled();
      expect(mockInsertActivity).not.toHaveBeenCalled();
    });

    it("returns early without error for non-existent event", async () => {
      const mockChecklist = {
        id: "checklist-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        serviceTier: "starter",
        items: [
          { id: "item-1", label: "Connect GSC", category: "credentials", autoCompleteEvent: "gsc_connected" },
        ],
        completedCount: 0,
        totalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetChecklistByClient.mockResolvedValue(mockChecklist);

      // Event that doesn't match any item
      await expect(handleAutoCompleteEvent("ws-1", "client-1", "ga_connected")).resolves.not.toThrow();

      expect(mockCompleteChecklistItem).not.toHaveBeenCalled();
      expect(mockInsertActivity).not.toHaveBeenCalled();
    });

    it("returns early when no checklist exists for client", async () => {
      mockGetChecklistByClient.mockResolvedValue(undefined);

      await expect(handleAutoCompleteEvent("ws-1", "client-1", "gsc_connected")).resolves.not.toThrow();

      expect(mockCompleteChecklistItem).not.toHaveBeenCalled();
      expect(mockInsertActivity).not.toHaveBeenCalled();
    });

    it("logs activity with entityType onboarding and activityType item_completed", async () => {
      const mockChecklist = {
        id: "checklist-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        serviceTier: "enterprise",
        items: [
          { id: "item-1", label: "Connect GBP", category: "credentials", autoCompleteEvent: "gbp_connected" },
        ],
        completedCount: 0,
        totalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetChecklistByClient.mockResolvedValue(mockChecklist);
      mockCompleteChecklistItem.mockResolvedValue({
        ...mockChecklist,
        completedCount: 1,
      });
      mockInsertActivity.mockResolvedValue({
        id: "activity-1",
        workspaceId: "ws-1",
        entityType: "onboarding",
        entityId: "checklist-1",
        activityType: "item_completed",
        activityData: {},
        actorId: null,
        createdAt: new Date(),
      });

      await handleAutoCompleteEvent("ws-1", "client-1", "gbp_connected");

      expect(mockInsertActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "onboarding",
          activityType: "item_completed",
        })
      );
    });
  });

  describe("completeItemManually", () => {
    it("completes item regardless of autoCompleteEvent field", async () => {
      const mockChecklist = {
        id: "checklist-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        serviceTier: "growth",
        items: [
          { id: "item-1", label: "Schedule kickoff", category: "kickoff" }, // No autoCompleteEvent
        ],
        completedCount: 0,
        totalCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedChecklist = {
        ...mockChecklist,
        items: [
          { ...mockChecklist.items[0], completedAt: new Date().toISOString(), completedBy: "user-123" },
        ],
        completedCount: 1,
      };

      mockCompleteChecklistItem.mockResolvedValue(updatedChecklist);

      const result = await completeItemManually("checklist-1", "item-1", "user-123");

      expect(mockCompleteChecklistItem).toHaveBeenCalledWith("checklist-1", "item-1", "user-123");
      expect(result).toEqual(updatedChecklist);
    });

    it("returns undefined for invalid itemId", async () => {
      mockCompleteChecklistItem.mockResolvedValue(undefined);

      const result = await completeItemManually("checklist-1", "invalid-item", "user-123");

      expect(result).toBeUndefined();
    });
  });
});
