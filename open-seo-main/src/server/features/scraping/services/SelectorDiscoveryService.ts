/**
 * SelectorDiscoveryService - AI-powered CSS selector discovery
 * Phase 43: Prospect Keyword Pipeline
 *
 * Uses Claude to analyze HTML structure and identify reliable CSS selectors
 * for extracting product data from e-commerce sites.
 */
import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type {
  AiSelector,
  DetectedPlatform,
} from "@/db/prospect-scrape-config-schema";

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPT_PATH = join(__dirname, "../prompts/selector-discovery.xml");

export interface SelectorDiscoveryResult {
  platform: DetectedPlatform;
  platformConfidence: number;
  selectors: AiSelector[];
}

export class SelectorDiscoveryService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Discover CSS selectors for an e-commerce page using AI.
   */
  async discoverSelectors(
    html: string,
    url: string,
  ): Promise<SelectorDiscoveryResult> {
    // Truncate HTML if too long (keep head + main content)
    const truncatedHtml = this.truncateHtml(html, 50000);

    // Load prompt template
    const promptTemplate = readFileSync(PROMPT_PATH, "utf-8");
    const prompt = promptTemplate
      .replace("{{PAGE_HTML}}", truncatedHtml)
      .replace("{{PAGE_URL}}", url);

    // Call Claude
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Parse response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Transform to AiSelector format
    const selectors: AiSelector[] = result.selectors.map(
      (s: {
        field: string;
        selector: string;
        fallback?: string | null;
        confidence: number;
        sampleValue?: string;
      }) => ({
        field: s.field,
        selector: s.selector,
        fallback: s.fallback || null,
        confidence: s.confidence,
        sampleValue: s.sampleValue || "",
        discoveredAt: new Date().toISOString(),
      }),
    );

    return {
      platform: result.platform as DetectedPlatform,
      platformConfidence: result.platformConfidence,
      selectors,
    };
  }

  /**
   * Detect platform without full selector discovery (faster).
   * Uses heuristics to identify common e-commerce platforms.
   */
  async detectPlatform(html: string): Promise<{
    platform: DetectedPlatform;
    confidence: number;
  }> {
    const $ = cheerio.load(html);

    // Check for Shopify
    if (
      html.includes("cdn.shopify.com") ||
      html.includes("Shopify.theme") ||
      $('meta[name="shopify-checkout-api-token"]').length > 0
    ) {
      return { platform: "shopify", confidence: 0.95 };
    }

    // Check for WooCommerce
    if (
      html.includes("woocommerce") ||
      $(".woocommerce").length > 0 ||
      html.includes("wc-add-to-cart")
    ) {
      return { platform: "woocommerce", confidence: 0.95 };
    }

    // Check for Magento
    if (
      html.includes("Magento") ||
      html.includes("/mage/") ||
      $('script[src*="mage"]').length > 0
    ) {
      return { platform: "magento", confidence: 0.9 };
    }

    // Check for PrestaShop
    if (html.includes("prestashop") || $(".product-add-to-cart").length > 0) {
      return { platform: "prestashop", confidence: 0.85 };
    }

    // Check for OpenCart
    if (html.includes("opencart") || $("#product").length > 0) {
      return { platform: "opencart", confidence: 0.8 };
    }

    return { platform: "custom", confidence: 0.5 };
  }

  /**
   * Truncate HTML while keeping important parts.
   * Removes scripts, styles, and trims to fit within token limits.
   */
  private truncateHtml(html: string, maxLength: number): string {
    if (html.length <= maxLength) return html;

    const $ = cheerio.load(html);

    // Remove scripts, styles, comments
    $("script, style, noscript").remove();

    // Get cleaned HTML
    const cleaned = $.html();

    if (cleaned.length <= maxLength) return cleaned;

    // Further truncate by keeping head + main content area
    const head = $("head").html() || "";
    const body = $("body").html() || "";

    const headPart = head.substring(0, 5000);
    const bodyPart = body.substring(0, maxLength - 5000 - 500);

    return `<!DOCTYPE html><html><head>${headPart}</head><body>${bodyPart}</body></html>`;
  }
}

export const selectorDiscoveryService = new SelectorDiscoveryService();
