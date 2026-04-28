/**
 * Tests for prospect schema types and validation.
 * Phase 28: Keyword Gap Analysis
 */
import { describe, it, expect } from "vitest";
import type {
  KeywordGap,
  ProspectStatus,
  AnalysisType,
  AnalysisStatus,
} from "./prospect-schema";

describe("ProspectSchema Types", () => {
  describe("KeywordGap", () => {
    it("should accept valid keyword gap object", () => {
      const validGap: KeywordGap = {
        keyword: "seo tools",
        competitorDomain: "competitor.com",
        competitorPosition: 3,
        searchVolume: 5000,
        cpc: 2.5,
        difficulty: 45,
        trafficPotential: 6875, // 5000 * 2.5 * (100-45)/100
      };

      expect(validGap.keyword).toBe("seo tools");
      expect(validGap.competitorPosition).toBeGreaterThan(0);
      expect(validGap.difficulty).toBeGreaterThanOrEqual(0);
      expect(validGap.difficulty).toBeLessThanOrEqual(100);
    });

    it("should handle gaps with zero CPC", () => {
      const gap: KeywordGap = {
        keyword: "free seo",
        competitorDomain: "competitor.com",
        competitorPosition: 5,
        searchVolume: 1000,
        cpc: 0,
        difficulty: 30,
        trafficPotential: 0,
      };

      expect(gap.cpc).toBe(0);
      expect(gap.trafficPotential).toBe(0);
    });

    it("should handle high difficulty keywords", () => {
      const gap: KeywordGap = {
        keyword: "seo",
        competitorDomain: "competitor.com",
        competitorPosition: 1,
        searchVolume: 100000,
        cpc: 5.0,
        difficulty: 95,
        trafficPotential: 25000, // 100000 * 5.0 * (100-95)/100
      };

      expect(gap.difficulty).toBeGreaterThan(90);
      expect(gap.trafficPotential).toBeLessThan(gap.searchVolume * gap.cpc);
    });
  });

  describe("ProspectStatus", () => {
    it("should include all valid status values", () => {
      const validStatuses: ProspectStatus[] = [
        "new",
        "analyzing",
        "analyzed",
        "converted",
        "archived",
      ];

      validStatuses.forEach((status) => {
        expect(status).toBeTruthy();
      });
    });
  });

  describe("AnalysisType", () => {
    it("should include all valid analysis types", () => {
      const validTypes: AnalysisType[] = [
        "quick_scan",
        "deep_dive",
        "opportunity_discovery",
      ];

      validTypes.forEach((type) => {
        expect(type).toBeTruthy();
      });
    });
  });

  describe("AnalysisStatus", () => {
    it("should include all valid analysis statuses", () => {
      const validStatuses: AnalysisStatus[] = [
        "pending",
        "running",
        "completed",
        "failed",
      ];

      validStatuses.forEach((status) => {
        expect(status).toBeTruthy();
      });
    });
  });
});
