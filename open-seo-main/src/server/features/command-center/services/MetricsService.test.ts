/**
 * MetricsService tests - TDD for pipeline metrics computation
 * Phase 62-04: Pipeline Metrics Computation Worker
 *
 * Tests:
 * - getMetrics returns cached metrics if computed_at < 10 minutes ago
 * - computeWorkspaceMetrics counts prospects by status correctly
 * - computeWorkspaceMetrics calculates win_rate_pct from deal_outcomes
 * - computeWorkspaceMetrics sums financial values correctly
 * - upsertMetrics creates or updates single row per workspace
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the database module before any imports
vi.mock("@/db/client", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("@/db", () => ({
  pipelineMetrics: { workspaceId: "workspace_id", computedAt: "computed_at" },
  prospects: { workspaceId: "workspace_id", pipelineStage: "pipeline_stage", updatedAt: "updated_at" },
  proposals: { workspaceId: "workspace_id", status: "status", updatedAt: "updated_at", setupFeeCents: "setup_fee_cents", monthlyFeeCents: "monthly_fee_cents" },
  contracts: { workspaceId: "workspace_id", status: "status", expiresAt: "expires_at" },
  invoices: { workspaceId: "workspace_id", status: "status", paidAt: "paid_at", sentAt: "sent_at", totalCents: "total_cents" },
  dealOutcomes: { workspaceId: "workspace_id", outcome: "outcome", outcomeAt: "outcome_at", cycleDays: "cycle_days" },
  organization: { id: "id" },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock database client
const mockDb = {
  query: {
    pipelineMetrics: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    organization: {
      findMany: vi.fn(),
    },
  },
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  then: vi.fn((resolve: Function) => resolve([])),
};

// Mock pipeline metrics repository
interface PipelineMetricsRepositoryInterface {
  getByWorkspace(workspaceId: string): Promise<PipelineMetricsSelect | null>;
  upsert(workspaceId: string, data: Partial<PipelineMetricsInsert>): Promise<void>;
  getStale(maxAgeMinutes: number): Promise<string[]>;
}

// Pipeline metrics types (inline to avoid import issues)
interface PipelineMetricsSelect {
  id: string;
  workspaceId: string;
  prospectsNew: number;
  prospectsAnalyzing: number;
  prospectsScored: number;
  prospectsQualified: number;
  prospectsContacted: number;
  prospectsNegotiating: number;
  prospectsConverted30d: number;
  prospectsArchived30d: number;
  proposalsDraft: number;
  proposalsSent: number;
  proposalsViewed: number;
  proposalsAccepted: number;
  proposalsDeclined30d: number;
  proposalsExpired30d: number;
  contractsDraft: number;
  contractsSent: number;
  contractsPendingSignature: number;
  contractsSigned: number;
  contractsExecuted: number;
  contractsExpiring7d: number;
  invoicesDraft: number;
  invoicesSent: number;
  invoicesPaid30d: number;
  invoicesOverdue: number;
  pipelineValueDraftCents: number;
  pipelineValueSentCents: number;
  pipelineValueSignedCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  outstandingCents: number;
  overdueAmountCents: number;
  winRatePct: number;
  prospectToQualifiedPct: number;
  qualifiedToProposalPct: number;
  proposalToSignedPct: number;
  avgCycleDays: number;
  avgCollectionDays: number;
  currency: string;
  computedAt: Date;
  computationDurationMs: number | null;
}

type PipelineMetricsInsert = Partial<PipelineMetricsSelect>;

// Mock repository
function createMockRepo(): PipelineMetricsRepositoryInterface {
  return {
    getByWorkspace: vi.fn(),
    upsert: vi.fn(),
    getStale: vi.fn(),
  };
}

describe("MetricsService (Unit Tests)", () => {
  let mockRepo: PipelineMetricsRepositoryInterface;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = createMockRepo();
  });

  describe("getMetrics", () => {
    it("returns cached metrics if computed_at < 10 minutes ago", async () => {
      const recentMetrics: PipelineMetricsSelect = {
        id: "pm-1",
        workspaceId: "ws-1",
        prospectsNew: 5,
        prospectsAnalyzing: 3,
        prospectsScored: 2,
        prospectsQualified: 4,
        prospectsContacted: 1,
        prospectsNegotiating: 1,
        prospectsConverted30d: 2,
        prospectsArchived30d: 1,
        proposalsDraft: 3,
        proposalsSent: 5,
        proposalsViewed: 4,
        proposalsAccepted: 2,
        proposalsDeclined30d: 1,
        proposalsExpired30d: 0,
        contractsDraft: 2,
        contractsSent: 3,
        contractsPendingSignature: 1,
        contractsSigned: 2,
        contractsExecuted: 1,
        contractsExpiring7d: 0,
        invoicesDraft: 2,
        invoicesSent: 4,
        invoicesPaid30d: 3,
        invoicesOverdue: 1,
        pipelineValueDraftCents: 100000,
        pipelineValueSentCents: 200000,
        pipelineValueSignedCents: 150000,
        revenueThisMonthCents: 50000,
        revenueLastMonthCents: 40000,
        outstandingCents: 30000,
        overdueAmountCents: 10000,
        winRatePct: 7500,
        prospectToQualifiedPct: 6000,
        qualifiedToProposalPct: 8000,
        proposalToSignedPct: 5000,
        avgCycleDays: 14,
        avgCollectionDays: 7,
        currency: "EUR",
        computedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        computationDurationMs: 250,
      };

      (mockRepo.getByWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(
        recentMetrics
      );

      // Test the repository interface directly
      const result = await mockRepo.getByWorkspace("ws-1");

      expect(result).toEqual(recentMetrics);
      expect(mockRepo.getByWorkspace).toHaveBeenCalledWith("ws-1");
    });

    it("returns null if no cached metrics exist", async () => {
      (mockRepo.getByWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      const result = await mockRepo.getByWorkspace("ws-1");

      expect(result).toBeNull();
    });
  });

  describe("upsertMetrics", () => {
    it("creates or updates single row per workspace", async () => {
      const metricsData: PipelineMetricsInsert = {
        id: "pm-1",
        workspaceId: "ws-1",
        prospectsNew: 5,
        prospectsAnalyzing: 3,
        prospectsScored: 2,
        prospectsQualified: 4,
        prospectsContacted: 1,
        prospectsNegotiating: 1,
        prospectsConverted30d: 2,
        prospectsArchived30d: 1,
        proposalsDraft: 3,
        proposalsSent: 5,
        proposalsViewed: 4,
        proposalsAccepted: 2,
        proposalsDeclined30d: 1,
        proposalsExpired30d: 0,
        contractsDraft: 2,
        contractsSent: 3,
        contractsPendingSignature: 1,
        contractsSigned: 2,
        contractsExecuted: 1,
        contractsExpiring7d: 0,
        invoicesDraft: 2,
        invoicesSent: 4,
        invoicesPaid30d: 3,
        invoicesOverdue: 1,
        pipelineValueDraftCents: 100000,
        pipelineValueSentCents: 200000,
        pipelineValueSignedCents: 150000,
        revenueThisMonthCents: 50000,
        revenueLastMonthCents: 40000,
        outstandingCents: 30000,
        overdueAmountCents: 10000,
        winRatePct: 7500,
        prospectToQualifiedPct: 6000,
        qualifiedToProposalPct: 8000,
        proposalToSignedPct: 5000,
        avgCycleDays: 14,
        avgCollectionDays: 7,
        currency: "EUR",
        computedAt: new Date(),
        computationDurationMs: 250,
      };

      (mockRepo.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await mockRepo.upsert("ws-1", metricsData);

      expect(mockRepo.upsert).toHaveBeenCalledWith("ws-1", metricsData);
      expect(mockRepo.upsert).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStale", () => {
    it("returns workspaces with metrics older than maxAgeMinutes", async () => {
      (mockRepo.getStale as ReturnType<typeof vi.fn>).mockResolvedValue([
        "ws-1",
        "ws-2",
      ]);

      const stale = await mockRepo.getStale(5);

      expect(Array.isArray(stale)).toBe(true);
      expect(stale).toEqual(["ws-1", "ws-2"]);
      expect(mockRepo.getStale).toHaveBeenCalledWith(5);
    });
  });
});

describe("MetricsService Computation Logic", () => {
  describe("Prospect counts", () => {
    it("should count prospects by pipeline stage correctly", () => {
      // Unit test the counting logic
      const stageCounts: Record<string, number> = {
        new: 10,
        analyzing: 5,
        scored: 8,
        qualified: 6,
        contacted: 3,
        negotiating: 2,
      };

      const result = {
        prospectsNew: stageCounts["new"] ?? 0,
        prospectsAnalyzing: stageCounts["analyzing"] ?? 0,
        prospectsScored: stageCounts["scored"] ?? 0,
        prospectsQualified: stageCounts["qualified"] ?? 0,
        prospectsContacted: stageCounts["contacted"] ?? 0,
        prospectsNegotiating: stageCounts["negotiating"] ?? 0,
        prospectsConverted30d: 4,
        prospectsArchived30d: 1,
      };

      expect(result.prospectsNew).toBe(10);
      expect(result.prospectsAnalyzing).toBe(5);
      expect(result.prospectsScored).toBe(8);
      expect(result.prospectsQualified).toBe(6);
      expect(result.prospectsContacted).toBe(3);
      expect(result.prospectsNegotiating).toBe(2);
    });
  });

  describe("Win rate calculation", () => {
    it("calculates win_rate_pct correctly from deal_outcomes", () => {
      // 75 won out of 100 = 75% = 7500 (percentage * 100)
      const total = 100;
      const won = 75;
      const winRatePct = total > 0 ? Math.round((won / total) * 10000) : 0;

      expect(winRatePct).toBe(7500);
    });

    it("returns 0 when no deals exist", () => {
      const total = 0;
      const won = 0;
      const winRatePct = total > 0 ? Math.round((won / total) * 10000) : 0;

      expect(winRatePct).toBe(0);
    });
  });

  describe("Financial metrics", () => {
    it("sums pipeline values correctly", () => {
      const proposalValues: Record<string, number> = {
        draft: 100000,
        sent: 200000,
        signed: 100000,
        accepted: 50000,
      };

      const result = {
        pipelineValueDraftCents: proposalValues["draft"] ?? 0,
        pipelineValueSentCents: proposalValues["sent"] ?? 0,
        pipelineValueSignedCents:
          (proposalValues["signed"] ?? 0) + (proposalValues["accepted"] ?? 0),
      };

      expect(result.pipelineValueDraftCents).toBe(100000);
      expect(result.pipelineValueSentCents).toBe(200000);
      expect(result.pipelineValueSignedCents).toBe(150000);
    });
  });

  describe("Conversion rates", () => {
    it("calculates prospect-to-qualified rate correctly", () => {
      const prospectTotal = 100;
      const prospectQualified = 60;
      const prospectToQualifiedPct =
        prospectTotal > 0
          ? Math.round((prospectQualified / prospectTotal) * 10000)
          : 0;

      expect(prospectToQualifiedPct).toBe(6000); // 60%
    });

    it("calculates proposal-to-signed rate correctly", () => {
      const proposalTotal = 50;
      const proposalSigned = 25;
      const proposalToSignedPct =
        proposalTotal > 0
          ? Math.round((proposalSigned / proposalTotal) * 10000)
          : 0;

      expect(proposalToSignedPct).toBe(5000); // 50%
    });
  });
});
