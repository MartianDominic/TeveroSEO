/**
 * CustomExtractor - Rule-based data extraction from HTML
 * Phase 43: Prospect Keyword Pipeline
 *
 * Applies user-defined or AI-generated extraction rules to crawled HTML.
 * Uses CSS selectors with fallbacks and transformation functions.
 */
import * as cheerio from "cheerio";
import { minimatch } from "minimatch";
import type {
  ExtractionRule,
  ExtractionField,
} from "@/db/prospect-scrape-config-schema";

export interface ExtractedData {
  url: string;
  pageType: string;
  fields: Record<string, string | null>;
  matchedRule: string;
}

export class CustomExtractor {
  private rules: ExtractionRule[];

  constructor(rules: ExtractionRule[]) {
    // Filter to only enabled rules
    this.rules = rules.filter((r) => r.enabled);
  }

  /**
   * Extract data from HTML using configured rules.
   * Returns null if no rule matches the URL.
   */
  extract(html: string, url: string): ExtractedData | null {
    // Find matching rule based on URL pattern
    const pathname = new URL(url).pathname;
    const matchingRule = this.rules.find((rule) =>
      minimatch(pathname, rule.urlPattern),
    );

    if (!matchingRule) {
      return null;
    }

    const $ = cheerio.load(html);
    const fields: Record<string, string | null> = {};

    for (const field of matchingRule.fields) {
      fields[field.name] = this.extractField($, field);
    }

    return {
      url,
      pageType: matchingRule.pageType,
      fields,
      matchedRule: matchingRule.name,
    };
  }

  /**
   * Extract a single field using selectors with fallback.
   * Tries each selector in order until one succeeds.
   */
  private extractField(
    $: cheerio.CheerioAPI,
    field: ExtractionField,
  ): string | null {
    for (const selector of field.selectors) {
      const element = $(selector).first();
      if (element.length === 0) continue;

      let value: string;

      switch (field.type) {
        case "text":
          value = element.text();
          break;
        case "attribute":
          value = element.attr(field.attribute || "href") || "";
          break;
        case "html":
          value = element.html() || "";
          break;
        default:
          value = element.text();
      }

      if (value) {
        return this.applyTransform(value, field.transform);
      }
    }

    return null;
  }

  /**
   * Apply transformation to extracted value.
   */
  private applyTransform(
    value: string,
    transform?: ExtractionField["transform"],
  ): string {
    let result = value;

    switch (transform) {
      case "trim":
        result = value.trim();
        break;
      case "lowercase":
        result = value.toLowerCase().trim();
        break;
      case "number":
        // Extract only numeric characters, dots, and minus signs
        result = value.replace(/[^\d.-]/g, "");
        break;
      case "price":
        // Extract price, handling EUR/USD formats with comma as decimal
        const priceMatch = value.match(/[\d.,]+/);
        if (priceMatch) {
          // Replace comma with dot for decimal (European format)
          result = priceMatch[0].replace(",", ".");
        } else {
          result = "";
        }
        break;
      default:
        result = value.trim();
    }

    return result;
  }

  /**
   * Test a rule against a sample URL and HTML.
   * Useful for validating rules before saving.
   */
  testRule(
    rule: ExtractionRule,
    html: string,
    url: string,
  ): { matched: boolean; data: Record<string, string | null> | null } {
    const pathname = new URL(url).pathname;
    const matched = minimatch(pathname, rule.urlPattern);

    if (!matched) {
      return { matched: false, data: null };
    }

    const $ = cheerio.load(html);
    const data: Record<string, string | null> = {};

    for (const field of rule.fields) {
      data[field.name] = this.extractField($, field);
    }

    return { matched: true, data };
  }
}

/**
 * Convenience function for one-off extraction.
 */
export function extractWithRules(
  rules: ExtractionRule[],
  html: string,
  url: string,
): ExtractedData | null {
  const extractor = new CustomExtractor(rules);
  return extractor.extract(html, url);
}
