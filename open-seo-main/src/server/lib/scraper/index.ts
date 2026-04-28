/**
 * Prospect website scraping via DataForSEO.
 */

export { fetchRawHtml, scrapeProspectPage } from "./dataforseoScraper";
export { detectBusinessLinks } from "./linkDetector";
export { scrapeProspectSite } from "./multiPageScraper";
export type {
  ScrapeResult,
  ScrapeError,
  ScrapeResponse,
  RawHtmlResult,
  BusinessLinks,
  MultiPageScrapeResult,
} from "./types";
