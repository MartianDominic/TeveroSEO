/**
 * Extraction Pipeline
 *
 * Batch document processing for LightRAG entity extraction.
 * Includes page validation, HTML cleaning, cost estimation, and rate limiting.
 *
 * Per IMPLEMENTATION-FIXES.md Fix 4: Validates pages to reject consent/bot challenge walls.
 * Per ADR-003: Routes 60-70% of tasks to APIs, only client sites are crawled.
 */

import { getLightRAGService } from "./lightrag-service";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "extraction-pipeline" });

export interface PageInput {
  /** URL of the page */
  url: string;
  /** Raw HTML content */
  html: string;
  /** Unique identifier for this page/document */
  pageId: string;
}

export interface PipelineProgress {
  /** Total pages in batch */
  total: number;
  /** Pages processed so far */
  processed: number;
  /** URL of current page being processed */
  currentUrl: string;
  /** Total entities extracted so far */
  entitiesExtracted: number;
}

export interface PipelineResult {
  /** Total pages submitted */
  totalPages: number;
  /** Pages successfully processed */
  successfulPages: number;
  /** Pages that failed validation or processing */
  failedPages: number;
  /** Total entities extracted across all pages */
  totalEntities: number;
  /** Estimated USD cost for LLM calls */
  estimatedCost: number;
  /** Total processing time in milliseconds */
  durationMs: number;
}

/**
 * Consent/bot challenge signatures to detect blocking pages.
 * Per Fix 4: HTTP 200 responses with consent shells are extracted as products.
 */
const BLOCKING_SIGNATURES = [
  // Cookie consent platforms
  "cookiebot",
  "onetrust",
  "iubenda",
  "cookieconsent",
  "cookie-law-info",
  "gdpr-cookie-compliance",
  // Cloudflare challenges
  "cf-challenge",
  "cf-turnstile",
  "cf-chl-bypass",
  "challenge-platform",
  // Bot detection services
  "captcha",
  "recaptcha",
  "hcaptcha",
  "datadome",
  "perimeterx",
  // Generic blocking
  "checking your browser",
  "please wait",
  "access denied",
];

const MIN_CONTENT_LENGTH = 200;

/**
 * Validate that a page contains real content, not a consent/challenge wall.
 */
export function validatePage(html: string): { valid: boolean; reason: string } {
  const htmlLower = html.toLowerCase();

  // Check for blocking signatures
  for (const sig of BLOCKING_SIGNATURES) {
    if (htmlLower.includes(sig)) {
      // Signature found - check if content is also present
      // If page is small, it's likely a blocking page
      if (html.length < 5000) {
        return { valid: false, reason: `consent_or_challenge:${sig}` };
      }
    }
  }

  // Check for minimum content
  const textContent = html.replace(/<[^>]*>/g, " ").trim();
  if (textContent.length < MIN_CONTENT_LENGTH) {
    return { valid: false, reason: "insufficient_content" };
  }

  return { valid: true, reason: "ok" };
}

/**
 * Clean HTML for entity extraction - remove non-content elements.
 */
export function cleanHtmlForExtraction(html: string): string {
  // Remove script, style, nav, header, footer, aside
  const patterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<aside[^>]*>[\s\S]*?<\/aside>/gi,
    /<noscript[^>]*>[\s\S]*?<\/noscript>/gi,
    /<!--[\s\S]*?-->/g,
  ];

  let cleaned = html;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Extract text with basic structure preserved
  cleaned = cleaned
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Estimate LLM token cost for extraction.
 * ~4 chars per token, extraction prompt multiplier ~1.3x
 */
export function estimateCost(pages: PageInput[]): {
  tokens: number;
  usdCost: number;
} {
  if (pages.length === 0) {
    return { tokens: 0, usdCost: 0 };
  }

  const totalChars = pages.reduce(
    (sum, p) => sum + cleanHtmlForExtraction(p.html).length,
    0
  );
  const estimatedTokens = Math.ceil((totalChars / 4) * 1.3);

  // GPT-4o-mini pricing: $0.15/$0.60 per 1M input/output tokens
  // Assume 70% input, 30% output
  const inputTokens = estimatedTokens * 0.7;
  const outputTokens = estimatedTokens * 0.3;
  const usdCost = inputTokens * 0.00000015 + outputTokens * 0.0000006;

  return { tokens: estimatedTokens, usdCost };
}

/**
 * Extraction pipeline for batch document processing.
 *
 * Processes pages in batches with rate limiting to prevent overload.
 * Reports progress via callback for UI updates.
 */
export class ExtractionPipeline {
  private concurrency: number;
  private service = getLightRAGService();

  constructor(options: { concurrency?: number } = {}) {
    this.concurrency = options.concurrency ?? 10;
  }

  /**
   * Extract entities from batch of pages.
   * Returns after all pages processed with summary stats.
   */
  async extractFromPages(
    tenantId: string,
    pages: PageInput[],
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    let successfulPages = 0;
    let failedPages = 0;
    let totalEntities = 0;

    // Validate and clean pages
    const validPages: { id: string; content: string; url: string }[] = [];
    for (const page of pages) {
      const validation = validatePage(page.html);
      if (!validation.valid) {
        log.debug(`Skipping invalid page: ${page.url} - ${validation.reason}`);
        failedPages++;
        continue;
      }

      const cleanedContent = cleanHtmlForExtraction(page.html);
      if (cleanedContent.length < MIN_CONTENT_LENGTH) {
        log.debug(`Skipping page with insufficient content: ${page.url}`);
        failedPages++;
        continue;
      }

      validPages.push({
        id: page.pageId,
        content: cleanedContent,
        url: page.url,
      });
    }

    // Process in batches with rate limiting
    const batchSize = this.concurrency;
    for (let i = 0; i < validPages.length; i += batchSize) {
      const batch = validPages.slice(i, i + batchSize);

      try {
        const results = await this.service.insertDocuments(tenantId, batch);

        for (const result of results) {
          successfulPages++;
          totalEntities += result.entitiesExtracted;
        }

        onProgress?.({
          total: pages.length,
          processed: i + batch.length,
          currentUrl: batch[batch.length - 1]?.url ?? "",
          entitiesExtracted: totalEntities,
        });
      } catch (error) {
        log.error(
          `Batch extraction failed`,
          error instanceof Error ? error : new Error(String(error))
        );
        failedPages += batch.length;
      }
    }

    const { usdCost } = estimateCost(pages);

    return {
      totalPages: pages.length,
      successfulPages,
      failedPages,
      totalEntities,
      estimatedCost: usdCost,
      durationMs: Date.now() - startTime,
    };
  }
}
