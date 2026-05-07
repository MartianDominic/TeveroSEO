/**
 * CwvCheckAdapter Tests
 * Phase 95-12: CWV Consolidation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CwvCheckAdapter,
  getCwvCheckAdapter,
  resetCwvCheckAdapter,
} from "../CwvCheckAdapter";
import { CWV_THRESHOLDS, type CwvMetrics } from "@/server/features/scraping/cwv/types";

// Mock the CruxClient and PsiClient
vi.mock("@/server/features/scraping/cwv/CruxClient", () => ({
  CruxClient: vi.fn().mockImplementation(() => ({
    queryOrigin: vi.fn().mockResolvedValue(null),
    queryUrl: vi.fn().mockResolvedValue(null),
    extractMetrics: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock("@/server/features/scraping/cwv/PsiClient", () => ({
  PsiClient: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue(null),
    extractMetrics: vi.fn().mockReturnValue({}),
  })),
}));

describe("CwvCheckAdapter", () => {
  beforeEach(() => {
    resetCwvCheckAdapter();
    vi.clearAllMocks();
  });

  describe("evaluateMetric", () => {
    it("returns null for null metrics", () => {
      const adapter = new CwvCheckAdapter();
      const result = adapter.evaluateMetric(null, "lcp");
      expect(result).toBeNull();
    });

    it("returns null when metric value is missing", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        lcpRating: "good",
        inpRating: "good",
        clsRating: "good",
        // No lcp value
      };
      const result = adapter.evaluateMetric(metrics, "lcp");
      expect(result).toBeNull();
    });

    it("calculates correct score for good LCP (below threshold)", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        lcp: 2000, // Below good threshold of 2500
        lcpRating: "good",
        inpRating: "good",
        clsRating: "good",
      };
      const result = adapter.evaluateMetric(metrics, "lcp");

      expect(result).not.toBeNull();
      expect(result!.rating).toBe("good");
      expect(result!.score).toBe(100);
      expect(result!.pass).toBe(true);
    });

    it("calculates correct score for needs-improvement LCP", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        lcp: 3250, // Between 2500 (good) and 4000 (poor)
        lcpRating: "needs-improvement",
        inpRating: "good",
        clsRating: "good",
      };
      const result = adapter.evaluateMetric(metrics, "lcp");

      expect(result).not.toBeNull();
      expect(result!.rating).toBe("needs-improvement");
      expect(result!.score).toBeGreaterThan(0);
      expect(result!.score).toBeLessThan(100);
      expect(result!.pass).toBe(true); // needs-improvement still passes
    });

    it("calculates correct score for poor LCP (above threshold)", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        lcp: 5000, // Above poor threshold of 4000
        lcpRating: "poor",
        inpRating: "good",
        clsRating: "good",
      };
      const result = adapter.evaluateMetric(metrics, "lcp");

      expect(result).not.toBeNull();
      expect(result!.rating).toBe("poor");
      expect(result!.score).toBe(0);
      expect(result!.pass).toBe(false);
    });

    it("calculates correct score for good CLS", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        cls: 0.05, // Below good threshold of 0.1
        lcpRating: "good",
        inpRating: "good",
        clsRating: "good",
      };
      const result = adapter.evaluateMetric(metrics, "cls");

      expect(result).not.toBeNull();
      expect(result!.rating).toBe("good");
      expect(result!.score).toBe(100);
    });

    it("calculates correct score for poor CLS", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        cls: 0.3, // Above poor threshold of 0.25
        lcpRating: "good",
        inpRating: "good",
        clsRating: "poor",
      };
      const result = adapter.evaluateMetric(metrics, "cls");

      expect(result).not.toBeNull();
      expect(result!.rating).toBe("poor");
      expect(result!.score).toBe(0);
    });

    it("calculates correct score for INP", () => {
      const adapter = new CwvCheckAdapter();
      const metrics: CwvMetrics = {
        source: "crux",
        fetchedAt: new Date(),
        inp: 150, // Below good threshold of 200
        lcpRating: "good",
        inpRating: "good",
        clsRating: "good",
      };
      const result = adapter.evaluateMetric(metrics, "inp");

      expect(result).not.toBeNull();
      expect(result!.rating).toBe("good");
      expect(result!.score).toBe(100);
    });
  });

  describe("singleton", () => {
    it("returns same instance when calling getCwvCheckAdapter multiple times", () => {
      const adapter1 = getCwvCheckAdapter();
      const adapter2 = getCwvCheckAdapter();
      expect(adapter1).toBe(adapter2);
    });

    it("returns new instance after resetCwvCheckAdapter", () => {
      const adapter1 = getCwvCheckAdapter();
      resetCwvCheckAdapter();
      const adapter2 = getCwvCheckAdapter();
      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe("thresholds", () => {
    it("uses correct LCP thresholds", () => {
      expect(CWV_THRESHOLDS.lcp.good).toBe(2500);
      expect(CWV_THRESHOLDS.lcp.poor).toBe(4000);
    });

    it("uses correct INP thresholds", () => {
      expect(CWV_THRESHOLDS.inp.good).toBe(200);
      expect(CWV_THRESHOLDS.inp.poor).toBe(500);
    });

    it("uses correct CLS thresholds", () => {
      expect(CWV_THRESHOLDS.cls.good).toBe(0.1);
      expect(CWV_THRESHOLDS.cls.poor).toBe(0.25);
    });

    it("uses correct TTFB thresholds", () => {
      expect(CWV_THRESHOLDS.ttfb.good).toBe(800);
      expect(CWV_THRESHOLDS.ttfb.poor).toBe(1800);
    });
  });
});
