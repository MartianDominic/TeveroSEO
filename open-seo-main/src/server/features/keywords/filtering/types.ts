/**
 * Filtering Types for Keyword Constraint Pipeline
 *
 * Defines types for the hard filter pipeline that excludes irrelevant keywords
 * before scoring. Each filter stage has structured exclusion reasons.
 */

// ============================================================================
// Constraint Interfaces
// ============================================================================

export interface GeoConstraints {
  /**
   * Cities to target (case-insensitive).
   * If provided, keywords must match one of these cities.
   */
  includeCities: string[];

  /**
   * Cities to explicitly exclude (case-insensitive).
   */
  excludeCities: string[];

  /**
   * Whether generic (non-city) keywords are allowed to pass.
   * If false, only city-specific keywords pass.
   */
  genericAllowed: boolean;
}

export interface NegativeFilters {
  /**
   * Exact terms to exclude (case-insensitive substring match).
   * E.g., ["savitarna", "nemokamai"]
   */
  excludeTerms: string[];

  /**
   * Competitor brands to exclude (case-insensitive).
   * E.g., ["Lidl", "Maxima"]
   */
  excludeBrands: string[];

  /**
   * Negative intent patterns to exclude (case-insensitive).
   * E.g., ["diy", "kaip pačiam"]
   */
  excludeIntents: string[];

  /**
   * Whether to include default Lithuanian DIY/self-service patterns.
   */
  defaultPatterns: boolean;
}

export interface AudienceConstraints {
  /**
   * If true, exclude B2C patterns (personal, home, family).
   * Only allow B2B keywords.
   */
  b2bOnly: boolean;

  /**
   * If true, include B2C patterns.
   * Default is true (allow both B2B and B2C).
   */
  b2cAllowed: boolean;
}

export interface FilterConstraints {
  /**
   * Geographic filtering constraints.
   */
  geoConstraints?: GeoConstraints;

  /**
   * Negative term/brand/intent filters.
   */
  negativeFilters?: NegativeFilters;

  /**
   * Audience (B2B vs B2C) constraints.
   */
  audienceConstraints?: AudienceConstraints;

  /**
   * Minimum relevance score threshold (0.0 - 1.0).
   * Keywords below this threshold are excluded.
   * Default: 0.4
   */
  relevanceThreshold: number;
}

// ============================================================================
// Exclusion Reason Taxonomy
// ============================================================================

/**
 * Structured exclusion reasons with stage prefix and details.
 * Template literal type ensures all reasons follow the taxonomy.
 */
export type ExclusionReason =
  // Geo filter stage
  | `geo:wrong_city:${string}`
  | 'geo:not_in_target_list'
  | 'geo:generic_not_allowed'
  // Negative filter stage
  | `negative:term:${string}`
  | `negative:brand:${string}`
  | `negative:intent:${string}`
  // Audience filter stage
  | 'audience:b2c_excluded'
  | 'audience:b2b_excluded'
  // Relevance filter stage
  | `relevance:below_threshold:${string}`;

// ============================================================================
// Filter Result Types
// ============================================================================

export interface FilterResult {
  /**
   * The keyword that was filtered.
   */
  keyword: string;

  /**
   * Whether the keyword passed all filters.
   */
  passed: boolean;

  /**
   * If excluded, the structured reason.
   */
  exclusionReason?: ExclusionReason;

  /**
   * If excluded, which filter stage caught it.
   */
  exclusionStage?: 'geo' | 'negative' | 'audience' | 'relevance';

  /**
   * Time taken to process this keyword (milliseconds).
   */
  processingTimeMs: number;
}

export interface ExclusionExport {
  /**
   * The excluded keyword.
   */
  keyword: string;

  /**
   * Structured exclusion reason.
   */
  reason: ExclusionReason;

  /**
   * Human-readable version of the reason.
   */
  humanReadable: string;

  /**
   * Filter stage that excluded the keyword.
   */
  stage: string;

  /**
   * Additional details for export/analysis.
   */
  details: Record<string, unknown>;
}

// ============================================================================
// Input Type (what the filter consumes)
// ============================================================================

export interface ClassifiedKeywordInput {
  /**
   * The keyword text.
   */
  keyword: string;

  /**
   * Geo classification from Phase 77.
   */
  geoClassification?: {
    passesGeoFilter: boolean;
    city?: string;
    geoScore: number;
  };

  /**
   * Relevance scores from Phase 78.
   */
  relevanceScores?: {
    combinedScore: number;
  };

  /**
   * Funnel stage from Phase 76.
   */
  funnelStage?: 'bofu' | 'mofu' | 'tofu';

  /**
   * Search volume (optional).
   */
  volume?: number;

  /**
   * Current ranking position (optional, null if not ranking).
   */
  position?: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert structured exclusion reason to human-readable format.
 */
export function humanReadableReason(reason: ExclusionReason): string {
  // Geo reasons
  if (reason.startsWith('geo:wrong_city:')) {
    const city = reason.split(':')[2];
    return `Excluded: wrong city (${city})`;
  }
  if (reason === 'geo:not_in_target_list') {
    return 'Excluded: not in target city list';
  }
  if (reason === 'geo:generic_not_allowed') {
    return 'Excluded: generic keyword not allowed';
  }

  // Negative reasons
  if (reason.startsWith('negative:term:')) {
    const term = reason.split(':')[2];
    return `Excluded: negative term (${term})`;
  }
  if (reason.startsWith('negative:brand:')) {
    const brand = reason.split(':')[2];
    return `Excluded: competitor brand (${brand})`;
  }
  if (reason.startsWith('negative:intent:')) {
    const intent = reason.split(':')[2];
    return `Excluded: negative intent (${intent})`;
  }

  // Audience reasons
  if (reason === 'audience:b2c_excluded') {
    return 'Excluded: B2C pattern (B2B only mode)';
  }
  if (reason === 'audience:b2b_excluded') {
    return 'Excluded: B2B pattern (B2C only mode)';
  }

  // Relevance reasons
  if (reason.startsWith('relevance:below_threshold:')) {
    const score = reason.split(':')[2];
    return `Excluded: relevance score below threshold (${score})`;
  }

  // Fallback
  return `Excluded: ${reason}`;
}
