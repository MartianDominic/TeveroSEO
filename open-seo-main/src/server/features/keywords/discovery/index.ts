/**
 * Discovery Module
 *
 * Exports for pSEO pattern detection and keyword discovery.
 */

// Types
export * from './types';

// City data
export { LITHUANIAN_CITIES, extractCityFromKeyword, removeCity } from './LithuanianCities';

// pSEO Detection
export { PSEODetector, detectPSEOPatterns, computePSEOScore } from './PSEODetector';

// Side Keyword Expansion
export { SideKeywordExpander, discoverSideKeywords, type ExpandOptions } from './SideKeywordExpander';

// Product Linkage
export { linkKeywordsToProducts, type Product, type LinkedProduct, type ProductLinkage } from './ProductLinker';

// Recommendation Engine
export { RecommendationEngine, generateDiscoveryResult } from './RecommendationEngine';
