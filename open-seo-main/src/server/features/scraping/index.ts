/**
 * Per-Domain Learning System
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Exports for the domain scraping learning system.
 */

// Schema and types
export {
  // Tables
  domainScrapeConfigs,
  domainScrapeHistory,
  domainScrapeConfigsRelations,
  domainScrapeHistoryRelations,
  // Constants
  SCRAPE_TIERS,
  TIER_COSTS,
  TIER_INDEX,
  ESCALATION_REASONS,
  DETECTED_TECHNOLOGIES,
  REVALIDATION_INTERVALS,
  DOMAIN_CONFIG_CACHE_TTL_SECONDS,
  // Types
  type ScrapeTier,
  type EscalationReason,
  type DetectedTechnology,
  type GeoRequirement,
  type DiscoveryAttempt,
  type DomainScrapeConfigSelect,
  type DomainScrapeConfigInsert,
  type DomainScrapeHistorySelect,
  type DomainScrapeHistoryInsert,
} from "@/db/domain-scrape-learning-schema";

// Service types
export type {
  TieredFetchRequest,
  TieredFetchResult,
  ContentValidation,
  DomainConfig,
  DomainConfigUpdate,
  DiscoveryRequest,
  DiscoveryResult,
  RevalidationCandidate,
  RevalidationResult,
  CrawlCostSummary,
  DailyCostReport,
  IDomainLearningService,
} from "./types";

// Service implementation
export {
  DomainLearningService,
  domainLearningService,
  normalizeDomain,
  getNextTier,
  calculateCost,
} from "./DomainLearningService";

// Cron jobs
export {
  RevalidationCronJob,
  HistoryCleanupJob,
  revalidationCronJob,
  historyCleanupJob,
  startDomainLearningJobs,
  stopDomainLearningJobs,
  type RevalidationJobConfig,
  type RevalidationRunStats,
} from "./RevalidationCronJob";
