import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchKeywordsForSiteRaw,
  fetchCompetitorsDomainRaw,
} from "./dataforseoProspect";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("dataforseoProspect", () => {
  beforeEach(() => {
    vi.stubEnv("DATAFORSEO_API_KEY", "dGVzdDp0ZXN0"); // base64 test:test
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("fetchKeywordsForSiteRaw", () => {
    it("calls correct endpoint with domain parameters", async () => {
      const mockResponse = {
        status_code: 20000,
        status_message: "Ok.",
        tasks: [
          {
            id: "task-1",
            status_code: 20000,
            status_message: "Ok.",
            path: [
              "v3",
              "dataforseo_labs",
              "google",
              "keywords_for_site",
              "live",
            ],
            cost: 0.05,
            result_count: 2,
            result: [
              {
                items: [
                  {
                    keyword: "sauna heater",
                    keyword_info: {
                      search_volume: 1000,
                      cpc: 2.5,
                      competition: 0.3,
                    },
                    ranked_serp_element: {
                      serp_item: {
                        rank_absolute: 5,
                        url: "https://example.com/saunas",
                      },
                    },
                  },
                  {
                    keyword: "barrel sauna",
                    keyword_info: {
                      search_volume: 500,
                      cpc: 1.5,
                      competition: 0.2,
                    },
                    ranked_serp_element: {
                      serp_item: {
                        rank_absolute: 3,
                        url: "https://example.com/barrel",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await fetchKeywordsForSiteRaw({
        target: "example.com",
        locationCode: 2840,
        languageCode: "en",
        limit: 100,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"target":"example.com"'),
        }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].keyword).toBe("sauna heater");
      expect(result.billing.costUsd).toBe(0.05);
    });

    it("returns empty array when no keywords found", async () => {
      const mockResponse = {
        status_code: 20000,
        status_message: "Ok.",
        tasks: [
          {
            id: "task-1",
            status_code: 20000,
            status_message: "Ok.",
            path: [
              "v3",
              "dataforseo_labs",
              "google",
              "keywords_for_site",
              "live",
            ],
            cost: 0.02,
            result_count: 0,
            result: [{ items: [] }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await fetchKeywordsForSiteRaw({
        target: "no-rankings.com",
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.data).toHaveLength(0);
      expect(result.billing.costUsd).toBe(0.02);
    });

    it("returns billing metadata with path and result count", async () => {
      const mockResponse = {
        status_code: 20000,
        status_message: "Ok.",
        tasks: [
          {
            id: "task-1",
            status_code: 20000,
            status_message: "Ok.",
            path: [
              "v3",
              "dataforseo_labs",
              "google",
              "keywords_for_site",
              "live",
            ],
            cost: 0.08,
            result_count: 50,
            result: [{ items: [] }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await fetchKeywordsForSiteRaw({
        target: "example.com",
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.billing).toEqual({
        path: [
          "v3",
          "dataforseo_labs",
          "google",
          "keywords_for_site",
          "live",
        ],
        costUsd: 0.08,
        resultCount: 50,
      });
    });
  });

  describe("fetchCompetitorsDomainRaw", () => {
    it("calls correct endpoint and returns competitor list", async () => {
      const mockResponse = {
        status_code: 20000,
        status_message: "Ok.",
        tasks: [
          {
            id: "task-2",
            status_code: 20000,
            status_message: "Ok.",
            path: [
              "v3",
              "dataforseo_labs",
              "google",
              "competitors_domain",
              "live",
            ],
            cost: 0.05,
            result_count: 2,
            result: [
              {
                items: [
                  {
                    domain: "competitor1.com",
                    avg_position: 5.5,
                    sum_position: 550,
                    intersections: 100,
                  },
                  {
                    domain: "competitor2.com",
                    avg_position: 8.2,
                    sum_position: 820,
                    intersections: 75,
                  },
                ],
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await fetchCompetitorsDomainRaw({
        target: "example.com",
        locationCode: 2840,
        languageCode: "en",
        limit: 20,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"target":"example.com"'),
        }),
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].domain).toBe("competitor1.com");
      expect(result.data[0].intersections).toBe(100);
      expect(result.billing.costUsd).toBe(0.05);
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(
        fetchCompetitorsDomainRaw({
          target: "example.com",
          locationCode: 2840,
          languageCode: "en",
        }),
      ).rejects.toThrow("DataForSEO HTTP 500");
    });

    it("returns billing metadata for competitor queries", async () => {
      const mockResponse = {
        status_code: 20000,
        status_message: "Ok.",
        tasks: [
          {
            id: "task-2",
            status_code: 20000,
            status_message: "Ok.",
            path: [
              "v3",
              "dataforseo_labs",
              "google",
              "competitors_domain",
              "live",
            ],
            cost: 0.06,
            result_count: 15,
            result: [{ items: [] }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      });

      const result = await fetchCompetitorsDomainRaw({
        target: "example.com",
        locationCode: 2840,
        languageCode: "en",
      });

      expect(result.billing).toEqual({
        path: [
          "v3",
          "dataforseo_labs",
          "google",
          "competitors_domain",
          "live",
        ],
        costUsd: 0.06,
        resultCount: 15,
      });
    });
  });
});
