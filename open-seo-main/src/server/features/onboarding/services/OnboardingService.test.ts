/**
 * OnboardingService Tests
 * Phase 48: Contract & Payment - Wave 4
 *
 * Tests onboarding checklist creation from paid contracts.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { OnboardingService } from "./OnboardingService";
import type { ContractSelect } from "@/db/contract-schema";
import type { ProposalSelect } from "@/db/proposal-schema";
import type { OnboardingChecklistSelect } from "@/db/onboarding-schema";

// Mock dependencies
vi.mock("../../contracts/repositories/ContractRepository");
vi.mock("../../contracts/repositories/ChecklistRepository");
vi.mock("../../contracts/repositories/ActivityRepository");
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

const { ContractRepository } = await import(
  "../../contracts/repositories/ContractRepository"
);
const { ChecklistRepository } = await import(
  "../../contracts/repositories/ChecklistRepository"
);
const { ActivityRepository } = await import(
  "../../contracts/repositories/ActivityRepository"
);
const { db } = await import("@/db");

describe("OnboardingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("determineServiceTier", () => {
    it("should return enterprise for setup fee >= 500000 cents", () => {
      expect(OnboardingService.determineServiceTier(500000)).toBe("enterprise");
      expect(OnboardingService.determineServiceTier(600000)).toBe("enterprise");
    });

    it("should return growth for setup fee >= 250000 and < 500000 cents", () => {
      expect(OnboardingService.determineServiceTier(250000)).toBe("growth");
      expect(OnboardingService.determineServiceTier(400000)).toBe("growth");
    });

    it("should return starter for setup fee < 250000 cents", () => {
      expect(OnboardingService.determineServiceTier(100000)).toBe("starter");
      expect(OnboardingService.determineServiceTier(0)).toBe("starter");
    });
  });

  describe("createFromContract", () => {
    const mockContract: ContractSelect = {
      id: "contract-1",
      workspaceId: "workspace-1",
      clientId: "client-1",
      proposalId: "proposal-1",
      status: "executed",
      title: "SEO Services Contract",
      content: { sections: [], terms: "", signatures: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
      dokobitSessionId: null,
      signedAt: null,
      signedPdfUrl: null,
      signerName: null,
      executedAt: new Date(),
      sentAt: null,
      expiresAt: null,
    };

    const mockProposal: ProposalSelect = {
      id: "proposal-1",
      prospectId: "prospect-1",
      workspaceId: "workspace-1",
      template: "standard",
      content: {
        hero: { headline: "", subheadline: "", trafficValue: 0 },
        currentState: {
          traffic: 0,
          keywords: 0,
          value: 0,
          chartData: [],
        },
        opportunities: [],
        roi: {
          projectedTrafficGain: 0,
          trafficValue: 0,
          defaultConversionRate: 0,
          defaultAov: 0,
        },
        investment: { setupFee: 0, monthlyFee: 0, inclusions: [] },
        nextSteps: [],
      },
      brandConfig: null,
      setupFeeCents: 300000,
      monthlyFeeCents: 150000,
      currency: "EUR",
      status: "signed",
      token: "token-1",
      expiresAt: null,
      sentAt: null,
      firstViewedAt: null,
      acceptedAt: null,
      signedAt: null,
      paidAt: null,
      declinedReason: null,
      declinedNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should throw NOT_FOUND if contract not found", async () => {
      vi.mocked(ContractRepository.getContractById).mockResolvedValue(undefined);

      await expect(
        OnboardingService.createFromContract("contract-1", "workspace-1")
      ).rejects.toThrow("Contract not found");
    });

    it("should throw NOT_FOUND if contract belongs to different workspace", async () => {
      vi.mocked(ContractRepository.getContractById).mockResolvedValue({
        ...mockContract,
        workspaceId: "other-workspace",
      });

      await expect(
        OnboardingService.createFromContract("contract-1", "workspace-1")
      ).rejects.toThrow("Contract not found");
    });

    it("should throw CONFLICT if contract is not in executed status", async () => {
      vi.mocked(ContractRepository.getContractById).mockResolvedValue({
        ...mockContract,
        status: "signed",
      });

      await expect(
        OnboardingService.createFromContract("contract-1", "workspace-1")
      ).rejects.toThrow("Payment required first");
    });

    it("should return existing checklist if already exists for client", async () => {
      const existingChecklist: OnboardingChecklistSelect = {
        id: "checklist-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        serviceTier: "growth",
        items: [],
        completedCount: 0,
        totalCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(ContractRepository.getContractById).mockResolvedValue(
        mockContract
      );
      vi.mocked(ChecklistRepository.getChecklistByClient).mockResolvedValue(
        existingChecklist
      );

      const result = await OnboardingService.createFromContract(
        "contract-1",
        "workspace-1"
      );

      expect(result).toEqual(existingChecklist);
      expect(ChecklistRepository.insertChecklist).not.toHaveBeenCalled();
    });

    it("should create checklist with correct service tier from proposal", async () => {
      vi.mocked(ContractRepository.getContractById).mockResolvedValue(
        mockContract
      );
      vi.mocked(ChecklistRepository.getChecklistByClient).mockResolvedValue(
        undefined
      );

      // Mock db select chain for proposal lookup
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockProposal]);
      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValue({ limit: mockLimit });

      const mockChecklist: OnboardingChecklistSelect = {
        id: "checklist-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        serviceTier: "growth",
        items: OnboardingService.CHECKLIST_TEMPLATES.growth.map((item, i) => ({
          ...item,
          id: `item-${i}`,
        })),
        completedCount: 0,
        totalCount: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(ChecklistRepository.insertChecklist).mockResolvedValue(
        mockChecklist
      );
      vi.mocked(ActivityRepository.insertActivity).mockResolvedValue({
        id: "activity-2",
        workspaceId: "workspace-1",
        entityType: "onboarding",
        entityId: "checklist-1",
        activityType: "created",
        activityData: {},
        actorId: null,
        createdAt: new Date(),
      });

      const result = await OnboardingService.createFromContract(
        "contract-1",
        "workspace-1"
      );

      expect(result.serviceTier).toBe("growth");
      expect(result.items.length).toBe(8); // growth tier has 8 items
    });


    it("should log activity for checklist creation", async () => {
      vi.mocked(ContractRepository.getContractById).mockResolvedValue(
        mockContract
      );
      vi.mocked(ChecklistRepository.getChecklistByClient).mockResolvedValue(
        undefined
      );

      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([mockProposal]);
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
      mockFrom.mockReturnValue({ where: mockWhere });
      mockWhere.mockReturnValue({ limit: mockLimit });

      const mockChecklist: OnboardingChecklistSelect = {
        id: "checklist-1",
        workspaceId: "workspace-1",
        clientId: "client-1",
        serviceTier: "growth",
        items: [],
        completedCount: 0,
        totalCount: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(ChecklistRepository.insertChecklist).mockResolvedValue(
        mockChecklist
      );
      vi.mocked(ActivityRepository.insertActivity).mockResolvedValue({
        id: "activity-2",
        workspaceId: "workspace-1",
        entityType: "onboarding",
        entityId: "checklist-1",
        activityType: "created",
        activityData: {},
        actorId: null,
        createdAt: new Date(),
      });

      await OnboardingService.createFromContract("contract-1", "workspace-1");

      expect(ActivityRepository.insertActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace-1",
          entityType: "onboarding",
          entityId: "checklist-1",
          activityType: "created",
        })
      );
    });
  });
});
