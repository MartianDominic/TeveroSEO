/**
 * Multi-page scraper for prospect websites.
 *
 * Scrapes homepage, detects business-relevant pages, then scrapes up to 3 additional pages.
 * Total limit: 4 pages (homepage + 3 additional).
 */

import { scrapeProspectPage } from "./dataforseoScraper";
import { detectBusinessLinks } from "./linkDetector";
import type { MultiPageScrapeResult } from "./types";
import { AppError } from "@/server/lib/errors";

/** Delay between scrape requests in milliseconds */
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
 * Scrape a prospect's website (homepage + business pages).
 *
 * Implementation:
 * 1. Normalize domain to https:// URL
 * 2. Scrape homepage
 * 3. Detect business links from internal links
 * 4. Scrape up to 3 additional pages (products, about, services, contact, categories)
 * 5. Add 1000ms delay between scrapes
 * 6. Aggregate cost across all pages
 *
 * @param domain - Domain or URL to scrape
 * @returns Multi-page scrape result with homepage, business links, and additional pages
 */
export async function scrapeProspectSite(
  domain: string,
): Promise<MultiPageScrapeResult> {
  const homepageUrl = normalizeDomain(domain);

  // Step 1: Scrape homepage
  const homepageResult = await scrapeProspectPage(homepageUrl);

  if (!homepageResult.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Failed to scrape homepage: ${homepageResult.error}`,
    );
  }

  let totalCost = homepageResult.costCents;
  const errors: Array<{ url: string; error: string }> = [];

  // Step 2: Detect business links
  const businessLinks = detectBusinessLinks(
    homepageResult.page.internalLinks,
    homepageUrl,
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
