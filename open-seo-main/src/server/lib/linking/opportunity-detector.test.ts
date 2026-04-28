/**
 * Tests for opportunity detection.
 * Phase 35-02: Opportunity Detection
 */
import { describe, it, expect } from "vitest";
import {
  detectOpportunities,
  detectDepthReductionOpportunities,
  detectOrphanRescueOpportunities,
  detectLinkVelocityOpportunities,
  detectAnchorDiversityOpportunities,
  type PageMetrics,
  type OrphanPage,
  type DetectOpportunitiesParams,
  MAX_OPPORTUNITIES_PER_AUDIT,
} from "./opportunity-detector";

describe("opportunity-detector", () => {
  const baseParams = {
    clientId: "client-1",
    auditId: "audit-1",
  };

  describe("detectDepthReductionOpportunities", () => {
    it("creates opportunity for pages with depth > 3", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/deep",
          clickDepthFromHome: 5,
          inboundTotal: 10,
          inboundExactMatch: 2,
        },
      ];

      const opportunities = detectDepthReductionOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].opportunityType).toBe("depth_reduction");
      expect(opportunities[0].pageUrl).toBe("https://example.com/deep");
      expect(opportunities[0].currentDepth).toBe(5);
      expect(opportunities[0].targetDepth).toBe(3); // Target is always 3
      expect(opportunities[0].reason).toContain("5 clicks");
    });

    it("does not create opportunity for pages with depth <= 3", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/shallow",
          clickDepthFromHome: 3,
          inboundTotal: 10,
          inboundExactMatch: 2,
        },
        {
          pageId: "page-2",
          pageUrl: "https://example.com/closer",
          clickDepthFromHome: 2,
          inboundTotal: 5,
          inboundExactMatch: 1,
        },
      ];

      const opportunities = detectDepthReductionOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(0);
    });

    it("calculates urgency based on depth", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/depth4",
          clickDepthFromHome: 4,
          inboundTotal: 10,
          inboundExactMatch: 2,
        },
        {
          pageId: "page-2",
          pageUrl: "https://example.com/depth8",
          clickDepthFromHome: 8,
          inboundTotal: 10,
          inboundExactMatch: 2,
        },
      ];

      const opportunities = detectDepthReductionOpportunities({
        ...baseParams,
        pageMetrics,
      });

      // Deeper pages should have higher urgency
      const depth4 = opportunities.find((o) => o.pageUrl.includes("depth4"));
      const depth8 = opportunities.find((o) => o.pageUrl.includes("depth8"));

      expect(depth8!.urgency!).toBeGreaterThan(depth4!.urgency!);
    });

    it("skips pages with null or infinite depth", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/null-depth",
          clickDepthFromHome: null,
          inboundTotal: 10,
          inboundExactMatch: 2,
        },
      ];

      const opportunities = detectDepthReductionOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(0);
    });
  });

  describe("detectOrphanRescueOpportunities", () => {
    it("creates high-urgency opportunity for orphan pages", () => {
      const orphanPages: OrphanPage[] = [
        {
          pageId: "orphan-1",
          pageUrl: "https://example.com/orphan",
          pageTitle: "Orphan Page",
        },
      ];

      const opportunities = detectOrphanRescueOpportunities({
        ...baseParams,
        orphanPages,
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].opportunityType).toBe("orphan_rescue");
      expect(opportunities[0].pageUrl).toBe("https://example.com/orphan");
      expect(opportunities[0].urgency).toBe(1.0); // Maximum urgency
      expect(opportunities[0].reason).toContain("zero inbound internal links");
    });

    it("returns empty array when no orphan pages", () => {
      const opportunities = detectOrphanRescueOpportunities({
        ...baseParams,
        orphanPages: [],
      });

      expect(opportunities).toHaveLength(0);
    });

    it("includes page title in reason when available", () => {
      const orphanPages: OrphanPage[] = [
        {
          pageId: "orphan-1",
          pageUrl: "https://example.com/orphan",
          pageTitle: "Important Product Page",
        },
      ];

      const opportunities = detectOrphanRescueOpportunities({
        ...baseParams,
        orphanPages,
      });

      expect(opportunities[0].reason).toContain("Important Product Page");
    });
  });

  describe("detectLinkVelocityOpportunities", () => {
    it("creates opportunity for pages with < 40 inbound links", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/low-links",
          clickDepthFromHome: 2,
          inboundTotal: 10,
          inboundExactMatch: 2,
        },
      ];

      const opportunities = detectLinkVelocityOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].opportunityType).toBe("link_velocity");
      expect(opportunities[0].currentInboundCount).toBe(10);
      expect(opportunities[0].reason).toContain("10 inbound links");
    });

    it("does not create opportunity for pages with >= 40 inbound links", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/many-links",
          clickDepthFromHome: 2,
          inboundTotal: 50,
          inboundExactMatch: 10,
        },
      ];

      const opportunities = detectLinkVelocityOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(0);
    });

    it("calculates urgency inversely to link count", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/few",
          clickDepthFromHome: 2,
          inboundTotal: 5,
          inboundExactMatch: 1,
        },
        {
          pageId: "page-2",
          pageUrl: "https://example.com/more",
          clickDepthFromHome: 2,
          inboundTotal: 30,
          inboundExactMatch: 5,
        },
      ];

      const opportunities = detectLinkVelocityOpportunities({
        ...baseParams,
        pageMetrics,
      });

      const fewLinks = opportunities.find((o) => o.pageUrl.includes("few"));
      const moreLinks = opportunities.find((o) => o.pageUrl.includes("more"));

      // Fewer links = higher urgency
      expect(fewLinks!.urgency!).toBeGreaterThan(moreLinks!.urgency!);
    });
  });

  describe("detectAnchorDiversityOpportunities", () => {
    it("creates opportunity for pages with 0 exact-match anchors", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/no-exact",
          clickDepthFromHome: 2,
          inboundTotal: 20,
          inboundExactMatch: 0,
        },
      ];

      const opportunities = detectAnchorDiversityOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].opportunityType).toBe("anchor_diversity");
      expect(opportunities[0].currentExactMatchCount).toBe(0);
      expect(opportunities[0].reason).toContain("exact-match anchor");
    });

    it("does not create opportunity for pages with exact-match anchors", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/has-exact",
          clickDepthFromHome: 2,
          inboundTotal: 20,
          inboundExactMatch: 3,
        },
      ];

      const opportunities = detectAnchorDiversityOpportunities({
        ...baseParams,
        pageMetrics,
      });

      expect(opportunities).toHaveLength(0);
    });

    it("sets appropriate urgency based on inbound count", () => {
      const pageMetrics: PageMetrics[] = [
        {
          pageId: "page-1",
          pageUrl: "https://example.com/many-generic",
          clickDepthFromHome: 2,
          inboundTotal: 50,
          inboundExactMatch: 0,
        },
        {
          pageId: "page-2",
          pageUrl: "https://example.com/few-generic",
          clickDepthFromHome: 2,
          inboundTotal: 5,
          inboundExactMatch: 0,
        },
      ];

      const opportunities = detectAnchorDiversityOpportunities({
        ...baseParams,
        pageMetrics,
      });

      const manyGeneric = opportunities.find((o) =>
        o.pageUrl.includes("many-generic")
      );
      const fewGeneric = opportunities.find((o) =>
        o.pageUrl.includes("few-generic")
      );

      // More links without exact match = higher opportunity (higher urgency)
      expect(manyGeneric!.urgency!).toBeGreaterThan(fewGeneric!.urgency!);
    });
  });

  describe("detectOpportunities (combined)", () => {
    it("combines all opportunity types", () => {
      const params: DetectOpportunitiesParams = {
        ...baseParams,
        pageMetrics: [
          {
            pageId: "deep-page",
            pageUrl: "https://example.com/deep",
            clickDepthFromHome: 6,
            inboundTotal: 5,
            inboundExactMatch: 0,
          },
        ],
        orphanPages: [
          {
            pageId: "orphan",
            pageUrl: "https://example.com/orphan",
            pageTitle: "Orphan",
          },
        ],
      };

      const result = detectOpportunities(params);

      // Should have depth_reduction, link_velocity, anchor_diversity for deep-page
      // Plus orphan_rescue for orphan page
      const types = result.opportunities.map((o) => o.opportunityType);
      expect(types).toContain("depth_reduction");
      expect(types).toContain("orphan_rescue");
      expect(types).toContain("link_velocity");
      expect(types).toContain("anchor_diversity");
    });

    it("caps opportunities at MAX_OPPORTUNITIES_PER_AUDIT (1000)", () => {
      // Create many pages that will generate opportunities
      const pageMetrics: PageMetrics[] = [];
      for (let i = 0; i < 500; i++) {
        pageMetrics.push({
          pageId: `page-${i}`,
          pageUrl: `https://example.com/page${i}`,
          clickDepthFromHome: 5, // depth_reduction opportunity
          inboundTotal: 5, // link_velocity opportunity
          inboundExactMatch: 0, // anchor_diversity opportunity
        });
      }

      const params: DetectOpportunitiesParams = {
        ...baseParams,
        pageMetrics,
        orphanPages: [],
      };

      const result = detectOpportunities(params);

      // Each page generates 3 opportunities (depth, velocity, anchor)
      // 500 pages * 3 = 1500 opportunities, but capped at 1000
      expect(result.opportunities.length).toBeLessThanOrEqual(
        MAX_OPPORTUNITIES_PER_AUDIT
      );
      expect(result.cappedAtLimit).toBe(true);
    });

    it("prioritizes higher urgency opportunities when capping", () => {
      // Create orphan pages (urgency 1.0) and low-priority pages
      const pageMetrics: PageMetrics[] = [];
      for (let i = 0; i < 200; i++) {
        pageMetrics.push({
          pageId: `page-${i}`,
          pageUrl: `https://example.com/page${i}`,
          clickDepthFromHome: 4, // Low urgency depth reduction
          inboundTotal: 35, // Low urgency link velocity
          inboundExactMatch: 0, // anchor_diversity
        });
      }

      const orphanPages: OrphanPage[] = [];
      for (let i = 0; i < 100; i++) {
        orphanPages.push({
          pageId: `orphan-${i}`,
          pageUrl: `https://example.com/orphan${i}`,
          pageTitle: `Orphan ${i}`,
        });
      }

      const params: DetectOpportunitiesParams = {
        ...baseParams,
        pageMetrics,
        orphanPages,
      };

      const result = detectOpportunities(params);

      // Orphan rescue (urgency 1.0) should be prioritized
      const orphanCount = result.opportunities.filter(
        (o) => o.opportunityType === "orphan_rescue"
      ).length;

      // All 100 orphan opportunities should be included
      expect(orphanCount).toBe(100);
    });

    it("returns statistics about detection", () => {
      const params: DetectOpportunitiesParams = {
        ...baseParams,
        pageMetrics: [
          {
            pageId: "page-1",
            pageUrl: "https://example.com/page1",
            clickDepthFromHome: 5,
            inboundTotal: 10,
            inboundExactMatch: 0,
          },
        ],
        orphanPages: [
          {
            pageId: "orphan-1",
            pageUrl: "https://example.com/orphan",
            pageTitle: "Orphan",
          },
        ],
      };

      const result = detectOpportunities(params);

      expect(result.stats.depthReduction).toBeGreaterThanOrEqual(1);
      expect(result.stats.orphanRescue).toBe(1);
      expect(result.stats.linkVelocity).toBeGreaterThanOrEqual(1);
      expect(result.stats.anchorDiversity).toBeGreaterThanOrEqual(1);
      expect(result.stats.total).toBe(result.opportunities.length);
    });

    it("handles empty inputs gracefully", () => {
      const params: DetectOpportunitiesParams = {
        ...baseParams,
        pageMetrics: [],
        orphanPages: [],
      };

      const result = detectOpportunities(params);

      expect(result.opportunities).toHaveLength(0);
      expect(result.stats.total).toBe(0);
      expect(result.cappedAtLimit).toBe(false);
    });

    it("generates unique IDs for each opportunity", () => {
      const params: DetectOpportunitiesParams = {
        ...baseParams,
        pageMetrics: [
          {
            pageId: "page-1",
            pageUrl: "https://example.com/page1",
            clickDepthFromHome: 5,
            inboundTotal: 10,
            inboundExactMatch: 0,
          },
        ],
        orphanPages: [],
      };

      const result = detectOpportunities(params);

      const ids = result.opportunities.map((o) => o.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
