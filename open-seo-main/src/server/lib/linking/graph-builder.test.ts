import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildLinkGraph,
  computePageLinkMetrics,
  detectOrphanPages,
  createLinkGraphEntry,
  aggregateInboundMetrics,
  aggregateOutboundMetrics,
} from "./graph-builder";
import type { DetailedLink } from "./types";
import type { LinkGraphInsert, PageLinksInsert, OrphanPagesInsert } from "@/db/link-schema";

describe("graph-builder", () => {
  describe("createLinkGraphEntry", () => {
    it("creates a link graph entry from detailed link", () => {
      const link: DetailedLink = {
        targetUrl: "https://example.com/page2",
        targetPageId: "page-2",
        anchorText: "Click Here",
        context: "Check out Click Here for more info",
        position: "body",
        paragraphIndex: 1,
        isDoFollow: true,
        linkType: "contextual",
        hasTitle: false,
        hasNoOpener: false,
      };

      const entry = createLinkGraphEntry({
        link,
        clientId: "client-1",
        auditId: "audit-1",
        sourceUrl: "https://example.com/page1",
        sourcePageId: "page-1",
      });

      expect(entry.clientId).toBe("client-1");
      expect(entry.auditId).toBe("audit-1");
      expect(entry.sourceUrl).toBe("https://example.com/page1");
      expect(entry.sourcePageId).toBe("page-1");
      expect(entry.targetUrl).toBe("https://example.com/page2");
      expect(entry.targetPageId).toBe("page-2");
      expect(entry.anchorText).toBe("Click Here");
      expect(entry.anchorTextLower).toBe("click here");
      expect(entry.anchorContext).toBe("Check out Click Here for more info");
      expect(entry.position).toBe("body");
      expect(entry.paragraphIndex).toBe(1);
      expect(entry.isFirstParagraph).toBe(true);
      expect(entry.isSecondParagraph).toBe(false);
      expect(entry.isDoFollow).toBe(true);
      expect(entry.linkType).toBe("contextual");
      expect(entry.hasTitle).toBe(false);
      expect(entry.hasNoOpener).toBe(false);
    });

    it("sets isSecondParagraph correctly", () => {
      const link: DetailedLink = {
        targetUrl: "https://example.com/page2",
        targetPageId: null,
        anchorText: "Link",
        context: "",
        position: "body",
        paragraphIndex: 2,
        isDoFollow: true,
        linkType: "contextual",
        hasTitle: false,
        hasNoOpener: false,
      };

      const entry = createLinkGraphEntry({
        link,
        clientId: "client-1",
        auditId: "audit-1",
        sourceUrl: "https://example.com/page1",
        sourcePageId: null,
      });

      expect(entry.isFirstParagraph).toBe(false);
      expect(entry.isSecondParagraph).toBe(true);
    });

    it("detects URL anchor text", () => {
      const link: DetailedLink = {
        targetUrl: "https://example.com/page2",
        targetPageId: null,
        anchorText: "https://example.com/page2",
        context: "",
        position: "body",
        paragraphIndex: null,
        isDoFollow: true,
        linkType: "contextual",
        hasTitle: false,
        hasNoOpener: false,
      };

      const entry = createLinkGraphEntry({
        link,
        clientId: "client-1",
        auditId: "audit-1",
        sourceUrl: "https://example.com/page1",
        sourcePageId: null,
      });

      expect(entry.isUrl).toBe(true);
    });
  });

  describe("aggregateInboundMetrics", () => {
    it("aggregates inbound metrics from link entries", () => {
      const links: Array<Partial<LinkGraphInsert>> = [
        { targetUrl: "https://example.com/page1", position: "body", isDoFollow: true, isFirstParagraph: true, isExactMatch: true, isBranded: false },
        { targetUrl: "https://example.com/page1", position: "body", isDoFollow: true, isFirstParagraph: false, isExactMatch: false, isBranded: true },
        { targetUrl: "https://example.com/page1", position: "nav", isDoFollow: true, isFirstParagraph: false, isExactMatch: false, isBranded: false },
        { targetUrl: "https://example.com/page1", position: "footer", isDoFollow: false, isFirstParagraph: false, isExactMatch: false, isBranded: false },
        { targetUrl: "https://example.com/page1", position: "sidebar", isDoFollow: true, isFirstParagraph: false, isExactMatch: false, isBranded: false },
      ];

      const metrics = aggregateInboundMetrics(links as LinkGraphInsert[]);

      expect(metrics.inboundTotal).toBe(5);
      expect(metrics.inboundBody).toBe(2);
      expect(metrics.inboundNav).toBe(1);
      expect(metrics.inboundFooter).toBe(1);
      expect(metrics.inboundSidebar).toBe(1);
      expect(metrics.inboundFirstParagraph).toBe(1);
      expect(metrics.inboundExactMatch).toBe(1);
      expect(metrics.inboundBranded).toBe(1);
      expect(metrics.inboundDoFollow).toBe(4);
    });

    it("returns zero metrics for empty array", () => {
      const metrics = aggregateInboundMetrics([]);

      expect(metrics.inboundTotal).toBe(0);
      expect(metrics.inboundBody).toBe(0);
    });
  });

  describe("aggregateOutboundMetrics", () => {
    it("aggregates outbound metrics from link entries", () => {
      const links: Array<Partial<LinkGraphInsert>> = [
        { sourceUrl: "https://example.com/page1", position: "body" },
        { sourceUrl: "https://example.com/page1", position: "body" },
        { sourceUrl: "https://example.com/page1", position: "nav" },
      ];

      const metrics = aggregateOutboundMetrics(
        links as LinkGraphInsert[],
        5 // total outbound including external
      );

      expect(metrics.outboundTotal).toBe(5);
      expect(metrics.outboundBody).toBe(2);
      expect(metrics.outboundInternal).toBe(3);
      expect(metrics.outboundExternal).toBe(2); // 5 total - 3 internal
    });
  });

  describe("computePageLinkMetrics", () => {
    it("computes anchor distribution percentages", () => {
      const links: Array<Partial<LinkGraphInsert>> = [
        { targetUrl: "https://example.com/page1", anchorText: "click here" },
        { targetUrl: "https://example.com/page1", anchorText: "click here" },
        { targetUrl: "https://example.com/page1", anchorText: "learn more" },
        { targetUrl: "https://example.com/page1", anchorText: "read this" },
      ];

      const result = computePageLinkMetrics({
        pageUrl: "https://example.com/page1",
        inboundLinks: links as LinkGraphInsert[],
        outboundLinks: [],
        totalOutbound: 0,
      });

      expect(result.uniqueAnchors).toBe(3);
      expect(result.anchorDistribution).toEqual({
        "click here": 50,
        "learn more": 25,
        "read this": 25,
      });
      expect(result.topAnchors).toHaveLength(3);
      expect(result.topAnchors![0]).toEqual({ anchor: "click here", count: 2 });
    });

    it("limits top anchors to 10", () => {
      const links: Array<Partial<LinkGraphInsert>> = [];
      for (let i = 0; i < 15; i++) {
        links.push({
          targetUrl: "https://example.com/page1",
          anchorText: `anchor ${i}`,
        });
      }

      const result = computePageLinkMetrics({
        pageUrl: "https://example.com/page1",
        inboundLinks: links as LinkGraphInsert[],
        outboundLinks: [],
        totalOutbound: 0,
      });

      expect(result.uniqueAnchors).toBe(15);
      expect(result.topAnchors).toHaveLength(10);
    });
  });

  describe("detectOrphanPages", () => {
    it("identifies pages with zero inbound links", () => {
      const allPages = [
        { pageId: "page-1", pageUrl: "https://example.com/page1", pageTitle: "Page 1" },
        { pageId: "page-2", pageUrl: "https://example.com/page2", pageTitle: "Page 2" },
        { pageId: "page-3", pageUrl: "https://example.com/page3", pageTitle: "Page 3" },
      ];

      const pagesWithInboundLinks = new Set(["page-1", "page-2"]);

      const orphans = detectOrphanPages({
        clientId: "client-1",
        auditId: "audit-1",
        allPages,
        pagesWithInboundLinks,
        discoverySource: "sitemap",
      });

      expect(orphans).toHaveLength(1);
      expect(orphans[0].pageId).toBe("page-3");
      expect(orphans[0].pageUrl).toBe("https://example.com/page3");
      expect(orphans[0].pageTitle).toBe("Page 3");
      expect(orphans[0].status).toBe("detected");
      expect(orphans[0].discoverySource).toBe("sitemap");
    });

    it("returns empty array when all pages have inbound links", () => {
      const allPages = [
        { pageId: "page-1", pageUrl: "https://example.com/page1", pageTitle: "Page 1" },
      ];

      const pagesWithInboundLinks = new Set(["page-1"]);

      const orphans = detectOrphanPages({
        clientId: "client-1",
        auditId: "audit-1",
        allPages,
        pagesWithInboundLinks,
        discoverySource: "sitemap",
      });

      expect(orphans).toHaveLength(0);
    });

    it("handles homepage exclusion (pages with / as path)", () => {
      const allPages = [
        { pageId: "home", pageUrl: "https://example.com/", pageTitle: "Home" },
        { pageId: "page-1", pageUrl: "https://example.com/page1", pageTitle: "Page 1" },
      ];

      const pagesWithInboundLinks = new Set<string>(); // No inbound links

      const orphans = detectOrphanPages({
        clientId: "client-1",
        auditId: "audit-1",
        allPages,
        pagesWithInboundLinks,
        discoverySource: "sitemap",
      });

      // Homepage should not be marked as orphan (it's the root)
      expect(orphans).toHaveLength(1);
      expect(orphans[0].pageUrl).toBe("https://example.com/page1");
    });
  });

  describe("buildLinkGraph", () => {
    it("exports buildLinkGraph function", () => {
      expect(typeof buildLinkGraph).toBe("function");
    });

    it("has correct function signature", () => {
      // Type check: buildLinkGraph should accept correct params
      const params = {
        auditId: "audit-1",
        clientId: "client-1",
        pages: [],
        getPageHtml: async () => null,
      };

      // Should not throw type error
      expect(() => buildLinkGraph(params)).not.toThrow();
    });
  });
});
