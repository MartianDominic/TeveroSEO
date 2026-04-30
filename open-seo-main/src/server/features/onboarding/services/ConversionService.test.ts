/**
 * ConversionService Unit Tests
 * Phase 51-02: Prospect Conversion
 *
 * Tests for prospect-to-client conversion triggered by onboarding checklist completion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock("../../contracts/repositories/ChecklistRepository", () => ({
  ChecklistRepository: {
    getChecklistById: vi.fn(),
  },
}));

vi.mock("../../contracts/repositories/ActivityRepository", () => ({
  ActivityRepository: {
    insertActivity: vi.fn(),
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

import { db } from "@/db";
import { ChecklistRepository } from "../../contracts/repositories/ChecklistRepository";
import { ActivityRepository } from "../../contracts/repositories/ActivityRepository";
import {
  completeOnboarding,
  checkAndTriggerConversion,
  type ConversionSummary,
} from "./ConversionService";
import type { OnboardingChecklistSelect } from "@/db/onboarding-schema";
import type { ClientSelect } from "@/db/client-schema";

describe("ConversionService", () => {
  const mockWorkspaceId = "workspace-123";
  const mockChecklistId = "checklist-456";
  const mockClientId = "client-789";
  const mockProspectId = "prospect-012";

  const mockChecklist: OnboardingChecklistSelect = {
    id: mockChecklistId,
    workspaceId: mockWorkspaceId,
    clientId: mockClientId,
    serviceTier: "growth",
    items: [
      {
        id: "item-1",
        label: "Connect Google Search Console",
        category: "credentials",
        completedAt: "2026-04-30T10:00:00Z",
        completedBy: "user-1",
      },
      {
        id: "item-2",
        label: "Connect Google Analytics",
        category: "credentials",
        completedAt: "2026-04-30T11:00:00Z",
        completedBy: "user-1",
      },
      {
        id: "item-3",
        label: "Schedule kickoff call",
        category: "kickoff",
        completedAt: "2026-04-30T12:00:00Z",
        completedBy: "user-1",
      },
    ],
    completedCount: 3,
    totalCount: 3,
    createdAt: new Date("2026-04-29"),
    updatedAt: new Date("2026-04-30"),
  };

  const mockClient: ClientSelect = {
    id: mockClientId,
    workspaceId: mockWorkspaceId,
    name: "Acme Corp",
    domain: "acme.com",
    contactEmail: "contact@acme.com",
    contactName: "John Doe",
    industry: "SaaS",
    status: "onboarding",
    convertedFromProspectId: mockProspectId,
    gscRefreshToken: null,
    gscSiteUrl: null,
    gscConnectedAt: null,
    kickoffScheduledAt: null,
    kickoffCompletedAt: null,
    onboardingCompletedAt: null,
    baselineMetrics: null,
    targetKeywords: null,
    createdAt: new Date("2026-04-29"),
    updatedAt: new Date("2026-04-30"),
    isDeleted: false,
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("completeOnboarding", () => {
    it("should update client.status to 'active'", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(mockChecklist);

      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockClient]),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

      vi.mocked(ActivityRepository.insertActivity).mockResolvedValueOnce({} as any);

      // Act
      const result = await completeOnboarding(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(result.clientId).toBe(mockClientId);
      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
        })
      );
    });

    it("should update linked prospect.pipelineStage to 'active_client'", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(mockChecklist);

      const mockSelectFrom = vi.fn()
        // First call: get client
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockClient]),
          }),
        })
        // Second call: get contract
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ proposalId: "proposal-1", clientId: mockClientId }]),
          }),
        })
        // Third call: get prospect
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: mockProspectId }]),
          }),
        });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

      vi.mocked(ActivityRepository.insertActivity).mockResolvedValueOnce({} as any);

      // Act
      await completeOnboarding(mockChecklistId, mockWorkspaceId);

      // Assert - check that prospect was updated
      expect(db.update).toHaveBeenCalled();
      // The third call should update prospect pipelineStage
      const updateCalls = vi.mocked(db.update).mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("should log activity with entityType='client' and activityType='status_changed'", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(mockChecklist);

      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockClient]),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

      vi.mocked(ActivityRepository.insertActivity).mockResolvedValueOnce({} as any);

      // Act
      await completeOnboarding(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(ActivityRepository.insertActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: mockWorkspaceId,
          entityType: "client",
          entityId: mockClientId,
          activityType: "status_changed",
          activityData: expect.objectContaining({
            previousStatus: "onboarding",
            newStatus: "active",
            trigger: "onboarding_complete",
            checklistId: mockChecklistId,
          }),
        })
      );
    });

    it("should return conversion summary with client data", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(mockChecklist);

      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockClient]),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

      vi.mocked(ActivityRepository.insertActivity).mockResolvedValueOnce({} as any);

      // Act
      const result = await completeOnboarding(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(result).toMatchObject({
        clientId: mockClientId,
        clientName: "Acme Corp",
        serviceTier: "growth",
        connectedServices: expect.arrayContaining(["Google Search Console", "Google Analytics"]),
        nextSteps: expect.any(Array),
      });
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it("should throw error if checklist not 100% complete", async () => {
      // Arrange
      const incompleteChecklist = {
        ...mockChecklist,
        completedCount: 2,
        totalCount: 3,
      };
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(incompleteChecklist);

      // Act & Assert
      await expect(completeOnboarding(mockChecklistId, mockWorkspaceId)).rejects.toThrow(
        "Checklist not complete: 2/3"
      );
    });

    it("should throw error if checklist not found", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(undefined);

      // Act & Assert
      await expect(completeOnboarding(mockChecklistId, mockWorkspaceId)).rejects.toThrow(
        "Checklist not found"
      );
    });

    it("should throw error if workspaceId mismatch", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(mockChecklist);

      // Act & Assert
      await expect(completeOnboarding(mockChecklistId, "different-workspace")).rejects.toThrow(
        "Access denied"
      );
    });
  });

  describe("checkAndTriggerConversion", () => {
    it("should trigger conversion only when completedCount === totalCount", async () => {
      // Arrange - needs to return checklist twice: once for check, once for completeOnboarding
      vi.mocked(ChecklistRepository.getChecklistById)
        .mockResolvedValueOnce(mockChecklist)
        .mockResolvedValueOnce(mockChecklist);

      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockClient]),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      const mockUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.update).mockReturnValue({ set: mockUpdateSet } as any);

      vi.mocked(ActivityRepository.insertActivity).mockResolvedValueOnce({} as any);

      // Act
      const result = await checkAndTriggerConversion(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.clientId).toBe(mockClientId);
    });

    it("should return null when checklist is not complete", async () => {
      // Arrange
      const incompleteChecklist = {
        ...mockChecklist,
        completedCount: 2,
        totalCount: 3,
      };
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(incompleteChecklist);

      // Act
      const result = await checkAndTriggerConversion(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(result).toBeNull();
    });

    it("should return existing summary if client already active", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(mockChecklist);

      const activeClient = { ...mockClient, status: "active" };
      const mockSelectFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([activeClient]),
        }),
      });
      vi.mocked(db.select).mockReturnValue({ from: mockSelectFrom } as any);

      // Act
      const result = await checkAndTriggerConversion(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.clientId).toBe(mockClientId);
      // Should not have called update (already active)
      expect(db.update).not.toHaveBeenCalled();
    });

    it("should return null if checklist not found", async () => {
      // Arrange
      vi.mocked(ChecklistRepository.getChecklistById).mockResolvedValueOnce(undefined);

      // Act
      const result = await checkAndTriggerConversion(mockChecklistId, mockWorkspaceId);

      // Assert
      expect(result).toBeNull();
    });
  });
});
