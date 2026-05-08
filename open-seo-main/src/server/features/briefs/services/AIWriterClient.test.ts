import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildArticleTitle,
  createArticleFromBrief,
  getArticleStatus,
  getArticle,
  triggerArticleGeneration,
} from "./AIWriterClient";
import type { ContentBriefSelect } from "@/db/brief-schema";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AIWriterClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("buildArticleTitle", () => {
    it("capitalizes each word and appends year", () => {
      const result = buildArticleTitle("best seo tools");
      const year = new Date().getFullYear();
      expect(result).toBe(`Best Seo Tools - Complete Guide ${year}`);
    });

    it("handles single word keyword", () => {
      const result = buildArticleTitle("seo");
      const year = new Date().getFullYear();
      expect(result).toBe(`Seo - Complete Guide ${year}`);
    });

    it("handles already capitalized keywords", () => {
      const result = buildArticleTitle("SEO Marketing");
      const year = new Date().getFullYear();
      expect(result).toBe(`Seo Marketing - Complete Guide ${year}`);
    });
  });

  describe("createArticleFromBrief", () => {
    const mockBrief: ContentBriefSelect = {
      id: "brief_123",
      mappingId: "mapping_456",
      keyword: "best seo practices",
      targetWordCount: 2000,
      voiceMode: "best_practices",
      status: "ready",
      serpAnalysis: {
        commonH2s: [
          { heading: "What is SEO", frequency: 5 },
          { heading: "Benefits of SEO", frequency: 4 },
        ],
        paaQuestions: ["How to do SEO?", "What are SEO tools?"],
        competitorWordCounts: [1500, 1800, 2200],
        metaLengths: { title: 60, description: 155 },
        analyzedAt: "2026-04-23T10:00:00Z",
        location: "US",
      },
      articleId: null,
      isDeleted: false,
      deletedAt: null,
      scrapingCostUsd: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("sends correct payload to AI-Writer API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "article_abc",
          client_id: "client_xyz",
          title: "Best Seo Practices - Complete Guide 2026",
          keyword: "best seo practices",
          status: "draft",
          meta_description: null,
          created_at: "2026-04-23T10:00:00Z",
          updated_at: "2026-04-23T10:00:00Z",
        }),
      });

      await createArticleFromBrief(mockBrief, "client_xyz");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/articles",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.client_id).toBe("client_xyz");
      expect(body.keyword).toBe("best seo practices");
      expect(body.brief_id).toBe("brief_123");
      expect(body.target_word_count).toBe(2000);
      expect(body.voice_mode).toBe("best_practices");
      expect(body.suggested_h2s).toEqual(["What is SEO", "Benefits of SEO"]);
      expect(body.paa_questions).toEqual(["How to do SEO?", "What are SEO tools?"]);
    });

    it("includes keyword and derived title", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "article_abc",
          client_id: "client_xyz",
          title: "Best Seo Practices - Complete Guide 2026",
          keyword: "best seo practices",
          status: "draft",
          meta_description: null,
          created_at: "2026-04-23T10:00:00Z",
          updated_at: "2026-04-23T10:00:00Z",
        }),
      });

      await createArticleFromBrief(mockBrief, "client_xyz");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.keyword).toBe("best seo practices");
      expect(body.title).toContain("Best Seo Practices");
      expect(body.title).toContain("Complete Guide");
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal server error",
      });

      await expect(createArticleFromBrief(mockBrief, "client_xyz")).rejects.toThrow(
        "AI-Writer article creation failed: 500"
      );
    });

    it("handles brief without SERP analysis", async () => {
      const briefNoSerp: ContentBriefSelect = {
        ...mockBrief,
        serpAnalysis: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "article_abc",
          client_id: "client_xyz",
          title: "Test",
          keyword: "best seo practices",
          status: "draft",
          meta_description: null,
          created_at: "2026-04-23T10:00:00Z",
          updated_at: "2026-04-23T10:00:00Z",
        }),
      });

      await createArticleFromBrief(briefNoSerp, "client_xyz");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.suggested_h2s).toEqual([]);
      expect(body.paa_questions).toEqual([]);
    });

    it("BRIEF-02: forwards scraping cost to AI-Writer when available", async () => {
      const briefWithCost: ContentBriefSelect = {
        ...mockBrief,
        scrapingCostUsd: "0.012345",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "article_abc",
          client_id: "client_xyz",
          title: "Test",
          keyword: "best seo practices",
          status: "draft",
          meta_description: null,
          created_at: "2026-04-23T10:00:00Z",
          updated_at: "2026-04-23T10:00:00Z",
        }),
      });

      await createArticleFromBrief(briefWithCost, "client_xyz");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.scraping_cost_usd).toBe(0.012345);
    });

    it("BRIEF-02: omits scraping cost when not available", async () => {
      const briefNoCost: ContentBriefSelect = {
        ...mockBrief,
        scrapingCostUsd: null,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "article_abc",
          client_id: "client_xyz",
          title: "Test",
          keyword: "best seo practices",
          status: "draft",
          meta_description: null,
          created_at: "2026-04-23T10:00:00Z",
          updated_at: "2026-04-23T10:00:00Z",
        }),
      });

      await createArticleFromBrief(briefNoCost, "client_xyz");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.scraping_cost_usd).toBeUndefined();
    });
  });

  describe("getArticleStatus", () => {
    it("returns article status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "article_abc",
          status: "generated",
        }),
      });

      const status = await getArticleStatus("article_abc");
      expect(status).toBe("generated");
    });

    it("throws NOT_FOUND on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(getArticleStatus("nonexistent")).rejects.toThrow(
        "Article nonexistent not found"
      );
    });
  });

  describe("getArticle", () => {
    it("returns full article data", async () => {
      const mockArticle = {
        id: "article_abc",
        client_id: "client_xyz",
        title: "Test Article",
        keyword: "test",
        status: "generated",
        content: "<h1>Test</h1>",
        meta_description: "A test article",
        url: "https://example.com/test",
        created_at: "2026-04-23T10:00:00Z",
        updated_at: "2026-04-23T10:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticle,
      });

      const article = await getArticle("article_abc");
      expect(article).toEqual(mockArticle);
    });
  });

  describe("triggerArticleGeneration", () => {
    it("sends PATCH request with generating status", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await triggerArticleGeneration("article_abc");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/articles/article_abc",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "generating" }),
        })
      );
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => "Generation not allowed",
      });

      await expect(triggerArticleGeneration("article_abc")).rejects.toThrow(
        "Failed to trigger article generation"
      );
    });
  });
});
