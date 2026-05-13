/**
 * QuickCaptureService tests - Phase 101-03
 *
 * TDD RED phase: Tests for quick capture functionality
 * - Domain normalization
 * - Entity chain creation based on stage
 * - Activity logging with manual_entry source
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: vi.fn((length?: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const len = length || 21;
    let result = "";
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }),
}));

// Mock the database
const mockInsertValues = vi.fn();
const mockReturning = vi.fn();
const mockInsert = vi.fn(() => ({
  values: mockInsertValues.mockReturnValue({
    returning: mockReturning,
  }),
}));

vi.mock("@/db", () => ({
  db: {
    insert: (table: unknown) => mockInsert(table),
  },
}));

// Import after mocks
import { QuickCaptureService } from "./QuickCaptureService";

describe("QuickCaptureService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset and set default mock returns
    mockReturning.mockReset();
    mockInsertValues.mockReset();
    mockInsert.mockClear();
    // Recreate default chain
    mockInsertValues.mockReturnValue({
      returning: mockReturning,
    });
    mockReturning.mockResolvedValue([{ id: "mock_id" }]);
  });

  describe("normalizeDomain", () => {
    it("should strip https protocol", () => {
      expect(QuickCaptureService.normalizeDomain("https://example.com")).toBe("example.com");
    });

    it("should strip http protocol", () => {
      expect(QuickCaptureService.normalizeDomain("http://example.com")).toBe("example.com");
    });

    it("should strip www prefix", () => {
      expect(QuickCaptureService.normalizeDomain("www.example.com")).toBe("example.com");
    });

    it("should strip path", () => {
      expect(QuickCaptureService.normalizeDomain("example.com/about")).toBe("example.com");
    });

    it("should strip port", () => {
      expect(QuickCaptureService.normalizeDomain("example.com:8080")).toBe("example.com");
    });

    it("should lowercase domain", () => {
      expect(QuickCaptureService.normalizeDomain("EXAMPLE.COM")).toBe("example.com");
    });

    it("should handle full URL with everything", () => {
      expect(QuickCaptureService.normalizeDomain("https://www.EXAMPLE.COM:8080/about?ref=google")).toBe("example.com");
    });
  });

  describe("quickCapture", () => {
    it("should create only prospect for 'new' stage", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_new" }]) // prospect
        .mockResolvedValueOnce([{ id: "activity_new" }]); // activity

      const result = await QuickCaptureService.quickCapture({
        domain: "example.com",
        contactEmail: "john@example.com",
        stage: "new",
        workspaceId: "ws_1",
      });

      expect(result.chainCreated).toEqual(["prospect"]);
      expect(result.proposalId).toBeUndefined();
      expect(result.contractId).toBeUndefined();
      // 2 inserts: prospect + activity
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it("should create only prospect for 'contacted' stage", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_contacted" }]) // prospect
        .mockResolvedValueOnce([{ id: "activity_contacted" }]); // activity

      const result = await QuickCaptureService.quickCapture({
        domain: "example.com",
        stage: "contacted",
        workspaceId: "ws_1",
      });

      expect(result.chainCreated).toEqual(["prospect"]);
      expect(result.proposalId).toBeUndefined();
      expect(result.contractId).toBeUndefined();
    });

    it("should create prospect + proposal for 'negotiating' stage", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_neg" }]) // prospect
        .mockResolvedValueOnce([{ id: "proposal_neg" }]) // proposal
        .mockResolvedValueOnce([{ id: "activity_neg" }]); // activity

      const result = await QuickCaptureService.quickCapture({
        domain: "example.com",
        stage: "negotiating",
        workspaceId: "ws_1",
      });

      expect(result.chainCreated).toContain("prospect");
      expect(result.chainCreated).toContain("proposal");
      expect(result.chainCreated).not.toContain("contract");
      // 3 inserts: prospect + proposal + activity
      expect(mockInsert).toHaveBeenCalledTimes(3);
    });

    it("should create full chain (prospect + proposal + contract) for 'converted' stage", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_conv" }]) // prospect
        .mockResolvedValueOnce([{ id: "proposal_conv" }]) // proposal
        .mockResolvedValueOnce([{ id: "contract_conv" }]) // contract
        .mockResolvedValueOnce([{ id: "activity_conv" }]); // activity

      const result = await QuickCaptureService.quickCapture({
        domain: "https://www.example.com/page",
        contactEmail: "client@example.com",
        stage: "converted",
        workspaceId: "ws_1",
      });

      expect(result.chainCreated).toEqual(["prospect", "proposal", "contract"]);
      expect(result.prospectId).toBe("prospect_conv");
      expect(result.proposalId).toBe("proposal_conv");
      expect(result.contractId).toBe("contract_conv");
      // 4 inserts: prospect + proposal + contract + activity
      expect(mockInsert).toHaveBeenCalledTimes(4);
    });

    it("should log activity with manual_entry source and insertedAtStage", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_1" }])
        .mockResolvedValueOnce([{ id: "activity_1" }]);

      await QuickCaptureService.quickCapture({
        domain: "example.com",
        stage: "new",
        workspaceId: "ws_1",
        userId: "user_123",
      });

      // Check that activity insert was called with correct data
      const activityCall = mockInsertValues.mock.calls.find((call: unknown[]) => {
        const arg = call[0] as Record<string, unknown>;
        return arg.activityType === "created";
      });
      expect(activityCall).toBeDefined();
      const activityData = activityCall[0] as Record<string, unknown>;
      expect(activityData.actorId).toBe("user_123");
      expect((activityData.activityData as Record<string, unknown>).source).toBe("manual_entry");
      expect((activityData.activityData as Record<string, unknown>).insertedAtStage).toBe("new");
    });

    it("should normalize domain before storing", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_1" }])
        .mockResolvedValueOnce([{ id: "activity_1" }]);

      await QuickCaptureService.quickCapture({
        domain: "https://WWW.EXAMPLE.COM/page",
        stage: "new",
        workspaceId: "ws_1",
      });

      // Check that prospect was created with normalized domain
      const prospectCall = mockInsertValues.mock.calls[0];
      expect(prospectCall[0].domain).toBe("example.com");
    });

    it("should use default stage 'new' when not provided", async () => {
      mockReturning
        .mockResolvedValueOnce([{ id: "prospect_1" }])
        .mockResolvedValueOnce([{ id: "activity_1" }]);

      const result = await QuickCaptureService.quickCapture({
        domain: "example.com",
        workspaceId: "ws_1",
      });

      expect(result.chainCreated).toEqual(["prospect"]);
      const prospectCall = mockInsertValues.mock.calls[0];
      expect(prospectCall[0].pipelineStage).toBe("new");
    });
  });
});
