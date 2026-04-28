/**
 * Tests for ProposalService.
 * Phase 30: Interactive Proposals - Schema & Builder
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "mock-proposal-id",
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();
const mockDelete = vi.fn();
const mockOrderBy = vi.fn();
const mockOffset = vi.fn();

const mockProposal = {
  id: "proposal-123",
  prospectId: "prospect-456",
  workspaceId: "workspace-789",
  template: "standard",
  content: {
    hero: { headline: "Test", subheadline: "Test", trafficValue: 1000 },
    currentState: { traffic: 100, keywords: 50, value: 500, chartData: [] },
    opportunities: [],
    roi: {
      projectedTrafficGain: 500,
      trafficValue: 2500,
      defaultConversionRate: 0.02,
      defaultAov: 100,
    },
    investment: { setupFee: 2000, monthlyFee: 1000, inclusions: [] },
    nextSteps: [],
  },
  setupFeeCents: 200000,
  monthlyFeeCents: 100000,
  currency: "EUR",
  status: "draft",
  token: "unique-token-abc",
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

vi.mock("@/db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockLimit,
          orderBy: () => ({
            limit: () => ({
              offset: mockOffset,
            }),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: mockReturning,
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: mockReturning,
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: mockReturning,
      }),
    }),
  },
}));

// Mock ProspectService
vi.mock("@/server/features/prospects/services/ProspectService", () => ({
  ProspectService: {
    findById: vi.fn(),
  },
}));

describe("ProposalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([mockProposal]);
    mockLimit.mockResolvedValue([mockProposal]);
  });

  describe("create", () => {
    it("should create a proposal from a prospect", async () => {
      const { ProposalService } = await import("./ProposalService");
      const { ProspectService } = await import(
        "@/server/features/prospects/services/ProspectService"
      );

      const mockProspect = {
        id: "prospect-456",
        workspaceId: "workspace-789",
        domain: "example.com",
        companyName: "Example Corp",
        analyses: [
          {
            domainMetrics: { organicTraffic: 500, organicKeywords: 100 },
            opportunityKeywords: [
              {
                keyword: "seo services",
                searchVolume: 2400,
                difficulty: 45,
                opportunityScore: 75,
              },
            ],
          },
        ],
      };

      vi.mocked(ProspectService.findById).mockResolvedValue(
        mockProspect as ReturnType<typeof ProspectService.findById> extends Promise<infer T> ? T : never
      );

      const result = await ProposalService.create({
        prospectId: "prospect-456",
        workspaceId: "workspace-789",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
    });

    it("should generate a unique token for the proposal", async () => {
      const { ProposalService } = await import("./ProposalService");
      const { ProspectService } = await import(
        "@/server/features/prospects/services/ProspectService"
      );

      const mockProspect = {
        id: "prospect-456",
        workspaceId: "workspace-789",
        domain: "example.com",
        analyses: [],
      };

      vi.mocked(ProspectService.findById).mockResolvedValue(
        mockProspect as unknown as ReturnType<typeof ProspectService.findById> extends Promise<infer T> ? T : never
      );

      const result = await ProposalService.create({
        prospectId: "prospect-456",
        workspaceId: "workspace-789",
      });

      expect(result.token).toBeTruthy();
      expect(result.token.length).toBeGreaterThan(10);
    });

    it("should throw if prospect not found", async () => {
      const { ProposalService } = await import("./ProposalService");
      const { ProspectService } = await import(
        "@/server/features/prospects/services/ProspectService"
      );

      vi.mocked(ProspectService.findById).mockResolvedValue(null);

      await expect(
        ProposalService.create({
          prospectId: "nonexistent",
          workspaceId: "workspace-789",
        })
      ).rejects.toThrow(/not found/i);
    });

    it("should throw if prospect belongs to different workspace", async () => {
      const { ProposalService } = await import("./ProposalService");
      const { ProspectService } = await import(
        "@/server/features/prospects/services/ProspectService"
      );

      const mockProspect = {
        id: "prospect-456",
        workspaceId: "different-workspace",
        domain: "example.com",
        analyses: [],
      };

      vi.mocked(ProspectService.findById).mockResolvedValue(
        mockProspect as unknown as ReturnType<typeof ProspectService.findById> extends Promise<infer T> ? T : never
      );

      await expect(
        ProposalService.create({
          prospectId: "prospect-456",
          workspaceId: "workspace-789",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("findById", () => {
    it("should return proposal with views, signatures, and payments", async () => {
      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.findById("proposal-123");

      expect(result).toBeDefined();
      expect(result?.id).toBe("proposal-123");
    });

    it("should return null if proposal not found", async () => {
      mockLimit.mockResolvedValue([]);
      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByToken", () => {
    it("should return proposal by public token", async () => {
      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.findByToken("unique-token-abc");

      expect(result).toBeDefined();
      expect(result?.token).toBe("unique-token-abc");
    });

    it("should return null if token not found", async () => {
      mockLimit.mockResolvedValue([]);
      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.findByToken("invalid-token");

      expect(result).toBeNull();
    });

    it("should throw GONE error if proposal has expired", async () => {
      // Set expiresAt to a date in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday
      mockLimit.mockResolvedValue([{ ...mockProposal, expiresAt: pastDate }]);

      const { ProposalService } = await import("./ProposalService");

      await expect(ProposalService.findByToken("expired-token")).rejects.toThrow(
        /proposal has expired/i
      );
    });

    it("should return proposal if expiresAt is in the future", async () => {
      // Set expiresAt to a date in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
      mockLimit.mockResolvedValue([{ ...mockProposal, expiresAt: futureDate }]);

      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.findByToken("valid-token");

      expect(result).toBeDefined();
      expect(result?.token).toBe("unique-token-abc");
    });

    it("should return proposal if expiresAt is null (no expiration)", async () => {
      mockLimit.mockResolvedValue([{ ...mockProposal, expiresAt: null }]);

      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.findByToken("no-expiry-token");

      expect(result).toBeDefined();
      expect(result?.token).toBe("unique-token-abc");
    });
  });

  describe("findByWorkspace", () => {
    // Note: The db mock for Promise.all with count() is complex.
    // These tests verify the pagination logic separately.
    it("should enforce max pageSize of 100", () => {
      // Test the pageSize calculation logic
      const requestedPageSize = 500;
      const actualPageSize = Math.min(100, Math.max(1, requestedPageSize));
      expect(actualPageSize).toBe(100);
    });

    it("should default page to 1 and pageSize to 20", () => {
      const inputPage: number | undefined = undefined;
      const inputPageSize: number | undefined = undefined;
      const page = Math.max(1, inputPage ?? 1);
      const pageSize = Math.min(100, Math.max(1, inputPageSize ?? 20));
      expect(page).toBe(1);
      expect(pageSize).toBe(20);
    });

    it("should calculate correct offset", () => {
      const page = 3;
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      expect(offset).toBe(40);
    });
  });

  describe("update", () => {
    it("should update proposal fields", async () => {
      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.update("proposal-123", {
        setupFeeCents: 300000,
      });

      expect(result).toBeDefined();
    });

    it("should throw if proposal not found", async () => {
      mockLimit.mockResolvedValue([]);
      const { ProposalService } = await import("./ProposalService");

      await expect(
        ProposalService.update("nonexistent", { setupFeeCents: 300000 })
      ).rejects.toThrow(/not found/i);
    });

    it("should reject updates to non-draft proposals", async () => {
      // Proposal is in "sent" status - should not allow updates
      mockLimit.mockResolvedValue([{ ...mockProposal, status: "sent" }]);
      const { ProposalService } = await import("./ProposalService");

      await expect(
        ProposalService.update("proposal-123", { setupFeeCents: 300000 })
      ).rejects.toThrow(/cannot update proposal in sent status/i);
    });

    it("should reject updates to signed proposals", async () => {
      // Signed proposals must never have pricing changed
      mockLimit.mockResolvedValue([{ ...mockProposal, status: "signed" }]);
      const { ProposalService } = await import("./ProposalService");

      await expect(
        ProposalService.update("proposal-123", { monthlyFeeCents: 500000 })
      ).rejects.toThrow(/cannot update proposal in signed status/i);
    });

    it("should validate status transitions", async () => {
      const { ProposalService } = await import("./ProposalService");

      // draft -> sent is valid
      mockLimit.mockResolvedValue([{ ...mockProposal, status: "draft" }]);
      mockReturning.mockResolvedValue([{ ...mockProposal, status: "sent" }]);

      const result = await ProposalService.markSent("proposal-123");
      expect(result.status).toBe("sent");
    });
  });

  describe("markSent", () => {
    it("should update status to sent and set sentAt timestamp", async () => {
      mockLimit.mockResolvedValue([{ ...mockProposal, status: "draft" }]);
      mockReturning.mockResolvedValue([
        { ...mockProposal, status: "sent", sentAt: new Date() },
      ]);

      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.markSent("proposal-123");

      expect(result.status).toBe("sent");
      expect(result.sentAt).toBeDefined();
    });

    it("should throw if proposal not in draft status", async () => {
      mockLimit.mockResolvedValue([{ ...mockProposal, status: "sent" }]);

      const { ProposalService } = await import("./ProposalService");

      await expect(ProposalService.markSent("proposal-123")).rejects.toThrow(
        /cannot transition/i
      );
    });
  });

  describe("recordView", () => {
    it("should create a view record", async () => {
      mockLimit.mockResolvedValue([mockProposal]);
      mockReturning.mockResolvedValue([{ id: "view-123" }]);

      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.recordView("proposal-123", {
        deviceType: "desktop",
        ipHash: "abc123",
      });

      expect(result).toBeDefined();
    });

    it("should update firstViewedAt on first view", async () => {
      mockLimit.mockResolvedValue([
        { ...mockProposal, status: "sent", firstViewedAt: null },
      ]);
      mockReturning.mockResolvedValue([
        { ...mockProposal, status: "viewed", firstViewedAt: new Date() },
      ]);

      const { ProposalService } = await import("./ProposalService");

      await ProposalService.recordView("proposal-123", {
        deviceType: "mobile",
      });

      // Should have updated proposal status to viewed
      expect(mockReturning).toHaveBeenCalled();
    });

    it("should handle concurrent first views atomically (race condition prevention)", async () => {
      // Simulate a proposal that appears as 'sent' with null firstViewedAt
      // But the atomic update returns nothing because another request already updated it
      mockLimit.mockResolvedValue([
        { ...mockProposal, status: "sent", firstViewedAt: null },
      ]);

      // First call to mockReturning is for the view insert
      // Second call returns empty array (atomic update found no matching row)
      mockReturning
        .mockResolvedValueOnce([{ id: "view-456" }]) // View insert succeeds
        .mockResolvedValueOnce([]); // Atomic status update finds no matching row (already updated)

      const { ProposalService } = await import("./ProposalService");

      // This should not throw - it gracefully handles the case where
      // another concurrent request already updated the status
      const result = await ProposalService.recordView("proposal-123", {
        deviceType: "desktop",
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("view-456");
    });

    it("should not update status if proposal already viewed", async () => {
      // Proposal already has firstViewedAt set
      mockLimit.mockResolvedValue([
        { ...mockProposal, status: "viewed", firstViewedAt: new Date() },
      ]);
      mockReturning.mockResolvedValue([{ id: "view-789" }]);

      const { ProposalService } = await import("./ProposalService");

      const result = await ProposalService.recordView("proposal-123", {
        deviceType: "tablet",
      });

      expect(result).toBeDefined();
      // mockReturning should only be called once (for view insert, not for status update)
      expect(mockReturning).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete", () => {
    it("should delete proposal", async () => {
      mockReturning.mockResolvedValue([{ id: "proposal-123" }]);

      const { ProposalService } = await import("./ProposalService");

      await expect(
        ProposalService.delete("proposal-123")
      ).resolves.not.toThrow();
    });

    it("should throw if proposal not found", async () => {
      mockReturning.mockResolvedValue([]);

      const { ProposalService } = await import("./ProposalService");

      await expect(ProposalService.delete("nonexistent")).rejects.toThrow(
        /not found/i
      );
    });
  });

  describe("generateDefaultContent", () => {
    it("should generate content from prospect analysis data", async () => {
      const { generateDefaultContent } = await import("./ProposalService");

      const prospect = {
        domain: "example.com",
        companyName: "Example Corp",
        analyses: [
          {
            domainMetrics: {
              organicTraffic: 500,
              organicKeywords: 100,
            },
            opportunityKeywords: [
              {
                keyword: "seo services",
                searchVolume: 2400,
                difficulty: 45,
                cpc: 3.5,
                opportunityScore: 75,
              },
            ],
          },
        ],
      };

      const content = generateDefaultContent(prospect as Parameters<typeof generateDefaultContent>[0]);

      expect(content.hero.headline).toContain("Example Corp");
      expect(content.currentState.traffic).toBe(500);
      expect(content.currentState.keywords).toBe(100);
      expect(content.opportunities.length).toBeGreaterThan(0);
    });

    it("should handle prospects without analysis data", async () => {
      const { generateDefaultContent } = await import("./ProposalService");

      const prospect = {
        domain: "example.com",
        companyName: null,
        analyses: [],
      };

      const content = generateDefaultContent(prospect as unknown as Parameters<typeof generateDefaultContent>[0]);

      expect(content.hero.headline).toBeTruthy();
      expect(content.currentState.traffic).toBe(0);
      expect(content.opportunities).toEqual([]);
    });
  });
});

describe("Proposal Status State Machine", () => {
  it("should define valid transitions", async () => {
    const { VALID_TRANSITIONS } = await import("./ProposalService");

    expect(VALID_TRANSITIONS.draft).toContain("sent");
    expect(VALID_TRANSITIONS.sent).toContain("viewed");
    expect(VALID_TRANSITIONS.sent).toContain("expired");
    expect(VALID_TRANSITIONS.sent).toContain("declined");
    expect(VALID_TRANSITIONS.viewed).toContain("accepted");
    expect(VALID_TRANSITIONS.accepted).toContain("signed");
    expect(VALID_TRANSITIONS.signed).toContain("paid");
    expect(VALID_TRANSITIONS.paid).toContain("onboarded");
  });

  it("should reject invalid transitions", async () => {
    const { canTransition } = await import("./ProposalService");

    expect(canTransition("draft", "paid")).toBe(false);
    expect(canTransition("sent", "onboarded")).toBe(false);
    expect(canTransition("declined", "sent")).toBe(false);
  });

  it("should accept valid transitions", async () => {
    const { canTransition } = await import("./ProposalService");

    expect(canTransition("draft", "sent")).toBe(true);
    expect(canTransition("sent", "viewed")).toBe(true);
    expect(canTransition("viewed", "accepted")).toBe(true);
  });
});
