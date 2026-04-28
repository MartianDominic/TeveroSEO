/**
 * Types for prospect website scraping via DataForSEO.
 */

import type { PageAnalysis } from "@/server/lib/audit/types";

/**
 * Result from scraping a prospect page.
 * Uses existing PageAnalysis type from page-analyzer.
 */
export interface ScrapeResult {
  success: true;
  page: PageAnalysis;
  costCents: number;
}

export interface ScrapeError {
  success: false;
  error: string;
  costCents: number;
}

export type ScrapeResponse = ScrapeResult | ScrapeError;

/**
 * Raw HTML response from DataForSEO.
 */
export interface RawHtmlResult {
  html: string;
  statusCode: number;
  responseTimeMs: number;
  redirectUrl: string | null;
}

/**
 * Business-relevant links detected from a website.
 */
export interface BusinessLinks {
  products: string | null;
  about: string | null;
  services: string | null;
  contact: string | null;
  categories: string[];
}

/**
 * Result from scraping multiple pages of a prospect's website.
 */
export interface MultiPageScrapeResult {
  homepage: PageAnalysis;
  businessLinks: BusinessLinks;
  additionalPages: PageAnalysis[];
  totalCostCents: number;
  errors: Array<{
    url: string;
    error: string;
  }>;
}
