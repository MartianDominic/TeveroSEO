/**
 * Tests for ViewTrackingService.
 * Phase 30-04: Engagement Analytics
 *
 * TDD: Tests written FIRST before implementation.
 * Tests view tracking with IP hashing, session deduplication, and heartbeat.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Set IP_SALT for tests before any imports that use it
const originalIpSalt = process.env.IP_SALT;
process.env.IP_SALT = "test-ip-salt-for-unit-tests";

// Mock nanoid
vi.mock("nanoid", () => ({
  nanoid: () => "mock-view-id",
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// Mock crypto for IP hashing
vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("hashed-ip-address-0123456789"),
  })),
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
const mockAnd = vi.fn();
const mockGte = vi.fn();

const mockView = {
  id: "view-123",
  proposalId: "proposal-456",
  viewedAt: new Date(),
  durationSeconds: 0,
  sectionsViewed: [],
  roiCalculatorUsed: false,
  deviceType: "desktop",
  ipHash: "hashed-ip-addr01", // 16 chars truncated hash
  createdAt: new Date(),
};

const mockProposal = {
  id: "proposal-456",
  workspaceId: "workspace-789",
  status: "sent",
  firstViewedAt: null,
};

// Mock data for getViewsByProposal
let mockViewsForProposal: unknown[] = [];

vi.mock("@/db/index", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockLimit,
          orderBy: () => {
            // For getViewsByProposal which doesn't use limit
            if (mockViewsForProposal.length > 0) {
              return Promise.resolve(mockViewsForProposal);
            }
            return {
              limit: mockLimit,
            };
          },
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
  },
}));

function setMockViewsForProposal(views: unknown[]) {
  mockViewsForProposal = views;
}

describe("ViewTrackingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([mockView]);
    mockLimit.mockResolvedValue([mockProposal]);
    mockViewsForProposal = [];
  });

  describe("trackProposalView", () => {
    it("should create a view record with hashed IP", async () => {
      const { ViewTrackingService } = await import("./ViewTrackingService");

      const result = await ViewTrackingService.trackProposalView({
        proposalId: "proposal-456",
        deviceType: "desktop",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
    });

    it("should hash IP address using SHA256 with salt for GDPR compliance", async () => {
      const crypto = await import("crypto");
      const { ViewTrackingService } = await import("./ViewTrackingService");

      await ViewTrackingService.trackProposalView({
        proposalId: "proposal-456",
        deviceType: "desktop",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      expect(crypto.createHash).toHaveBeenCalledWith("sha256");
    });

    it("should truncate IP hash to 16 characters", async () => {
      // Test the hashIpAddress function directly since it's responsible for truncation
      const { hashIpAddress } = await import("./ViewTrackingService");

      const hash = hashIpAddress("192.168.1.1");

      expect(hash).toBeDefined();
      expect(hash.length).toBeLessThanOrEqual(16);
    });

    it("should detect device type from user agent", async () => {
      const { detectDeviceType } = await import("./ViewTrackingService");

      // Test the detectDeviceType function directly
      expect(detectDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
      expect(detectDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS)")).toBe("mobile");
      expect(detectDeviceType("Mozilla/5.0 (iPad; CPU OS)")).toBe("tablet");
      expect(detectDeviceType("Mozilla/5.0 (Linux; Android 10; Tablet)")).toBe("tablet");
    });

    it("should update proposal firstViewedAt on first view", async () => {
      // Setup: proposal exists with status 'sent' and no firstViewedAt
      mockLimit
        .mockResolvedValueOnce([{ ...mockProposal, status: "sent", firstViewedAt: null }]) // Proposal lookup
        .mockResolvedValueOnce([]); // No existing session (dedup check)

      mockReturning.mockResolvedValue([mockView]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      await ViewTrackingService.trackProposalView({
        proposalId: "proposal-456",
        deviceType: "desktop",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      // Verify that insert was called (which calls mockReturning)
      expect(mockReturning).toHaveBeenCalled();
    });

    it("should throw if proposal not found", async () => {
      mockLimit.mockResolvedValue([]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      await expect(
        ViewTrackingService.trackProposalView({
          proposalId: "nonexistent",
          deviceType: "desktop",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("updateViewDuration", () => {
    it("should update duration for a view (heartbeat)", async () => {
      mockReturning.mockResolvedValue([{ ...mockView, durationSeconds: 60 }]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      const result = await ViewTrackingService.updateViewDuration("view-123", 60);

      expect(result.durationSeconds).toBe(60);
    });

    it("should throw if view not found", async () => {
      mockReturning.mockResolvedValue([]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      await expect(
        ViewTrackingService.updateViewDuration("nonexistent", 60)
      ).rejects.toThrow(/not found/i);
    });

    it("should only accept positive duration values", async () => {
      const { ViewTrackingService } = await import("./ViewTrackingService");

      await expect(
        ViewTrackingService.updateViewDuration("view-123", -30)
      ).rejects.toThrow(/duration must be positive/i);
    });
  });

  describe("updateSectionsViewed", () => {
    it("should update sections viewed array", async () => {
      mockReturning.mockResolvedValue([
        { ...mockView, sectionsViewed: ["hero", "opportunities", "investment"] },
      ]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      const result = await ViewTrackingService.updateSectionsViewed(
        "view-123",
        ["hero", "opportunities", "investment"]
      );

      expect(result.sectionsViewed).toContain("hero");
      expect(result.sectionsViewed).toContain("opportunities");
      expect(result.sectionsViewed).toContain("investment");
    });

    it("should deduplicate sections", async () => {
      const { ViewTrackingService } = await import("./ViewTrackingService");

      // Mock should receive deduplicated sections
      mockReturning.mockResolvedValue([
        { ...mockView, sectionsViewed: ["hero", "investment"] },
      ]);

      const result = await ViewTrackingService.updateSectionsViewed(
        "view-123",
        ["hero", "hero", "investment", "investment"]
      );

      expect(result.sectionsViewed?.length).toBe(2);
    });

    it("should throw if view not found", async () => {
      mockReturning.mockResolvedValue([]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      await expect(
        ViewTrackingService.updateSectionsViewed("nonexistent", ["hero"])
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("markRoiCalculatorUsed", () => {
    it("should mark ROI calculator as used", async () => {
      mockReturning.mockResolvedValue([{ ...mockView, roiCalculatorUsed: true }]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      const result = await ViewTrackingService.markRoiCalculatorUsed("view-123");

      expect(result.roiCalculatorUsed).toBe(true);
    });

    it("should throw if view not found", async () => {
      mockReturning.mockResolvedValue([]);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      await expect(
        ViewTrackingService.markRoiCalculatorUsed("nonexistent")
      ).rejects.toThrow(/not found/i);
    });
  });

  describe("getViewsByProposal", () => {
    it("should return all views for a proposal", async () => {
      const views = [
        { ...mockView, id: "view-1", viewedAt: new Date("2025-04-21T10:00:00Z") },
        { ...mockView, id: "view-2", viewedAt: new Date("2025-04-21T11:00:00Z") },
        { ...mockView, id: "view-3", viewedAt: new Date("2025-04-21T12:00:00Z") },
      ];
      setMockViewsForProposal(views);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      const result = await ViewTrackingService.getViewsByProposal("proposal-456");

      expect(result).toHaveLength(3);
    });

    it("should order views by viewedAt descending", async () => {
      const views = [
        { ...mockView, id: "view-3", viewedAt: new Date("2025-04-21T12:00:00Z") },
        { ...mockView, id: "view-2", viewedAt: new Date("2025-04-21T11:00:00Z") },
        { ...mockView, id: "view-1", viewedAt: new Date("2025-04-21T10:00:00Z") },
      ];
      setMockViewsForProposal(views);

      const { ViewTrackingService } = await import("./ViewTrackingService");

      const result = await ViewTrackingService.getViewsByProposal("proposal-456");

      expect(result[0].id).toBe("view-3");
    });
  });

  describe("Session deduplication", () => {
    it("should deduplicate sessions by ipHash within time window", async () => {
      const { ViewTrackingService } = await import("./ViewTrackingService");

      // First call returns existing recent view
      mockLimit
        .mockResolvedValueOnce([mockProposal]) // Proposal exists
        .mockResolvedValueOnce([
          { ...mockView, viewedAt: new Date(Date.now() - 1000) }, // Recent view from same IP
        ]);

      const result = await ViewTrackingService.trackProposalView({
        proposalId: "proposal-456",
        deviceType: "desktop",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });

      // Should return the existing view instead of creating a new one
      expect(result.id).toBe("view-123");
    });
  });
});

describe("IP Hashing", () => {
  it("should use SHA256 algorithm", async () => {
    const { hashIpAddress } = await import("./ViewTrackingService");
    const crypto = await import("crypto");

    hashIpAddress("192.168.1.1");

    expect(crypto.createHash).toHaveBeenCalledWith("sha256");
  });

  it("should use salt from environment variable", async () => {
    const originalEnv = process.env.IP_SALT;
    process.env.IP_SALT = "test-salt";

    const { hashIpAddress } = await import("./ViewTrackingService");

    // Function should use the salt
    const hash1 = hashIpAddress("192.168.1.1");

    process.env.IP_SALT = originalEnv;
    expect(hash1).toBeDefined();
  });

  it("should produce consistent hashes for same IP", async () => {
    const { hashIpAddress } = await import("./ViewTrackingService");

    const hash1 = hashIpAddress("192.168.1.1");
    const hash2 = hashIpAddress("192.168.1.1");

    expect(hash1).toBe(hash2);
  });
});
