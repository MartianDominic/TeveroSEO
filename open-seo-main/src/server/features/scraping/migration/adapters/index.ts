/**
 * Consumer Adapters Index
 * Phase 95-06: Consumer Migration Wiring
 * ADAPT-01, ADAPT-02: Added helper functions for single-URL scraping
 */

export * from "./types";

// ADAPT-01: SerpContentAdapter with scrapeSerpContent() helper
export * from "./SerpContentAdapter";

export * from "./CompetitorSpyAdapter";
export * from "./ProspectAnalysisAdapter";

// ADAPT-02: ContentBriefsAdapter with scrapeBriefPage() helper
export * from "./ContentBriefsAdapter";

// MIG-2: HybridCrawler, CrawlWorkflow, and SiteAudits adapters
export * from "./HybridCrawlerAdapter";
export * from "./CrawlWorkflowAdapter";
export * from "./SiteAuditsAdapter";

// CORE-01: VoiceAnalysis adapter
export * from "./VoiceAnalysisAdapter";

// CORE-02: MultiPageScrape adapter for prospect website scraping
export * from "./MultiPageScrapeAdapter";

// MIG-01: VolumeRefresh adapter for keyword volume API calls
export * from "./VolumeRefreshAdapter";

// Re-export for convenience
export { routeRequest } from "../MigrationRouter";
