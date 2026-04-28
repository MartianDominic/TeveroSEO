/**
 * FocusDirective Types
 *
 * TypeScript interfaces for the business priority parser output.
 * These types match the JSON schema defined in business-priority-parser.xml
 *
 * @see ../prompts/business-priority-parser.xml
 */

// ============================================================================
// Enums
// ============================================================================

export type TemporalScope = 'PERMANENT' | 'QUARTERLY' | 'SEASONAL' | 'CAMPAIGN';

export type BrandAction = 'PROMOTE' | 'NEUTRAL' | 'EXCLUDE' | 'DEMOTE';

export type VolumeStrategy = 'HIGH_VOLUME' | 'LONG_TAIL' | 'BALANCED' | 'MIXED';

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

// ============================================================================
// Base Types
// ============================================================================

interface BaseExtraction {
  scope: TemporalScope;
  valid_until: string | null; // ISO 8601 date
  confidence: number; // 0.0 - 1.0
}

// ============================================================================
// Priority Types
// ============================================================================

export interface CategoryPriority extends BaseExtraction {
  name: string;
  name_lt: string; // Lithuanian variant
  weight_modifier: number; // 0.5 - 2.0, default 1.0
}

export interface AttributePriority extends BaseExtraction {
  attribute: string;
  attribute_lt: string; // Lithuanian variant
  boost_factor: number; // 1.1 - 2.0
}

export interface BrandPriority extends BaseExtraction {
  brand: string;
  action: 'PROMOTE' | 'NEUTRAL';
  weight_modifier: number; // 1.0 - 2.0
}

export interface Priorities {
  categories: CategoryPriority[];
  attributes: AttributePriority[];
  brands: BrandPriority[];
}

// ============================================================================
// Suppression Types
// ============================================================================

export interface AttributeSuppression extends BaseExtraction {
  attribute: string;
  attribute_lt: string;
  suppress_factor: number; // 0.1 - 0.9
  reason: string;
}

export interface BrandSuppression extends BaseExtraction {
  brand: string;
  action: 'EXCLUDE' | 'DEMOTE';
  suppress_factor: number; // 0.0 - 0.5
  reason: string;
}

export interface CategorySuppression extends BaseExtraction {
  name: string;
  name_lt: string;
  suppress_factor: number; // 0.1 - 0.9
  reason: string;
}

export interface Suppressions {
  attributes: AttributeSuppression[];
  brands: BrandSuppression[];
  categories: CategorySuppression[];
}

// ============================================================================
// Volume Preference
// ============================================================================

export interface VolumePreference {
  strategy: VolumeStrategy;
  high_volume_threshold: number; // monthly searches
  long_tail_max_words: number; // typically 4-7
  rationale: string;
  confidence: number;
}

// ============================================================================
// Temporal Context
// ============================================================================

export interface TemporalContext {
  detection_signals: string[];
  primary_scope: TemporalScope;
  quarter: Quarter | null;
  season: Season | null;
  campaign_name: string | null;
  effective_date: string; // ISO 8601 date
  expiry_date: string | null; // ISO 8601 date
}

// ============================================================================
// Contradictions & Ambiguities
// ============================================================================

export interface Contradiction {
  conflict: string;
  items: string[];
  resolution_suggestion: string;
}

export interface Ambiguity {
  statement: string;
  possible_interpretations: string[];
  chosen_interpretation: string | null;
  needs_clarification: boolean;
}

// ============================================================================
// Lithuanian Variants
// ============================================================================

export interface LithuanianVariant {
  original: string;
  variants: string[];
  includes_misspellings: boolean;
}

export interface LithuanianVariants {
  generated: LithuanianVariant[];
}

// ============================================================================
// Metadata
// ============================================================================

export interface FocusDirectiveMetadata {
  parser_version: string;
  total_priorities_extracted: number;
  total_suppressions_extracted: number;
  average_confidence: number;
  requires_human_review: boolean;
  review_reasons: string[];
}

// ============================================================================
// Main FocusDirective Type
// ============================================================================

export interface FocusDirective {
  directive_id: string; // UUID
  created_at: string; // ISO 8601 timestamp
  raw_input: string; // Original user input

  priorities: Priorities;
  suppressions: Suppressions;
  volume_preference: VolumePreference;
  temporal_context: TemporalContext;
  contradictions: Contradiction[];
  ambiguities: Ambiguity[];
  lithuanian_variants: LithuanianVariants;
  metadata: FocusDirectiveMetadata;
}

// ============================================================================
// Helper Types for Downstream Processing
// ============================================================================

/**
 * Flattened priority item for scoring pipeline.
 * All priorities and suppressions normalized to a single structure.
 */
export interface NormalizedPriorityItem {
  type: 'category' | 'attribute' | 'brand';
  name: string;
  name_lt: string | null;
  variants: string[];
  is_suppression: boolean;
  weight_modifier: number; // >1 for boost, <1 for suppress, 0 for exclude
  scope: TemporalScope;
  valid_until: string | null;
  confidence: number;
}

/**
 * Scoring weight adjustments derived from FocusDirective.
 * Applied during keyword scoring phase.
 */
export interface ScoringWeights {
  category_weights: Map<string, number>;
  attribute_weights: Map<string, number>;
  brand_weights: Map<string, number>;
  excluded_brands: Set<string>;
  excluded_terms: Set<string>;
  volume_strategy: VolumeStrategy;
  high_volume_threshold: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates that a FocusDirective has required fields.
 * Use for runtime validation of LLM output.
 */
export function isValidFocusDirective(obj: unknown): obj is FocusDirective {
  if (!obj || typeof obj !== 'object') return false;

  const d = obj as Record<string, unknown>;

  return (
    typeof d.directive_id === 'string' &&
    typeof d.created_at === 'string' &&
    typeof d.raw_input === 'string' &&
    d.priorities !== null &&
    typeof d.priorities === 'object' &&
    d.suppressions !== null &&
    typeof d.suppressions === 'object' &&
    d.volume_preference !== null &&
    typeof d.volume_preference === 'object' &&
    d.temporal_context !== null &&
    typeof d.temporal_context === 'object' &&
    Array.isArray(d.contradictions) &&
    Array.isArray(d.ambiguities) &&
    d.lithuanian_variants !== null &&
    typeof d.lithuanian_variants === 'object' &&
    d.metadata !== null &&
    typeof d.metadata === 'object'
  );
}

/**
 * Checks if directive requires human review.
 */
export function requiresReview(directive: FocusDirective): boolean {
  return (
    directive.metadata.requires_human_review ||
    directive.metadata.average_confidence < 0.7 ||
    directive.contradictions.length > 0 ||
    directive.ambiguities.some((a) => a.needs_clarification)
  );
}

/**
 * Gets all active (non-expired) items from directive.
 */
export function getActiveItems(
  directive: FocusDirective,
  currentDate: Date = new Date()
): {
  priorities: NormalizedPriorityItem[];
  suppressions: NormalizedPriorityItem[];
} {
  const isActive = (validUntil: string | null): boolean => {
    if (!validUntil) return true;
    return new Date(validUntil) >= currentDate;
  };

  const priorities: NormalizedPriorityItem[] = [];
  const suppressions: NormalizedPriorityItem[] = [];

  // Process category priorities
  for (const cat of directive.priorities.categories) {
    if (isActive(cat.valid_until)) {
      const variants =
        directive.lithuanian_variants.generated.find((v) => v.original === cat.name)?.variants ||
        [];
      priorities.push({
        type: 'category',
        name: cat.name,
        name_lt: cat.name_lt,
        variants,
        is_suppression: false,
        weight_modifier: cat.weight_modifier,
        scope: cat.scope,
        valid_until: cat.valid_until,
        confidence: cat.confidence,
      });
    }
  }

  // Process attribute priorities
  for (const attr of directive.priorities.attributes) {
    if (isActive(attr.valid_until)) {
      const variants =
        directive.lithuanian_variants.generated.find((v) => v.original === attr.attribute)
          ?.variants || [];
      priorities.push({
        type: 'attribute',
        name: attr.attribute,
        name_lt: attr.attribute_lt,
        variants,
        is_suppression: false,
        weight_modifier: attr.boost_factor,
        scope: attr.scope,
        valid_until: attr.valid_until,
        confidence: attr.confidence,
      });
    }
  }

  // Process brand priorities
  for (const brand of directive.priorities.brands) {
    if (isActive(brand.valid_until)) {
      const variants =
        directive.lithuanian_variants.generated.find((v) => v.original === brand.brand)?.variants ||
        [];
      priorities.push({
        type: 'brand',
        name: brand.brand,
        name_lt: null,
        variants,
        is_suppression: false,
        weight_modifier: brand.weight_modifier,
        scope: brand.scope,
        valid_until: brand.valid_until,
        confidence: brand.confidence,
      });
    }
  }

  // Process category suppressions
  for (const cat of directive.suppressions.categories) {
    if (isActive(cat.valid_until)) {
      const variants =
        directive.lithuanian_variants.generated.find((v) => v.original === cat.name)?.variants ||
        [];
      suppressions.push({
        type: 'category',
        name: cat.name,
        name_lt: cat.name_lt,
        variants,
        is_suppression: true,
        weight_modifier: cat.suppress_factor,
        scope: cat.scope,
        valid_until: cat.valid_until,
        confidence: cat.confidence,
      });
    }
  }

  // Process attribute suppressions
  for (const attr of directive.suppressions.attributes) {
    if (isActive(attr.valid_until)) {
      const variants =
        directive.lithuanian_variants.generated.find((v) => v.original === attr.attribute)
          ?.variants || [];
      suppressions.push({
        type: 'attribute',
        name: attr.attribute,
        name_lt: attr.attribute_lt,
        variants,
        is_suppression: true,
        weight_modifier: attr.suppress_factor,
        scope: attr.scope,
        valid_until: attr.valid_until,
        confidence: attr.confidence,
      });
    }
  }

  // Process brand suppressions
  for (const brand of directive.suppressions.brands) {
    if (isActive(brand.valid_until)) {
      const variants =
        directive.lithuanian_variants.generated.find((v) => v.original === brand.brand)?.variants ||
        [];
      suppressions.push({
        type: 'brand',
        name: brand.brand,
        name_lt: null,
        variants,
        is_suppression: true,
        weight_modifier: brand.action === 'EXCLUDE' ? 0 : brand.suppress_factor,
        scope: brand.scope,
        valid_until: brand.valid_until,
        confidence: brand.confidence,
      });
    }
  }

  return { priorities, suppressions };
}

/**
 * Converts FocusDirective to ScoringWeights for the scoring pipeline.
 */
export function toScoringWeights(directive: FocusDirective): ScoringWeights {
  const { priorities, suppressions } = getActiveItems(directive);

  const category_weights = new Map<string, number>();
  const attribute_weights = new Map<string, number>();
  const brand_weights = new Map<string, number>();
  const excluded_brands = new Set<string>();
  const excluded_terms = new Set<string>();

  // Process priorities
  for (const item of priorities) {
    const allTerms = [item.name, item.name_lt, ...item.variants].filter(Boolean) as string[];

    for (const term of allTerms) {
      const lower = term.toLowerCase();
      switch (item.type) {
        case 'category':
          category_weights.set(lower, item.weight_modifier);
          break;
        case 'attribute':
          attribute_weights.set(lower, item.weight_modifier);
          break;
        case 'brand':
          brand_weights.set(lower, item.weight_modifier);
          break;
      }
    }
  }

  // Process suppressions
  for (const item of suppressions) {
    const allTerms = [item.name, item.name_lt, ...item.variants].filter(Boolean) as string[];

    for (const term of allTerms) {
      const lower = term.toLowerCase();

      if (item.weight_modifier === 0) {
        // Complete exclusion
        if (item.type === 'brand') {
          excluded_brands.add(lower);
        } else {
          excluded_terms.add(lower);
        }
      } else {
        // Suppression (reduced weight)
        switch (item.type) {
          case 'category':
            category_weights.set(lower, item.weight_modifier);
            break;
          case 'attribute':
            attribute_weights.set(lower, item.weight_modifier);
            break;
          case 'brand':
            brand_weights.set(lower, item.weight_modifier);
            break;
        }
      }
    }
  }

  return {
    category_weights,
    attribute_weights,
    brand_weights,
    excluded_brands,
    excluded_terms,
    volume_strategy: directive.volume_preference.strategy,
    high_volume_threshold: directive.volume_preference.high_volume_threshold,
  };
}
