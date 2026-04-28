/**
 * Opportunity Discovery Module
 * Phase 29: AI Opportunity Discovery
 *
 * Generates keyword opportunities from scraped business content.
 */

export {
  OpportunityDiscoveryService,
  type DiscoverOpportunitiesInput,
  type DiscoverOpportunitiesResult,
  type OpportunitySummary,
  type CategorySummary,
} from "./OpportunityDiscoveryService";

export {
  generateKeywordOpportunities,
  buildKeywordPrompt,
  parseKeywordResponse,
  type KeywordGeneratorInput,
  type GeneratedKeyword,
} from "./keywordGenerator";

export {
  validateKeywordVolumes,
  calculateOpportunityScore,
  enrichKeywordsWithMetrics,
  type KeywordVolumeResult,
  type VolumeValidationResult,
} from "./volumeValidator";

export {
  fetchSearchVolumeRaw,
  type SearchVolumeInput,
  type SearchVolumeItem,
} from "./dataforseoVolume";
