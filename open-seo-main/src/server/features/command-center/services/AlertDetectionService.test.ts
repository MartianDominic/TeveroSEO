/**
 * AlertDetectionService Test Suite
 * Phase 62-07: Smart Alert Detection
 *
 * Tests:
 * - high_value_stuck rule detects proposals > 5000 EUR with no update in 7+ days
 * - win_rate_declining rule triggers when rate drops > 5%
 * - contract_expiring_soon detects contracts expiring in 14 days
 * - existing active alert prevents duplicate creation
 * - auto-resolve sets resolvedAt when condition no longer applies
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SmartAlertSelect, PipelineMetricsSelect } from "@/db";

// Mock hoisted functions
const {
  mockFindByWorkspace,
  mockFindActiveByType,
  mockCreate,
  mockDismiss,
  mockResolve,
  mockExpireOld,
  mockDbQuery,
} = vi.hoisted(() => ({
  mockFindByWorkspace: vi.fn(),
  mockFindActiveByType: vi.fn(),
  mockCreate: vi.fn(),
  mockDismiss: vi.fn(),
  mockResolve: vi.fn(),
  mockExpireOld: vi.fn(),
  mockDbQuery: {
    proposals: { findMany: vi.fn() },
    contracts: { findMany: vi.fn() },
    prospects: { findMany: vi.fn() },
    organization: { findFirst: vi.fn() },
  },
}));

// Mock repository
vi.mock("../repositories/SmartAlertRepository", () => ({
  SmartAlertRepository: vi.fn().mockImplementation(() => ({
    findByWorkspace: mockFindByWorkspace,
    findActiveByType: mockFindActiveByType,
    create: mockCreate,
    dismiss: mockDismiss,
    resolve: mockResolve,
    expireOld: mockExpireOld,
  })),
  getSmartAlertRepository: vi.fn(() => ({
    findByWorkspace: mockFindByWorkspace,
    findActiveByType: mockFindActiveByType,
    create: mockCreate,
    dismiss: mockDismiss,
    resolve: mockResolve,
    expireOld: mockExpireOld,
  })),
}));

// Mock db module
vi.mock("@/db", () => ({
  db: { query: mockDbQuery },
  proposals: {},
  contracts: {},
  prospects: {},
  organization: {},
}));

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args) => ({ type: "eq", args })),
  and: vi.fn((...args) => ({ type: "and", args })),
  inArray: vi.fn((...args) => ({ type: "inArray", args })),
  gte: vi.fn((...args) => ({ type: "gte", args })),
  lte: vi.fn((...args) => ({ type: "lte", args })),
  isNull: vi.fn((...args) => ({ type: "isNull", args })),
  desc: vi.fn((...args) => ({ type: "desc", args })),
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
import { AlertDetectionService, ALERT_RULES } from "./AlertDetectionService";
import type { SmartAlertRepositoryInterface } from "../repositories/SmartAlertRepository";

describe("AlertDetectionService", () => {
  let service: AlertDetectionService;
  let mockAlertRepo: SmartAlertRepositoryInterface;
  let mockNotificationService: { sendAlertNotification: ReturnType<typeof vi.fn> };

  const mockWorkspaceId = "test-workspace-123";

  // Factory for metrics with defaults
  const createMetrics = (
    overrides: Partial<PipelineMetricsSelect> = {}
  ): PipelineMetricsSelect & { winRatePreviousPct?: number; avgCollectionDaysHistorical?: number } => ({
    id: "metrics-123",
    workspaceId: mockWorkspaceId,
    prospectsNew: 0,
    prospectsAnalyzing: 0,
    prospectsScored: 0,
    prospectsQualified: 0,
    prospectsContacted: 0,
    prospectsNegotiating: 0,
    prospectsConverted30d: 0,
    prospectsArchived30d: 0,
    proposalsDraft: 0,
    proposalsSent: 0,
    proposalsViewed: 0,
    proposalsAccepted: 0,
    proposalsDeclined30d: 0,
    proposalsExpired30d: 0,
    contractsDraft: 0,
    contractsSent: 0,
    contractsPendingSignature: 0,
    contractsSigned: 0,
    contractsExecuted: 0,
    contractsExpiring7d: 0,
    invoicesDraft: 0,
    invoicesSent: 0,
    invoicesPaid30d: 0,
    invoicesOverdue: 0,
    pipelineValueDraftCents: 0,
    pipelineValueSentCents: 0,
    pipelineValueSignedCents: 0,
    revenueThisMonthCents: 0,
    revenueLastMonthCents: 0,
    outstandingCents: 0,
    overdueAmountCents: 0,
    winRatePct: 5000, // 50%
    prospectToQualifiedPct: 3000,
    qualifiedToProposalPct: 4000,
    proposalToSignedPct: 2000,
    avgCycleDays: 30,
    avgCollectionDays: 14,
    currency: "EUR",
    computedAt: new Date(),
    computationDurationMs: 100,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockAlertRepo = {
      findByWorkspace: mockFindByWorkspace.mockResolvedValue([]),
      findActiveByType: mockFindActiveByType.mockResolvedValue(null),
      create: mockCreate.mockImplementation(async (data) => ({
        id: "alert-123",
        ...data,
        isDismissed: false,
        createdAt: new Date(),
      })),
      dismiss: mockDismiss.mockResolvedValue(undefined),
      resolve: mockResolve.mockResolvedValue(undefined),
      expireOld: mockExpireOld.mockResolvedValue(0),
    };

    mockNotificationService = {
      sendAlertNotification: vi.fn().mockResolvedValue(undefined),
    };

    // Default mock responses
    mockDbQuery.proposals.findMany.mockResolvedValue([]);
    mockDbQuery.contracts.findMany.mockResolvedValue([]);
    mockDbQuery.prospects.findMany.mockResolvedValue([]);
    mockDbQuery.organization.findFirst.mockResolvedValue({
      id: mockWorkspaceId,
      name: "Test Workspace",
    });

    service = new AlertDetectionService(
      mockAlertRepo,
      { query: mockDbQuery } as any,
      mockNotificationService as any
    );
  });

  describe("ALERT_RULES", () => {
    it("should define 5 alert rules", () => {
      expect(ALERT_RULES).toHaveLength(5);
    });

    it("should have correct rule types", () => {
      const ruleTypes = ALERT_RULES.map((r) => r.type);
      expect(ruleTypes).toContain("high_value_stuck");
      expect(ruleTypes).toContain("win_rate_declining");
      expect(ruleTypes).toContain("contract_expiring_soon");
      expect(ruleTypes).toContain("unassigned_prospects");
      expect(ruleTypes).toContain("collection_velocity_drop");
    });
  });

  describe("high_value_stuck rule", () => {
    it("should detect proposals > 5000 EUR with no update in 7+ days", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      // Mock stuck deal
      mockDbQuery.proposals.findMany.mockResolvedValue([
        {
          id: "prop-123",
          workspaceId: mockWorkspaceId,
          clientName: "Big Corp",
          totalValueCents: 1000000, // 10,000 EUR
          status: "sent",
          updatedAt: eightDaysAgo,
        },
      ]);

      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      const metrics = createMetrics();

      const rule = ALERT_RULES.find((r) => r.type === "high_value_stuck")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe("high_value_stuck");
      expect(alert?.severity).toBe("high");
      expect(alert?.entityType).toBe("proposal");
      expect(alert?.entityId).toBe("prop-123");
      expect(alert?.description).toContain("Big Corp");
    });

    it("should return null if no stuck high-value deals", async () => {
      mockDbQuery.proposals.findMany.mockResolvedValue([]);

      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      const metrics = createMetrics();

      const rule = ALERT_RULES.find((r) => r.type === "high_value_stuck")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).toBeNull();
    });
  });

  describe("win_rate_declining rule", () => {
    it("should trigger when win rate drops more than 5%", async () => {
      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      // Win rate dropped from 50% to 40% (1000 basis points)
      const metrics = createMetrics({
        winRatePct: 4000, // 40%
      });
      metrics.winRatePreviousPct = 5000; // 50%

      const rule = ALERT_RULES.find((r) => r.type === "win_rate_declining")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe("win_rate_declining");
      expect(alert?.severity).toBe("medium");
      expect(alert?.description).toContain("50.0%");
      expect(alert?.description).toContain("40.0%");
    });

    it("should return null if win rate stable or improving", async () => {
      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      const metrics = createMetrics({
        winRatePct: 5000, // 50%
      });
      metrics.winRatePreviousPct = 5000; // Same as before

      const rule = ALERT_RULES.find((r) => r.type === "win_rate_declining")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).toBeNull();
    });

    it("should return null if no previous win rate available", async () => {
      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      const metrics = createMetrics({
        winRatePct: 4000,
      });
      // No winRatePreviousPct

      const rule = ALERT_RULES.find((r) => r.type === "win_rate_declining")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).toBeNull();
    });
  });

  describe("contract_expiring_soon rule", () => {
    it("should detect contracts expiring within 14 days", async () => {
      const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

      mockDbQuery.contracts.findMany.mockResolvedValue([
        {
          id: "contract-1",
          workspaceId: mockWorkspaceId,
          status: "executed",
          expiresAt: tenDaysFromNow,
        },
        {
          id: "contract-2",
          workspaceId: mockWorkspaceId,
          status: "executed",
          expiresAt: tenDaysFromNow,
        },
      ]);

      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      const metrics = createMetrics();

      const rule = ALERT_RULES.find((r) => r.type === "contract_expiring_soon")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).not.toBeNull();
      expect(alert?.alertType).toBe("contract_expiring_soon");
      expect(alert?.severity).toBe("high");
      expect(alert?.title).toContain("2 contract(s)");
      expect(alert?.metricCurrent).toBe("2");
    });

    it("should return null if no contracts expiring soon", async () => {
      mockDbQuery.contracts.findMany.mockResolvedValue([]);

      const workspace = { id: mockWorkspaceId, name: "Test Workspace" };
      const metrics = createMetrics();

      const rule = ALERT_RULES.find((r) => r.type === "contract_expiring_soon")!;
      const alert = await rule.detectFn(
        metrics,
        workspace as any,
        { query: mockDbQuery } as any
      );

      expect(alert).toBeNull();
    });
  });

  describe("duplicate prevention", () => {
    it("should not create alert if active alert of same type exists", async () => {
      const existingAlert: SmartAlertSelect = {
        id: "existing-alert",
        workspaceId: mockWorkspaceId,
        alertType: "high_value_stuck",
        severity: "high",
        title: "Existing alert",
        description: "Already exists",
        entityType: null,
        entityId: null,
        metricCurrent: null,
        metricPrevious: null,
        metricUnit: null,
        suggestedAction: null,
        actionUrl: null,
        isDismissed: false,
        dismissedBy: null,
        dismissedAt: null,
        createdAt: new Date(),
        expiresAt: null,
        resolvedAt: null,
      };

      mockFindActiveByType.mockResolvedValue(existingAlert);

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      mockDbQuery.proposals.findMany.mockResolvedValue([
        {
          id: "prop-123",
          workspaceId: mockWorkspaceId,
          clientName: "Big Corp",
          totalValueCents: 1000000,
          status: "sent",
          updatedAt: eightDaysAgo,
        },
      ]);

      await service.detectAlerts(mockWorkspaceId, createMetrics());

      // Should NOT have created a new alert
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("auto-resolve", () => {
    it("should resolve alert when condition no longer applies", async () => {
      const existingAlert: SmartAlertSelect = {
        id: "existing-alert",
        workspaceId: mockWorkspaceId,
        alertType: "high_value_stuck",
        severity: "high",
        title: "Stuck deal",
        description: "Was stuck",
        entityType: null,
        entityId: null,
        metricCurrent: null,
        metricPrevious: null,
        metricUnit: null,
        suggestedAction: null,
        actionUrl: null,
        isDismissed: false,
        dismissedBy: null,
        dismissedAt: null,
        createdAt: new Date(),
        expiresAt: null,
        resolvedAt: null,
      };

      // Return existing alert for high_value_stuck check
      mockFindActiveByType.mockImplementation(async (_, alertType) => {
        if (alertType === "high_value_stuck") return existingAlert;
        return null;
      });

      // No more stuck deals
      mockDbQuery.proposals.findMany.mockResolvedValue([]);

      await service.detectAlerts(mockWorkspaceId, createMetrics());

      // Should have resolved the existing alert
      expect(mockResolve).toHaveBeenCalledWith("existing-alert");
    });
  });

  describe("detectAlerts", () => {
    it("should evaluate all rules and create alerts for detected issues", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      mockDbQuery.proposals.findMany.mockResolvedValue([
        {
          id: "prop-123",
          workspaceId: mockWorkspaceId,
          clientName: "Big Corp",
          totalValueCents: 1000000,
          status: "sent",
          updatedAt: eightDaysAgo,
        },
      ]);

      await service.detectAlerts(mockWorkspaceId, createMetrics());

      // Should have created high_value_stuck alert
      expect(mockCreate).toHaveBeenCalled();
      expect(mockNotificationService.sendAlertNotification).toHaveBeenCalled();
    });
  });
});
