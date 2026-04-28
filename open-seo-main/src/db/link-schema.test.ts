import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  linkGraph,
  pageLinks,
  orphanPages,
  LINK_POSITIONS,
  LINK_TYPES,
  ORPHAN_STATUS,
  DISCOVERY_SOURCES,
  type LinkPosition,
  type LinkType,
  type OrphanStatus,
  type DiscoverySource,
  type LinkGraphSelect,
  type LinkGraphInsert,
  type PageLinksSelect,
  type PageLinksInsert,
  type OrphanPagesSelect,
  type OrphanPagesInsert,
} from "./link-schema";

describe("link-schema", () => {
  describe("linkGraph table", () => {
    it("exports linkGraph table", () => {
      expect(linkGraph).toBeDefined();
    });

    it("has correct table name", () => {
      expect(getTableName(linkGraph)).toBe("link_graph");
    });

    it("has all required columns", () => {
      const columns = Object.keys(linkGraph);
      // Core identifiers
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("auditId");
      // Source/target URLs
      expect(columns).toContain("sourceUrl");
      expect(columns).toContain("sourcePageId");
      expect(columns).toContain("targetUrl");
      expect(columns).toContain("targetPageId");
      // Anchor text
      expect(columns).toContain("anchorText");
      expect(columns).toContain("anchorTextLower");
      expect(columns).toContain("anchorContext");
      // Position
      expect(columns).toContain("position");
      expect(columns).toContain("paragraphIndex");
      expect(columns).toContain("isFirstParagraph");
      expect(columns).toContain("isSecondParagraph");
      // Link attributes
      expect(columns).toContain("isDoFollow");
      expect(columns).toContain("hasNoOpener");
      expect(columns).toContain("hasTitle");
      expect(columns).toContain("linkText");
      // Classification
      expect(columns).toContain("linkType");
      expect(columns).toContain("isExactMatch");
      expect(columns).toContain("isBranded");
      expect(columns).toContain("isUrl");
      // Timestamps
      expect(columns).toContain("discoveredAt");
      expect(columns).toContain("verifiedAt");
    });
  });

  describe("pageLinks table", () => {
    it("exports pageLinks table", () => {
      expect(pageLinks).toBeDefined();
    });

    it("has correct table name", () => {
      expect(getTableName(pageLinks)).toBe("page_links");
    });

    it("has all inbound metrics columns", () => {
      const columns = Object.keys(pageLinks);
      expect(columns).toContain("inboundTotal");
      expect(columns).toContain("inboundBody");
      expect(columns).toContain("inboundNav");
      expect(columns).toContain("inboundFooter");
      expect(columns).toContain("inboundSidebar");
      expect(columns).toContain("inboundFirstParagraph");
      expect(columns).toContain("inboundExactMatch");
      expect(columns).toContain("inboundBranded");
      expect(columns).toContain("inboundDoFollow");
    });

    it("has all outbound metrics columns", () => {
      const columns = Object.keys(pageLinks);
      expect(columns).toContain("outboundTotal");
      expect(columns).toContain("outboundBody");
      expect(columns).toContain("outboundInternal");
      expect(columns).toContain("outboundExternal");
    });

    it("has anchor distribution columns", () => {
      const columns = Object.keys(pageLinks);
      expect(columns).toContain("uniqueAnchors");
      expect(columns).toContain("anchorDistribution");
      expect(columns).toContain("topAnchors");
    });

    it("has score and depth columns", () => {
      const columns = Object.keys(pageLinks);
      expect(columns).toContain("clickDepthFromHome");
      expect(columns).toContain("linkScore");
      expect(columns).toContain("opportunityScore");
      expect(columns).toContain("computedAt");
    });
  });

  describe("orphanPages table", () => {
    it("exports orphanPages table", () => {
      expect(orphanPages).toBeDefined();
    });

    it("has correct table name", () => {
      expect(getTableName(orphanPages)).toBe("orphan_pages");
    });

    it("has all required columns", () => {
      const columns = Object.keys(orphanPages);
      // Core identifiers
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("auditId");
      expect(columns).toContain("pageId");
      expect(columns).toContain("pageUrl");
      expect(columns).toContain("pageTitle");
      // Discovery
      expect(columns).toContain("discoverySource");
      expect(columns).toContain("searchVolume");
      expect(columns).toContain("monthlyTraffic");
      expect(columns).toContain("targetKeyword");
      // Status
      expect(columns).toContain("status");
      expect(columns).toContain("fixedAt");
      expect(columns).toContain("fixedByChangeId");
      expect(columns).toContain("detectedAt");
    });
  });

  describe("constant exports", () => {
    it("LINK_POSITIONS contains all position types", () => {
      expect(LINK_POSITIONS).toContain("body");
      expect(LINK_POSITIONS).toContain("sidebar");
      expect(LINK_POSITIONS).toContain("footer");
      expect(LINK_POSITIONS).toContain("nav");
      expect(LINK_POSITIONS).toContain("header");
      expect(LINK_POSITIONS).toHaveLength(5);
    });

    it("LINK_TYPES contains all link types", () => {
      expect(LINK_TYPES).toContain("contextual");
      expect(LINK_TYPES).toContain("nav");
      expect(LINK_TYPES).toContain("footer");
      expect(LINK_TYPES).toContain("sidebar");
      expect(LINK_TYPES).toContain("image");
      expect(LINK_TYPES).toHaveLength(5);
    });

    it("ORPHAN_STATUS contains all status values", () => {
      expect(ORPHAN_STATUS).toContain("detected");
      expect(ORPHAN_STATUS).toContain("fixed");
      expect(ORPHAN_STATUS).toContain("ignored");
      expect(ORPHAN_STATUS).toHaveLength(3);
    });

    it("DISCOVERY_SOURCES contains all sources", () => {
      expect(DISCOVERY_SOURCES).toContain("sitemap");
      expect(DISCOVERY_SOURCES).toContain("gsc");
      expect(DISCOVERY_SOURCES).toContain("manual");
      expect(DISCOVERY_SOURCES).toHaveLength(3);
    });
  });

  describe("type exports", () => {
    it("LinkPosition type is correctly defined", () => {
      const position: LinkPosition = "body";
      expect(LINK_POSITIONS).toContain(position);
    });

    it("LinkType type is correctly defined", () => {
      const linkType: LinkType = "contextual";
      expect(LINK_TYPES).toContain(linkType);
    });

    it("OrphanStatus type is correctly defined", () => {
      const status: OrphanStatus = "detected";
      expect(ORPHAN_STATUS).toContain(status);
    });

    it("DiscoverySource type is correctly defined", () => {
      const source: DiscoverySource = "sitemap";
      expect(DISCOVERY_SOURCES).toContain(source);
    });

    it("LinkGraphSelect is exportable", () => {
      const selectType: Partial<LinkGraphSelect> = {
        id: "link-1",
        sourceUrl: "https://example.com/page1",
        targetUrl: "https://example.com/page2",
        anchorText: "click here",
      };
      expect(selectType.id).toBe("link-1");
    });

    it("LinkGraphInsert is exportable", () => {
      const insertType: Partial<LinkGraphInsert> = {
        id: "link-1",
        clientId: "client-1",
        auditId: "audit-1",
        sourceUrl: "https://example.com/page1",
        targetUrl: "https://example.com/page2",
      };
      expect(insertType.sourceUrl).toBe("https://example.com/page1");
    });

    it("PageLinksSelect is exportable", () => {
      const selectType: Partial<PageLinksSelect> = {
        id: "pl-1",
        pageUrl: "https://example.com/page",
        inboundTotal: 5,
      };
      expect(selectType.inboundTotal).toBe(5);
    });

    it("PageLinksInsert is exportable", () => {
      const insertType: Partial<PageLinksInsert> = {
        id: "pl-1",
        clientId: "client-1",
        auditId: "audit-1",
        pageId: "page-1",
        pageUrl: "https://example.com/page",
      };
      expect(insertType.pageUrl).toBe("https://example.com/page");
    });

    it("OrphanPagesSelect is exportable", () => {
      const selectType: Partial<OrphanPagesSelect> = {
        id: "orphan-1",
        pageUrl: "https://example.com/orphan",
        status: "detected",
      };
      expect(selectType.status).toBe("detected");
    });

    it("OrphanPagesInsert is exportable", () => {
      const insertType: Partial<OrphanPagesInsert> = {
        id: "orphan-1",
        clientId: "client-1",
        auditId: "audit-1",
        pageId: "page-1",
        pageUrl: "https://example.com/orphan",
        discoverySource: "sitemap",
      };
      expect(insertType.discoverySource).toBe("sitemap");
    });
  });
});
