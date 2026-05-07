/**
 * DfsDataMapper Tests
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 */

import { describe, it, expect } from "vitest";
import {
  mapDfsResultToParsedData,
  canUsePreparsedOnly,
  getHtmlRequiredChecks,
  getRequiredPreparsedFields,
  calculatePreparsedCoverage,
  validateParsedDataForChecks,
  CHECK_DEPENDENCIES,
} from "./DfsDataMapper";
import type { DfsOnPageResultItem } from "./DataForSEOFetcher.types";

// =============================================================================
// Test Data
// =============================================================================

const createMockDfsResult = (overrides?: Partial<DfsOnPageResultItem>): DfsOnPageResultItem => ({
  url: "https://example.com/page",
  status_code: 200,
  meta: {
    title: "Test Page Title",
    description: "This is a test meta description for the page.",
    canonical: "https://example.com/page",
    robots_txt: "index, follow",
    x_robots_tag: null,
    htags: {
      h1: ["Main Heading"],
      h2: ["Section One", "Section Two"],
      h3: ["Subsection A", "Subsection B"],
      h4: [],
      h5: [],
      h6: [],
    },
    content: {
      plain_text_size: 5000,
      plain_text_rate: 0.35,
      plain_text_word_count: 850,
    },
    language: "en",
    charset: "utf-8",
    open_graph: {
      title: "OG Title",
      description: "OG Description",
      image: "https://example.com/og-image.jpg",
      type: "article",
    },
    twitter_card: {
      card: "summary_large_image",
      title: "Twitter Title",
      description: "Twitter Description",
    },
  },
  links: {
    internal: [
      { url: "https://example.com/about", anchor: "About Us", nofollow: false },
      { url: "https://example.com/contact", anchor: "Contact", nofollow: false },
    ],
    external: [
      { url: "https://external.com/resource", anchor: "Resource", nofollow: true },
    ],
  },
  resources: {
    images: [
      { src: "https://example.com/image1.jpg", alt: "Image 1", size: 50000 },
      { src: "https://example.com/image2.png", alt: "", size: 75000 },
    ],
    scripts: [
      { src: "https://example.com/app.js", size: 125000 },
    ],
    stylesheets: [
      { src: "https://example.com/styles.css", size: 45000 },
    ],
  },
  page_timing: {
    time_to_interactive: 2500,
    dom_complete: 3200,
    largest_contentful_paint: 1800,
    connection_time: 150,
    time_to_secure_connection: 80,
  },
  ...overrides,
});

// =============================================================================
// mapDfsResultToParsedData Tests
// =============================================================================

describe("mapDfsResultToParsedData", () => {
  it("should map meta information correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.title).toBe("Test Page Title");
    expect(result.titleLength).toBe(15);
    expect(result.metaDescription).toBe("This is a test meta description for the page.");
    expect(result.metaDescriptionLength).toBe(45);
    expect(result.canonical).toBe("https://example.com/page");
    expect(result.language).toBe("en");
    expect(result.charset).toBe("utf-8");
  });

  it("should map headings correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.h1).toEqual(["Main Heading"]);
    expect(result.h2).toEqual(["Section One", "Section Two"]);
    expect(result.h3).toEqual(["Subsection A", "Subsection B"]);
    expect(result.h4).toEqual([]);
  });

  it("should map content metrics correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.wordCount).toBe(850);
    expect(result.plainTextSize).toBe(5000);
    expect(result.plainTextRate).toBe(0.35);
  });

  it("should map links correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.internalLinks).toHaveLength(2);
    expect(result.internalLinks[0]).toEqual({
      url: "https://example.com/about",
      anchor: "About Us",
      nofollow: false,
      sponsored: false,
      ugc: false,
    });

    expect(result.externalLinks).toHaveLength(1);
    expect(result.externalLinks[0].nofollow).toBe(true);
  });

  it("should map images correctly when resources present", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.images).toBeDefined();
    expect(result.images).toHaveLength(2);
    expect(result.images![0]).toEqual({
      src: "https://example.com/image1.jpg",
      alt: "Image 1",
      size: 50000,
      width: undefined,
      height: undefined,
    });
  });

  it("should map Open Graph correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.openGraph.title).toBe("OG Title");
    expect(result.openGraph.description).toBe("OG Description");
    expect(result.openGraph.image).toBe("https://example.com/og-image.jpg");
    expect(result.openGraph.type).toBe("article");
  });

  it("should map Twitter Card correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.twitterCard.card).toBe("summary_large_image");
    expect(result.twitterCard.title).toBe("Twitter Title");
  });

  it("should map page timing correctly", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.pageTiming.timeToInteractive).toBe(2500);
    expect(result.pageTiming.domComplete).toBe(3200);
    expect(result.pageTiming.lcp).toBe(1800);
  });

  it("should parse robots directives", () => {
    const result = mapDfsResultToParsedData(createMockDfsResult());

    expect(result.robotsDirectives).toContain("index");
    expect(result.robotsDirectives).toContain("follow");
  });

  it("should handle missing meta gracefully", () => {
    const result = mapDfsResultToParsedData({
      url: "https://example.com",
      status_code: 200,
    });

    expect(result.title).toBe("");
    expect(result.titleLength).toBe(0);
    expect(result.h1).toEqual([]);
    expect(result.wordCount).toBe(0);
    expect(result.internalLinks).toEqual([]);
    expect(result.images).toBeUndefined();
  });
});

// =============================================================================
// canUsePreparsedOnly Tests
// =============================================================================

describe("canUsePreparsedOnly", () => {
  it("should return true for title/meta checks", () => {
    const checks = ["T1-01", "T1-02", "T1-04", "T1-05"];
    expect(canUsePreparsedOnly(checks)).toBe(true);
  });

  it("should return true for heading checks", () => {
    const checks = ["T1-10", "T1-11", "T1-13"];
    expect(canUsePreparsedOnly(checks)).toBe(true);
  });

  it("should return false when HTML-required checks included", () => {
    const checks = ["T1-01", "T1-33"]; // T1-33 needs HTML (keyword-in-strong)
    expect(canUsePreparsedOnly(checks)).toBe(false);
  });

  it("should return false for T5 content quality checks", () => {
    const checks = ["T5-01", "T5-03"]; // E-E-A-T and schema validation
    expect(canUsePreparsedOnly(checks)).toBe(false);
  });

  it("should return true for empty array", () => {
    expect(canUsePreparsedOnly([])).toBe(true);
  });
});

// =============================================================================
// getHtmlRequiredChecks Tests
// =============================================================================

describe("getHtmlRequiredChecks", () => {
  it("should return empty for preparsed-only checks", () => {
    const checks = ["T1-01", "T1-02", "T1-10"];
    expect(getHtmlRequiredChecks(checks)).toEqual([]);
  });

  it("should filter to HTML-required checks", () => {
    const checks = ["T1-01", "T1-33", "T5-01"];
    const htmlRequired = getHtmlRequiredChecks(checks);

    expect(htmlRequired).toContain("T1-33");
    expect(htmlRequired).toContain("T5-01");
    expect(htmlRequired).not.toContain("T1-01");
  });

  it("should return all T5 checks that require HTML", () => {
    const checks = ["T5-01", "T5-02", "T5-03", "T5-04", "T5-05"];
    const htmlRequired = getHtmlRequiredChecks(checks);

    expect(htmlRequired).toHaveLength(5);
  });
});

// =============================================================================
// getRequiredPreparsedFields Tests
// =============================================================================

describe("getRequiredPreparsedFields", () => {
  it("should return title field for title checks", () => {
    const fields = getRequiredPreparsedFields(["T1-01", "T1-02"]);
    expect(fields.has("title")).toBe(true);
    expect(fields.has("titleLength")).toBe(true);
  });

  it("should return heading fields for heading checks", () => {
    const fields = getRequiredPreparsedFields(["T1-13"]);
    expect(fields.has("h1")).toBe(true);
    expect(fields.has("h2")).toBe(true);
    expect(fields.has("h3")).toBe(true);
  });

  it("should return link fields for link checks", () => {
    const fields = getRequiredPreparsedFields(["T1-40", "T1-41"]);
    expect(fields.has("internalLinks")).toBe(true);
    expect(fields.has("externalLinks")).toBe(true);
  });

  it("should return empty set for HTML-only checks", () => {
    const fields = getRequiredPreparsedFields(["T5-01", "T5-03"]);
    expect(fields.size).toBe(0);
  });

  it("should combine fields from multiple checks", () => {
    const fields = getRequiredPreparsedFields(["T1-01", "T1-10", "T1-60"]);
    expect(fields.has("title")).toBe(true);
    expect(fields.has("h1")).toBe(true);
    expect(fields.has("openGraph")).toBe(true);
  });
});

// =============================================================================
// calculatePreparsedCoverage Tests
// =============================================================================

describe("calculatePreparsedCoverage", () => {
  it("should return 100% for all preparsed checks", () => {
    const checks = ["T1-01", "T1-02", "T1-10", "T1-20"];
    expect(calculatePreparsedCoverage(checks)).toBe(100);
  });

  it("should return 0% for all HTML-required checks", () => {
    const checks = ["T5-01", "T5-02", "T5-03"];
    expect(calculatePreparsedCoverage(checks)).toBe(0);
  });

  it("should return 50% for mixed checks", () => {
    const checks = ["T1-01", "T1-02", "T5-01", "T5-02"];
    expect(calculatePreparsedCoverage(checks)).toBe(50);
  });

  it("should return 100% for empty array", () => {
    expect(calculatePreparsedCoverage([])).toBe(100);
  });
});

// =============================================================================
// validateParsedDataForChecks Tests
// =============================================================================

describe("validateParsedDataForChecks", () => {
  it("should pass validation for complete data", () => {
    const parsedData = mapDfsResultToParsedData(createMockDfsResult());
    const checks = ["T1-01", "T1-10", "T1-40"];

    const result = validateParsedDataForChecks(parsedData, checks);
    expect(result.valid).toBe(true);
    expect(result.missingFields).toEqual([]);
  });

  it("should pass validation even with empty arrays", () => {
    const parsedData = mapDfsResultToParsedData({
      url: "https://example.com",
      status_code: 200,
      meta: {
        title: "",
        htags: { h1: [] },
      },
    });
    const checks = ["T1-01", "T1-10"];

    const result = validateParsedDataForChecks(parsedData, checks);
    // Empty strings and arrays are allowed
    expect(result.valid).toBe(true);
  });

  it("should pass validation for HTML-only checks", () => {
    const parsedData = mapDfsResultToParsedData({
      url: "https://example.com",
      status_code: 200,
    });
    const checks = ["T5-01", "T5-03"]; // HTML-required, no preparsed fields needed

    const result = validateParsedDataForChecks(parsedData, checks);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// CHECK_DEPENDENCIES Coverage Tests
// =============================================================================

describe("CHECK_DEPENDENCIES", () => {
  it("should have dependencies defined for T1 checks", () => {
    const t1Checks = Object.keys(CHECK_DEPENDENCIES).filter((k) => k.startsWith("T1-"));
    expect(t1Checks.length).toBeGreaterThan(20);
  });

  it("should have dependencies defined for T3 checks", () => {
    const t3Checks = Object.keys(CHECK_DEPENDENCIES).filter((k) => k.startsWith("T3-"));
    expect(t3Checks.length).toBeGreaterThan(0);
  });

  it("should have dependencies defined for T5 checks", () => {
    const t5Checks = Object.keys(CHECK_DEPENDENCIES).filter((k) => k.startsWith("T5-"));
    expect(t5Checks.length).toBeGreaterThan(10);
  });

  it("should have all T5 checks marked as requiring HTML", () => {
    const t5Checks = Object.entries(CHECK_DEPENDENCIES).filter(([k]) => k.startsWith("T5-"));

    for (const [checkId, deps] of t5Checks) {
      expect(deps.usesRawHtml).toBe(true);
    }
  });

  it("should have preparsedFields array for preparsed checks", () => {
    const preparsedChecks = Object.entries(CHECK_DEPENDENCIES).filter(
      ([, deps]) => deps.usesPreparsed
    );

    for (const [checkId, deps] of preparsedChecks) {
      if (deps.usesRawHtml) continue; // Skip mixed checks
      expect(deps.preparsedFields.length).toBeGreaterThan(0);
    }
  });
});
