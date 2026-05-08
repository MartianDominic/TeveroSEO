/**
 * Consumer Adapters Index
 * Phase 95-06: Consumer Migration Wiring
 */

export * from "./types";
export * from "./SerpContentAdapter";
export * from "./CompetitorSpyAdapter";
export * from "./ProspectAnalysisAdapter";
export * from "./ContentBriefsAdapter";

// MIG-2: HybridCrawler and CrawlWorkflow adapters
export * from "./HybridCrawlerAdapter";
export * from "./CrawlWorkflowAdapter";

// Re-export for convenience
export { routeRequest } from "../MigrationRouter";
