/**
 * Discovery Types
 *
 * Type definitions for pSEO pattern detection and keyword discovery.
 */

export interface LithuanianCity {
  name: string;           // Nominative form (e.g., "Vilnius")
  variants: string[];     // Locative, genitive forms (e.g., ["vilniuje", "vilniaus"])
}

export interface PSEOCluster {
  pattern: string;             // "[service] [CITY]" or "[product] [CITY]"
  template: string;            // "/plovykla/{city}"
  keywords: string[];          // All matching keywords
  cities: string[];            // Extracted cities
  estimatedPages: number;      // 50+ Lithuanian cities
  totalVolume: number;         // Sum of all keyword volumes
  avgDifficulty: number;       // Average difficulty
  opportunityScore: number;    // Combined value metric
}

export interface PSEODetectorConfig {
  minClusterSize: number;      // Minimum keywords for a cluster (default: 3)
  volumeWeight: number;        // Weight for volume in scoring (default: 0.35)
  cityWeight: number;          // Weight for city count (default: 0.25)
  difficultyWeight: number;    // Weight for difficulty (default: 0.20)
  funnelWeight: number;        // Weight for funnel stage (default: 0.20)
}

export interface PSEOOpportunityScore {
  volumeScore: number;
  cityScore: number;
  difficultyScore: number;
  funnelScore: number;
  combinedScore: number;
}

export interface CityExtraction {
  city: string;       // Normalized city name (nominative)
  variant: string;    // The actual variant found in the keyword
}

/**
 * Side Keyword Discovery Types
 */

export interface SideKeywordExpansion {
  source: 'problem' | 'solution' | 'related';
  seedTerm: string;           // Original problem/solution from conversation
  discoveredKeywords: SideKeyword[];
  expansionMethod: string;    // "dataforseo_keyword_ideas" | "semantic_expansion"
}

export interface SideKeyword {
  keyword: string;
  volume: number;
  difficulty: number;
  relevanceScore: number;     // From Phase 78 scoring
  passesFilters: boolean;     // From Phase 79 filtering
  discoverySource: string;    // Which seed term found this
}

export interface SideKeywordExpanderConfig {
  locationCode: number;       // DataForSEO location code (e.g., 2440 for Lithuania)
  languageCode: string;       // Language code (e.g., "lt")
  limit: number;              // Max keywords per seed term
  relevanceThreshold: number; // Minimum relevance score (0-1)
}
