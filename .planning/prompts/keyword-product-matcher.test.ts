/**
 * Tests for Keyword-to-Product Matcher utilities
 */

import { describe, it, expect } from "vitest";
import {
  normalizeColorCode,
  colorCodesMatch,
  extractColorCode,
  normalizeBrand,
  parseMatcherResponse,
  getConfidenceLevel,
  type MatcherResponse,
} from "./keyword-product-matcher";

describe("Color Code Normalization", () => {
  describe("normalizeColorCode", () => {
    it("should normalize slash notation", () => {
      expect(normalizeColorCode("6/0")).toBe("6/0");
      expect(normalizeColorCode("06/0")).toBe("6/0"); // Leading zero
    });

    it("should convert dot notation to slash", () => {
      expect(normalizeColorCode("6.0")).toBe("6/0");
      expect(normalizeColorCode("7.1")).toBe("7/1");
    });

    it("should convert dash notation to slash", () => {
      expect(normalizeColorCode("6-0")).toBe("6/0");
      expect(normalizeColorCode("7-1")).toBe("7/1");
    });

    it("should convert letter codes to numeric", () => {
      expect(normalizeColorCode("6N")).toBe("6/0"); // Natural
      expect(normalizeColorCode("7A")).toBe("7/1"); // Ash
      expect(normalizeColorCode("8G")).toBe("8/3"); // Gold
      expect(normalizeColorCode("5V")).toBe("5/2"); // Violet
      expect(normalizeColorCode("6C")).toBe("6/4"); // Copper
      expect(normalizeColorCode("7M")).toBe("7/5"); // Mahogany
      expect(normalizeColorCode("8R")).toBe("8/6"); // Red
      expect(normalizeColorCode("9B")).toBe("9/7"); // Brown
    });

    it("should handle lowercase letter codes", () => {
      expect(normalizeColorCode("6n")).toBe("6/0");
      expect(normalizeColorCode("7a")).toBe("7/1");
    });

    it("should handle spaces", () => {
      expect(normalizeColorCode("6 / 0")).toBe("6/0");
      expect(normalizeColorCode(" 7.1 ")).toBe("7/1");
    });

    it("should return empty string for empty input", () => {
      expect(normalizeColorCode("")).toBe("");
    });
  });

  describe("colorCodesMatch", () => {
    it("should match identical codes", () => {
      expect(colorCodesMatch("6/0", "6/0")).toBe(true);
    });

    it("should match different notations", () => {
      expect(colorCodesMatch("6/0", "6.0")).toBe(true);
      expect(colorCodesMatch("6/0", "6-0")).toBe(true);
      expect(colorCodesMatch("6.0", "6-0")).toBe(true);
    });

    it("should match letter to numeric codes", () => {
      expect(colorCodesMatch("6N", "6/0")).toBe(true);
      expect(colorCodesMatch("7A", "7.1")).toBe(true);
      expect(colorCodesMatch("8G", "8-3")).toBe(true);
    });

    it("should not match different codes", () => {
      expect(colorCodesMatch("6/0", "6/1")).toBe(false);
      expect(colorCodesMatch("6N", "7N")).toBe(false);
      expect(colorCodesMatch("6/0", "7/0")).toBe(false);
    });
  });

  describe("extractColorCode", () => {
    it("should extract slash notation", () => {
      expect(extractColorCode("Majirel 6/0 Deep Dark Blonde")).toBe("6/0");
      expect(extractColorCode("Igora Royal 7/1 Ash Blonde")).toBe("7/1");
    });

    it("should extract dot notation", () => {
      expect(extractColorCode("Color 6.0 Natural")).toBe("6.0");
    });

    it("should extract dash notation", () => {
      expect(extractColorCode("Igora Royal 7-1")).toBe("7-1");
    });

    it("should extract letter codes", () => {
      expect(extractColorCode("Shade 6N")).toBe("6N");
      expect(extractColorCode("Color 7A Ash")).toBe("7A");
    });

    it("should extract triple codes", () => {
      expect(extractColorCode("Majirel 6/0/1")).toBe("6/0/1");
    });

    it("should return null when no code found", () => {
      expect(extractColorCode("Professional Shampoo 300ml")).toBe(null);
      expect(extractColorCode("Hair Mask")).toBe(null);
    });
  });
});

describe("Brand Normalization", () => {
  describe("normalizeBrand", () => {
    it("should normalize L'Oreal variations", () => {
      expect(normalizeBrand("Loreal")).toBe("L'Oréal Professionnel");
      expect(normalizeBrand("L'Oreal")).toBe("L'Oréal Professionnel");
      expect(normalizeBrand("LOreal")).toBe("L'Oréal Professionnel");
    });

    it("should normalize Schwarzkopf variations", () => {
      expect(normalizeBrand("Schwarckopf")).toBe("Schwarzkopf");
      expect(normalizeBrand("Shwarzkopf")).toBe("Schwarzkopf");
    });

    it("should be case-insensitive", () => {
      expect(normalizeBrand("LOREAL")).toBe("L'Oréal Professionnel");
      expect(normalizeBrand("schwarzkopf")).toBe("Schwarzkopf");
    });

    it("should return original for unknown brands", () => {
      expect(normalizeBrand("UnknownBrand")).toBe("UnknownBrand");
    });

    it("should handle whitespace", () => {
      expect(normalizeBrand("  Loreal  ")).toBe("L'Oréal Professionnel");
    });
  });
});

describe("Response Parsing", () => {
  const validResponse: MatcherResponse = {
    match_type: "PRODUCT",
    intent: "PRODUCT_SPECIFIC",
    matched_product: {
      id: "p1",
      url: "/majirel-6-0",
      confidence: 0.95,
    },
    recommended_category: null,
    gap_analysis: null,
    scoring_breakdown: {
      brand_match: 40,
      color_code_match: 50,
      product_line_match: 35,
      spec_match: 15,
      total: 140,
    },
    reasoning: "Exact match on all criteria",
    action: "ASSIGN_TO_PRODUCT",
  };

  it("should parse valid JSON response", () => {
    const jsonStr = JSON.stringify(validResponse);
    const result = parseMatcherResponse(jsonStr);
    expect(result.match_type).toBe("PRODUCT");
    expect(result.matched_product?.id).toBe("p1");
  });

  it("should parse JSON in markdown code block", () => {
    const markdown = "```json\n" + JSON.stringify(validResponse) + "\n```";
    const result = parseMatcherResponse(markdown);
    expect(result.match_type).toBe("PRODUCT");
  });

  it("should throw on invalid match_type", () => {
    const invalid = { ...validResponse, match_type: "INVALID" };
    expect(() => parseMatcherResponse(JSON.stringify(invalid))).toThrow(
      "Invalid match_type"
    );
  });

  it("should throw when PRODUCT match lacks product id", () => {
    const invalid = {
      ...validResponse,
      matched_product: { id: null, url: null, confidence: 0 },
    };
    expect(() => parseMatcherResponse(JSON.stringify(invalid))).toThrow(
      "PRODUCT match_type requires matched_product.id"
    );
  });

  it("should throw when CATEGORY match lacks suggested_url", () => {
    const invalid = {
      ...validResponse,
      match_type: "CATEGORY" as const,
      matched_product: null,
      recommended_category: {
        type: "product_type" as const,
        name: "Test",
        suggested_url: null,
        confidence: 0.9,
      },
    };
    expect(() => parseMatcherResponse(JSON.stringify(invalid))).toThrow(
      "CATEGORY requires recommended_category.suggested_url"
    );
  });
});

describe("Confidence Levels", () => {
  it("should return 'high' for >= 0.9", () => {
    expect(getConfidenceLevel(0.9)).toBe("high");
    expect(getConfidenceLevel(0.95)).toBe("high");
    expect(getConfidenceLevel(1.0)).toBe("high");
  });

  it("should return 'medium' for >= 0.75 and < 0.9", () => {
    expect(getConfidenceLevel(0.75)).toBe("medium");
    expect(getConfidenceLevel(0.85)).toBe("medium");
    expect(getConfidenceLevel(0.89)).toBe("medium");
  });

  it("should return 'low' for >= 0.5 and < 0.75", () => {
    expect(getConfidenceLevel(0.5)).toBe("low");
    expect(getConfidenceLevel(0.6)).toBe("low");
    expect(getConfidenceLevel(0.74)).toBe("low");
  });

  it("should return 'none' for < 0.5", () => {
    expect(getConfidenceLevel(0.49)).toBe("none");
    expect(getConfidenceLevel(0.25)).toBe("none");
    expect(getConfidenceLevel(0)).toBe("none");
  });
});
