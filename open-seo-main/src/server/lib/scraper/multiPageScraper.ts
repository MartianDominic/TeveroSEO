/**
 * Multi-page scraper for prospect websites.
 *
 * Scrapes homepage, detects business-relevant pages, then scrapes up to 3 additional pages.
 * Total limit: 4 pages (homepage + 3 additional).
 *
 * Migration Status: Uses MigrationRouter for gradual transition to unified ScrapingService.
 * - Legacy: Direct DataForSEO calls via scrapeProspectPage
 * - New: ScrapingService.scrapeBatch() with tiered fetching and caching
 */

import { scrapeProspectPage } from "./dataforseoScraper";
import { detectBusinessLinks } from "./linkDetector";
import type { MultiPageScrapeResult } from "./types";
import { AppError } from "@/server/lib/errors";
import { routeBatchRequest } from "@/server/features/scraping/migration/MigrationRouter";
import {
  batchResultToMultiPageResult,
  scrapeResultToPageAnalysis,
  compareMultiPageResults,
} from "@/server/features/scraping/migration/adapters/MultiPageScrapeAdapter";
import type { ScrapeResult as UnifiedScrapeResult } from "@/server/features/scraping/ScrapingService";

/** Delay between scrape requests in milliseconds (legacy mode only) */
const SCRAPE_DELAY_MS = 1000;

/** Maximum number of additional pages to scrape beyond homepage */
const MAX_ADDITIONAL_PAGES = 3;

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize domain to https:// URL.
 */
function normalizeDomain(domain: string): string {
  if (domain.startsWith("https://") || domain.startsWith("http://")) {
    return domain;
  }
  return `https://${domain}`;
}

/**
 * Legacy implementation: scrape pages sequentially with delays.
 * Used when migration state is "legacy" or as fallback.
 */
async function scrapeProspectSiteLegacy(
  domain: string
): Promise<MultiPageScrapeResult> {
  const homepageUrl = normalizeDomain(domain);

  // Step 1: Scrape homepage
  const homepageResult = await scrapeProspectPage(homepageUrl);

  if (!homepageResult.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to scrape homepage: ${homepageResult.error}`
    );
  }

  let totalCost = homepageResult.costCents;
  const errors: Array<{ url: string; error: string }> = [];

  // Step 2: Detect business links
  const businessLinks = detectBusinessLinks(
    homepageResult.page.internalLinks,
    homepageUrl
  );

  // Step 3: Build list of URLs to scrape (max 3)
  const urlsToScrape: string[] = [];

  if (businessLinks.products) urlsToScrape.push(businessLinks.products);
  if (businessLinks.about) urlsToScrape.push(businessLinks.about);
  if (businessLinks.services) urlsToScrape.push(businessLinks.services);
  if (businessLinks.contact) urlsToScrape.push(businessLinks.contact);

  // Add category pages (up to 3 total categories already detected)
  for (const category of businessLinks.categories) {
    if (urlsToScrape.length >= MAX_ADDITIONAL_PAGES) break;
    urlsToScrape.push(category);
  }

  // Trim to max additional pages
  const pagesToScrape = urlsToScrape.slice(0, MAX_ADDITIONAL_PAGES);

  // Step 4: Scrape additional pages
  const additionalPages = [];

  for (const url of pagesToScrape) {
    // Add delay between requests
    await sleep(SCRAPE_DELAY_MS);

    const result = await scrapeProspectPage(url);

    totalCost += result.costCents;

    if (result.success) {
      additionalPages.push(result.page);
    } else {
      errors.push({
        url,
        error: result.error,
      });
    }
  }

  return {
    homepage: homepageResult.page,
    businessLinks,
    additionalPages,
    totalCostCents: totalCost,
    errors,
  };
}

/**
 * Result transformer for MigrationRouter.
 * Converts between legacy MultiPageScrapeResult and unified ScrapeResult formats.
 */
const multiPageTransformer = {
  /**
   * Convert legacy result to unified format (for comparison).
   * Note: This is a lossy conversion as MultiPageScrapeResult has more structure.
   */
  legacyToNew: (legacy: MultiPageScrapeResult): UnifiedScrapeResult => {
    // Return homepage as the primary result for comparison purposes
    return {
      url: legacy.homepage.url,
      success: true,
      statusCode: legacy.homepage.statusCode,
      tierUsed: "dfs_js" as const, // Legacy always used DataForSEO JS
      fromCache: false,
      responseTimeMs: legacy.homepage.responseTimeMs,
      responseSizeBytes: 0,
      estimatedCostUsd: legacy.totalCostCents / 100,
      html: undefined,
      parsedData: {
        title: legacy.homepage.title,
        metaDescription: legacy.homepage.metaDescription,
        h1: legacy.homepage.h1s,
        h2: [],
        canonical: legacy.homepage.canonical ?? undefined,
        internalLinks: legacy.homepage.internalLinks.map((url) => ({ url, text: "" })),
        externalLinks: legacy.homepage.externalLinks.map((url) => ({ url, text: "" })),
        wordCount: legacy.homepage.wordCount,
        images: legacy.homepage.images.map((img) => ({
          src: img.src ?? "",
          alt: img.alt ?? "",
        })),
      },
    };
  },

  /**
   * Convert unified batch result to legacy format.
   * This is handled by batchResultToMultiPageResult utility.
   */
  newToLegacy: (newResult: UnifiedScrapeResult): MultiPageScrapeResult => {
    // This will be replaced by the actual batch transformation
    // when routeBatchRequest processes the results
    return {
      homepage: scrapeResultToPageAnalysis(newResult),
      businessLinks: {
        products: null,
        about: null,
        services: null,
        contact: null,
        categories: [],
      },
      additionalPages: [],
      totalCostCents: Math.round(newResult.estimatedCostUsd * 100),
      errors: [],
    };
  },
};

/**
 * Scrape a prospect's website (homepage + business pages).
 *
 * Implementation:
 * 1. Normalize domain to https:// URL
 * 2. Scrape homepage
 * 3. Detect business links from internal links
 * 4. Scrape up to 3 additional pages (products, about, services, contact, categories)
 * 5. Add 1000ms delay between scrapes (legacy mode only)
 * 6. Aggregate cost across all pages
 *
 * Migration:
 * - Uses MigrationRouter to route between legacy DataForSEO and unified ScrapingService
 * - Feature flag: prospectAnalysis
 * - New path uses ScrapingService.scrapeBatch() for concurrent fetching with caching
 *
 * @param domain - Domain or URL to scrape
 * @returns Multi-page scrape result with homepage, business links, and additional pages
 */
export async function scrapeProspectSite(
  domain: string
): Promise<MultiPageScrapeResult> {
  const homepageUrl = normalizeDomain(domain);

  // Step 1: Always scrape homepage first (needed for link detection)
  // For legacy mode, this is the full flow. For unified, we need the links first.
  const homepageResult = await scrapeProspectPage(homepageUrl);

  if (!homepageResult.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to scrape homepage: ${homepageResult.error}`
    );
  }

  // Step 2: Detect business links from homepage
  const businessLinks = detectBusinessLinks(
    homepageResult.page.internalLinks,
    homepageUrl
  );

  // Step 3: Build list of additional URLs to scrape
  const additionalUrls: string[] = [];
  if (businessLinks.products) additionalUrls.push(businessLinks.products);
  if (businessLinks.about) additionalUrls.push(businessLinks.about);
  if (businessLinks.services) additionalUrls.push(businessLinks.services);
  if (businessLinks.contact) additionalUrls.push(businessLinks.contact);

  for (const category of businessLinks.categories) {
    if (additionalUrls.length >= MAX_ADDITIONAL_PAGES) break;
    additionalUrls.push(category);
  }

  const urlsToScrape = additionalUrls.slice(0, MAX_ADDITIONAL_PAGES);

  // If no additional URLs, return just the homepage
  if (urlsToScrape.length === 0) {
    return {
      homepage: homepageResult.page,
      businessLinks,
      additionalPages: [],
      totalCostCents: homepageResult.costCents,
      errors: [],
    };
  }

  // Step 4: Use MigrationRouter for batch scraping additional pages
  const additionalResults = await routeBatchRequest<MultiPageScrapeResult>({
    feature: "prospectAnalysis",
    urls: urlsToScrape,
    legacyBatchFn: async (urls: string[]) => {
      // Legacy: sequential scraping with delays
      const results = new Map<string, MultiPageScrapeResult>();
      let totalCost = homepageResult.costCents;
      const additionalPages = [];
      const errors: Array<{ url: string; error: string }> = [];

      for (const url of urls) {
        await sleep(SCRAPE_DELAY_MS);

        const result = await scrapeProspectPage(url);
        totalCost += result.costCents;

        if (result.success) {
          additionalPages.push(result.page);
        } else {
          errors.push({ url, error: result.error });
        }
      }

      // Return the full result for the batch
      const fullResult: MultiPageScrapeResult = {
        homepage: homepageResult.page,
        businessLinks,
        additionalPages,
        totalCostCents: totalCost,
        errors,
      };

      // Map to single entry for batch interface
      results.set(homepageUrl, fullResult);
      return results;
    },
    scrapeOptions: {
      feature: "prospectAnalysis",
      includeHtml: true,
      includeParsedData: true,
    },
    transformer: multiPageTransformer,
    concurrency: 3, // Parallel fetching in unified mode
  });

  // Get the result from the batch
  const batchResult = additionalResults.get(homepageUrl);
  if (batchResult) {
    return batchResult;
  }

  // Fallback: construct result from batch results map
  const additionalPages = [];
  const errors: Array<{ url: string; error: string }> = [];
  let totalCost = homepageResult.costCents;

  for (const [url, result] of additionalResults.entries()) {
    if (url === homepageUrl) continue;

    totalCost += result.totalCostCents;
    additionalPages.push(...result.additionalPages);
    errors.push(...result.errors);
  }

  return {
    homepage: homepageResult.page,
    businessLinks,
    additionalPages,
    totalCostCents: totalCost,
    errors,
  };
}

/**
 * Scrape a prospect's website using legacy implementation only.
 * Exported for testing and fallback purposes.
 */
export { scrapeProspectSiteLegacy };
