/**
 * Tests for DataForSEO Keyword Gap Analysis API
 * Phase 28: Keyword Gap Analysis
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchDomainIntersectionRaw,
  calculateOpportunityScore,
  type DomainIntersectionInput,
} from "./dataforseoKeywordGap";
import type { KeywordGap } from "@/db/prospect-schema";

// Mock the fetch function
global.fetch = vi.fn();

describe("DataForSEO Keyword Gap API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchDomainIntersectionRaw", () => {
    it("should fetch domain intersection data successfully", async () => {
      const mockResponse = {
        status_code: 20000,
        status_message: "Ok.",
        tasks: [
          {
            status_code: 20000,
            status_message: "Ok.",
            path: ["v3", "dataforseo_labs", "google", "domain_intersection", "live"],
            cost: 0.025,
            result_count: 1,
            result: [
              {
                items: [
                  {
                    keyword_data: {
                      keyword: "seo tools",
                      keyword_info: {
                        search_volume: 5000,
                        cpc: 2.5,
                      },
                      keyword_properties: {
                        keyword_difficulty: 45,
                      },
                    },
                    domain_1_ranked_serp_element: {
                      rank_absolute: 1,
                    },
                    domain_2_ranked_serp_element: null, // Target domain doesn't rank
                  },
                ],
              },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const input: DomainIntersectionInput = {
        target1: "competitor.com",
        target2: "targetdomain.com",
        locationCode: 2840,
        languageCode: "en",
        limit: 100,
      };

      const result = await fetchDomainIntersectionRaw(input);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].keyword).toBe("seo tools");
      expect(result.billing.costUsd).toBe(0.025);
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const input: DomainIntersectionInput = {
        target1: "competitor.com",
        target2: "targetdomain.com",
        locationCode: 2840,
        languageCode: "en",
      };

      await expect(fetchDomainIntersectionRaw(input)).rejects.toThrow();
    });

    it("should filter out keywords where target domain ranks", async () => {
      const mockResponse = {
        status_code: 20000,
        tasks: [
          {
            status_code: 20000,
            path: ["v3", "dataforseo_labs", "google", "domain_intersection", "live"],
            cost: 0.025,
            result_count: 1,
            result: [
              {
                items: [
                  {
                    keyword_data: {
                      keyword: "both rank",
                      keyword_info: { search_volume: 1000, cpc: 1.0 },
                      keyword_properties: { keyword_difficulty: 30 },
                    },
                    domain_1_ranked_serp_element: { rank_absolute: 5 },
                    domain_2_ranked_serp_element: { rank_absolute: 10 }, // Target ranks
                  },
                  {
                    keyword_data: {
                      keyword: "competitor only",
                      keyword_info: { search_volume: 2000, cpc: 2.0 },
                      keyword_properties: { keyword_difficulty: 40 },
                    },
                    domain_1_ranked_serp_element: { rank_absolute: 3 },
                    domain_2_ranked_serp_element: null, // Target doesn't rank - GAP!
                  },
                ],
              },
            ],
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const input: DomainIntersectionInput = {
        target1: "competitor.com",
        target2: "targetdomain.com",
        locationCode: 2840,
        languageCode: "en",
      };

      const result = await fetchDomainIntersectionRaw(input);

      // Should only return the gap keyword
      expect(result.data).toHaveLength(1);
      expect(result.data[0].keyword).toBe("competitor only");
    });
  });

  describe("calculateOpportunityScore", () => {
    it("should calculate opportunity score correctly", () => {
      const gap: KeywordGap = {
        keyword: "seo tools",
        competitorDomain: "competitor.com",
        competitorPosition: 3,
        searchVolume: 5000,
        cpc: 2.5,
        difficulty: 45,
        trafficPotential: 0, // Will be calculated
      };

      const score = calculateOpportunityScore(gap);

      // Formula: searchVolume * cpc * (100 - difficulty) / 100
      // 5000 * 2.5 * (100 - 45) / 100 = 5000 * 2.5 * 0.55 = 6875
      expect(score).toBe(6875);
    });

    it("should handle zero CPC", () => {
      const gap: KeywordGap = {
        keyword: "free keyword",
        competitorDomain: "competitor.com",
        competitorPosition: 1,
        searchVolume: 10000,
        cpc: 0,
        difficulty: 20,
        trafficPotential: 0,
      };

      const score = calculateOpportunityScore(gap);
      expect(score).toBe(0);
    });

    it("should handle high difficulty keywords", () => {
      const gap: KeywordGap = {
        keyword: "competitive",
        competitorDomain: "competitor.com",
        competitorPosition: 1,
        searchVolume: 100000,
        cpc: 10.0,
        difficulty: 95,
        trafficPotential: 0,
      };

      const score = calculateOpportunityScore(gap);

      // 100000 * 10.0 * (100 - 95) / 100 = 50000
      expect(score).toBe(50000);
    });

    it("should return 0 for 100 difficulty", () => {
      const gap: KeywordGap = {
        keyword: "impossible",
        competitorDomain: "competitor.com",
        competitorPosition: 1,
        searchVolume: 50000,
        cpc: 5.0,
        difficulty: 100,
        trafficPotential: 0,
      };

      const score = calculateOpportunityScore(gap);
      expect(score).toBe(0);
    });

    it("should handle zero search volume", () => {
      const gap: KeywordGap = {
        keyword: "no searches",
        competitorDomain: "competitor.com",
        competitorPosition: 1,
        searchVolume: 0,
        cpc: 5.0,
        difficulty: 30,
        trafficPotential: 0,
      };

      const score = calculateOpportunityScore(gap);
      expect(score).toBe(0);
    });
  });
});
