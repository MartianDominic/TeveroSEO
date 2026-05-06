/**
 * T1-70: Page type detection check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: All page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import type { CheerioAPI } from "cheerio";

// Page type detection patterns
const PAGE_TYPE_PATTERNS = {
  article: {
    schema: ["Article", "BlogPosting", "NewsArticle"],
    content: /\b(published|written by|author|updated)\b/i,
    structure: ($: CheerioAPI) => $("article").length > 0 || $('[itemtype*="Article"]').length > 0,
  },
  comparison: {
    schema: ["ItemList"],
    content: /\b(vs\.?|versus|compared?|comparison|best|top \d+)\b/i,
    structure: ($: CheerioAPI) => $("table").length > 0 || $(".comparison, .vs").length > 0,
  },
  listicle: {
    schema: ["ItemList"],
    content: /\b(\d+\s+(best|top|ways|tips|reasons)|\blist\s+of)\b/i,
    structure: ($: CheerioAPI) => $("ol, ul").filter((_, el) => $(el).children().length >= 5).length > 0,
  },
  local: {
    schema: ["LocalBusiness", "Restaurant", "Store"],
    content: /\b(location|address|phone|hours|directions|near me)\b/i,
    structure: ($: CheerioAPI) => $('[itemtype*="LocalBusiness"], .nap, .address').length > 0,
  },
  service: {
    schema: ["Service", "ProfessionalService"],
    content: /\b(services?|pricing|quote|consultation|contact us)\b/i,
    structure: ($: CheerioAPI) => $(".services, .pricing, [itemtype*='Service']").length > 0,
  },
  product: {
    schema: ["Product"],
    content: /\b(buy|price|add to cart|shop|order)\b/i,
    structure: ($: CheerioAPI) => $('[itemtype*="Product"], .product, .buy-now').length > 0,
  },
};

export type PageType = keyof typeof PAGE_TYPE_PATTERNS | "unknown";

function detectPageType($: CheerioAPI, _html: string): { type: PageType; confidence: number } {
  // Check JSON-LD schemas first (highest confidence)
  const jsonLd = $('script[type="application/ld+json"]').text();
  for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (patterns.schema.some(s => jsonLd.includes(s))) {
      return { type: type as PageType, confidence: 0.95 };
    }
  }

  // Check structure patterns (medium confidence)
  for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (patterns.structure($)) {
      return { type: type as PageType, confidence: 0.80 };
    }
  }

  // Check content patterns (lower confidence)
  const text = $("body").text();
  for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (patterns.content.test(text)) {
      return { type: type as PageType, confidence: 0.60 };
    }
  }

  return { type: "unknown", confidence: 0 };
}

registerCheck({
  id: "T1-70",
  name: "Page type detected",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;
    const { type, confidence } = detectPageType($, html);
    const passed = type !== "unknown";

    return {
      checkId: "T1-70",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? `Page type: ${type} (${Math.round(confidence * 100)}% confidence)`
        : "Could not determine page type - consider adding structured data",
      details: { pageType: type, confidence },
      autoEditable: false,
    };
  },
});

export { detectPageType };
