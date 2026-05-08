/**
 * Tests for CannibalizationService Re-export
 * Phase 35-05: Cannibalization Detection
 *
 * This file verifies that the re-export from the unified CannibalizationService works.
 * Full test coverage is in:
 * @see src/server/features/analytics/services/CannibalizationService.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before imports
vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(() => Promise.resolve({ rows: [] })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

vi.mock("@/server/services/analytics/gsc-client", () => ({
  fetchGSCQueryPageMetrics: vi.fn(() => Promise.resolve([])),
  getGSCDateRange: vi.fn(() => ({ startDate: "2024-01-01", endDate: "2024-01-31" })),
}));

vi.mock("@/server/services/analytics/google-auth", () => ({
  getValidCredentials: vi.fn(() =>
    Promise.resolve({
      accessToken: "mock-token",
      gscSiteUrl: "https://example.com",
    })
  ),
}));

vi.mock("@/db/link-schema", () => ({
  keywordCannibalization: {
    id: "id",
    clientId: "clientId",
    keywordLower: "keywordLower",
    status: "status",
  },
}));

// Import after mocks
import {
  CannibalizationService,
  getCannibalizationService,
  detectKeywordCannibalization,
  isTargetCannibalized,
} from "./CannibalizationService";

describe("CannibalizationService Re-export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exports", () => {
    it("exports CannibalizationService class", () => {
      expect(CannibalizationService).toBeDefined();
      expect(typeof CannibalizationService).toBe("function");
    });

    it("exports getCannibalizationService function", () => {
      expect(getCannibalizationService).toBeDefined();
      expect(typeof getCannibalizationService).toBe("function");
    });

    it("exports detectKeywordCannibalization function", () => {
      expect(detectKeywordCannibalization).toBeDefined();
      expect(typeof detectKeywordCannibalization).toBe("function");
    });

    it("exports isTargetCannibalized function", () => {
      expect(isTargetCannibalized).toBeDefined();
      expect(typeof isTargetCannibalized).toBe("function");
    });
  });

  describe("getCannibalizationService", () => {
    it("returns a CannibalizationService instance", () => {
      const service = getCannibalizationService();
      expect(service).toBeInstanceOf(CannibalizationService);
    });

    it("returns the same singleton instance", () => {
      const service1 = getCannibalizationService();
      const service2 = getCannibalizationService();
      expect(service1).toBe(service2);
    });
  });

  describe("service methods", () => {
    it("has detect method", () => {
      const service = getCannibalizationService();
      expect(typeof service.detect).toBe("function");
    });

    it("has detectCannibalization method (legacy)", () => {
      const service = getCannibalizationService();
      expect(typeof service.detectCannibalization).toBe("function");
    });

    it("has isTargetCannibalized method", () => {
      const service = getCannibalizationService();
      expect(typeof service.isTargetCannibalized).toBe("function");
    });
  });
});
