/**
 * BusinessPriorityParser Tests
 *
 * Tests for the business priority parser and focus directive types.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  FocusDirective,
  isValidFocusDirective,
  requiresReview,
  getActiveItems,
  toScoringWeights,
  NormalizedPriorityItem,
} from '../types/focus-directive';

// ============================================================================
// Test Fixtures
// ============================================================================

const createValidDirective = (overrides: Partial<FocusDirective> = {}): FocusDirective => ({
  directive_id: 'test-uuid-123',
  created_at: '2026-04-26T10:00:00Z',
  raw_input: 'Test input',

  priorities: {
    categories: [
      {
        name: 'Electronics',
        name_lt: 'Elektronika',
        weight_modifier: 1.5,
        scope: 'PERMANENT',
        valid_until: null,
        confidence: 0.95,
      },
    ],
    attributes: [
      {
        attribute: 'premium',
        attribute_lt: 'aukščiausios kokybės',
        boost_factor: 1.8,
        scope: 'PERMANENT',
        valid_until: null,
        confidence: 0.9,
      },
    ],
    brands: [
      {
        brand: 'Samsung',
        action: 'PROMOTE',
        weight_modifier: 2.0,
        scope: 'QUARTERLY',
        valid_until: '2026-06-30',
        confidence: 0.98,
      },
    ],
  },

  suppressions: {
    categories: [],
    attributes: [
      {
        attribute: 'cheap',
        attribute_lt: 'pigus',
        suppress_factor: 0.3,
        scope: 'PERMANENT',
        valid_until: null,
        reason: 'brand positioning',
        confidence: 0.95,
      },
    ],
    brands: [
      {
        brand: 'Pigu',
        action: 'EXCLUDE',
        suppress_factor: 0.0,
        scope: 'PERMANENT',
        valid_until: null,
        reason: 'competitor',
        confidence: 0.99,
      },
    ],
  },

  volume_preference: {
    strategy: 'BALANCED',
    high_volume_threshold: 1000,
    long_tail_max_words: 5,
    rationale: 'No explicit preference',
    confidence: 0.7,
  },

  temporal_context: {
    detection_signals: ['this quarter'],
    primary_scope: 'QUARTERLY',
    quarter: 'Q2',
    season: null,
    campaign_name: null,
    effective_date: '2026-04-01',
    expiry_date: '2026-06-30',
  },

  contradictions: [],
  ambiguities: [],

  lithuanian_variants: {
    generated: [
      {
        original: 'Electronics',
        variants: ['Elektronika', 'elektronikos'],
        includes_misspellings: false,
      },
      {
        original: 'Samsung',
        variants: ['Samsung', 'Samsungas'],
        includes_misspellings: false,
      },
      {
        original: 'Pigu',
        variants: ['Pigu', 'pigu.lt'],
        includes_misspellings: false,
      },
    ],
  },

  metadata: {
    parser_version: '1.0.0',
    total_priorities_extracted: 3,
    total_suppressions_extracted: 2,
    average_confidence: 0.93,
    requires_human_review: false,
    review_reasons: [],
  },

  ...overrides,
});

// ============================================================================
// Type Validation Tests
// ============================================================================

describe('isValidFocusDirective', () => {
  it('should return true for valid directive', () => {
    const directive = createValidDirective();
    expect(isValidFocusDirective(directive)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isValidFocusDirective(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isValidFocusDirective(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isValidFocusDirective('string')).toBe(false);
    expect(isValidFocusDirective(123)).toBe(false);
    expect(isValidFocusDirective([])).toBe(false);
  });

  it('should return false for missing required fields', () => {
    const incomplete = {
      directive_id: 'test',
      created_at: '2026-04-26T10:00:00Z',
      // missing raw_input and other fields
    };
    expect(isValidFocusDirective(incomplete)).toBe(false);
  });

  it('should return false for wrong field types', () => {
    const wrongTypes = {
      directive_id: 123, // should be string
      created_at: '2026-04-26T10:00:00Z',
      raw_input: 'test',
      priorities: {},
      suppressions: {},
      volume_preference: {},
      temporal_context: {},
      contradictions: [],
      ambiguities: [],
      lithuanian_variants: {},
      metadata: {},
    };
    expect(isValidFocusDirective(wrongTypes)).toBe(false);
  });
});

// ============================================================================
// Review Detection Tests
// ============================================================================

describe('requiresReview', () => {
  it('should return false when metadata.requires_human_review is false and confidence is high', () => {
    const directive = createValidDirective();
    expect(requiresReview(directive)).toBe(false);
  });

  it('should return true when metadata.requires_human_review is true', () => {
    const directive = createValidDirective({
      metadata: {
        ...createValidDirective().metadata,
        requires_human_review: true,
        review_reasons: ['Test reason'],
      },
    });
    expect(requiresReview(directive)).toBe(true);
  });

  it('should return true when average_confidence is below 0.7', () => {
    const directive = createValidDirective({
      metadata: {
        ...createValidDirective().metadata,
        average_confidence: 0.5,
      },
    });
    expect(requiresReview(directive)).toBe(true);
  });

  it('should return true when contradictions exist', () => {
    const directive = createValidDirective({
      contradictions: [
        {
          conflict: 'Test conflict',
          items: ['item1', 'item2'],
          resolution_suggestion: 'Clarify',
        },
      ],
    });
    expect(requiresReview(directive)).toBe(true);
  });

  it('should return true when ambiguities need clarification', () => {
    const directive = createValidDirective({
      ambiguities: [
        {
          statement: 'Maybe include X',
          possible_interpretations: ['include', 'exclude'],
          chosen_interpretation: null,
          needs_clarification: true,
        },
      ],
    });
    expect(requiresReview(directive)).toBe(true);
  });

  it('should return false when ambiguities do not need clarification', () => {
    const directive = createValidDirective({
      ambiguities: [
        {
          statement: 'Probably include X',
          possible_interpretations: ['include'],
          chosen_interpretation: 'include',
          needs_clarification: false,
        },
      ],
    });
    expect(requiresReview(directive)).toBe(false);
  });
});

// ============================================================================
// Active Items Filtering Tests
// ============================================================================

describe('getActiveItems', () => {
  it('should return all items when no expiry dates', () => {
    const directive = createValidDirective({
      priorities: {
        categories: [
          {
            name: 'Test',
            name_lt: 'Testas',
            weight_modifier: 1.5,
            scope: 'PERMANENT',
            valid_until: null,
            confidence: 0.9,
          },
        ],
        attributes: [],
        brands: [],
      },
      suppressions: {
        categories: [],
        attributes: [],
        brands: [],
      },
    });

    const { priorities, suppressions } = getActiveItems(directive);
    expect(priorities).toHaveLength(1);
    expect(suppressions).toHaveLength(0);
  });

  it('should filter out expired items', () => {
    const pastDate = '2020-01-01';
    const futureDate = '2030-01-01';
    const currentDate = new Date('2026-04-26');

    const directive = createValidDirective({
      priorities: {
        categories: [
          {
            name: 'Expired',
            name_lt: 'Pasibaigęs',
            weight_modifier: 1.5,
            scope: 'QUARTERLY',
            valid_until: pastDate,
            confidence: 0.9,
          },
          {
            name: 'Active',
            name_lt: 'Aktyvus',
            weight_modifier: 1.5,
            scope: 'QUARTERLY',
            valid_until: futureDate,
            confidence: 0.9,
          },
        ],
        attributes: [],
        brands: [],
      },
      suppressions: {
        categories: [],
        attributes: [],
        brands: [],
      },
    });

    const { priorities } = getActiveItems(directive, currentDate);
    expect(priorities).toHaveLength(1);
    expect(priorities[0].name).toBe('Active');
  });

  it('should include Lithuanian variants from directive', () => {
    const directive = createValidDirective();
    const { priorities } = getActiveItems(directive);

    const electronicsPriority = priorities.find((p) => p.name === 'Electronics');
    expect(electronicsPriority?.variants).toContain('Elektronika');
    expect(electronicsPriority?.variants).toContain('elektronikos');
  });

  it('should set weight_modifier to 0 for EXCLUDE action', () => {
    const directive = createValidDirective();
    const { suppressions } = getActiveItems(directive);

    const piguSuppression = suppressions.find((s) => s.name === 'Pigu');
    expect(piguSuppression?.weight_modifier).toBe(0);
  });

  it('should normalize all priority types correctly', () => {
    const directive = createValidDirective();
    const { priorities, suppressions } = getActiveItems(directive);

    // Check category priority
    const categoryItem = priorities.find((p) => p.type === 'category');
    expect(categoryItem).toBeDefined();
    expect(categoryItem?.name).toBe('Electronics');
    expect(categoryItem?.is_suppression).toBe(false);

    // Check attribute priority
    const attributeItem = priorities.find((p) => p.type === 'attribute');
    expect(attributeItem).toBeDefined();
    expect(attributeItem?.name).toBe('premium');

    // Check brand priority
    const brandItem = priorities.find((p) => p.type === 'brand');
    expect(brandItem).toBeDefined();
    expect(brandItem?.name).toBe('Samsung');

    // Check attribute suppression
    const attrSuppression = suppressions.find((s) => s.type === 'attribute');
    expect(attrSuppression).toBeDefined();
    expect(attrSuppression?.name).toBe('cheap');
    expect(attrSuppression?.is_suppression).toBe(true);

    // Check brand suppression
    const brandSuppression = suppressions.find((s) => s.type === 'brand');
    expect(brandSuppression).toBeDefined();
    expect(brandSuppression?.name).toBe('Pigu');
  });
});

// ============================================================================
// Scoring Weights Conversion Tests
// ============================================================================

describe('toScoringWeights', () => {
  it('should populate category weights from priorities', () => {
    const directive = createValidDirective();
    const weights = toScoringWeights(directive);

    expect(weights.category_weights.has('electronics')).toBe(true);
    expect(weights.category_weights.get('electronics')).toBe(1.5);

    // Should also have Lithuanian variant
    expect(weights.category_weights.has('elektronika')).toBe(true);
  });

  it('should populate attribute weights from priorities', () => {
    const directive = createValidDirective();
    const weights = toScoringWeights(directive);

    expect(weights.attribute_weights.has('premium')).toBe(true);
    expect(weights.attribute_weights.get('premium')).toBe(1.8);
  });

  it('should populate brand weights from priorities', () => {
    const directive = createValidDirective();
    const weights = toScoringWeights(directive);

    expect(weights.brand_weights.has('samsung')).toBe(true);
    expect(weights.brand_weights.get('samsung')).toBe(2.0);
  });

  it('should add excluded brands to excluded_brands set', () => {
    const directive = createValidDirective();
    const weights = toScoringWeights(directive);

    expect(weights.excluded_brands.has('pigu')).toBe(true);
    expect(weights.excluded_brands.has('pigu.lt')).toBe(true);
  });

  it('should add suppressed attributes with reduced weight', () => {
    const directive = createValidDirective();
    const weights = toScoringWeights(directive);

    expect(weights.attribute_weights.has('cheap')).toBe(true);
    expect(weights.attribute_weights.get('cheap')).toBe(0.3);
    expect(weights.attribute_weights.has('pigus')).toBe(true);
  });

  it('should set volume strategy from directive', () => {
    const directive = createValidDirective();
    const weights = toScoringWeights(directive);

    expect(weights.volume_strategy).toBe('BALANCED');
    expect(weights.high_volume_threshold).toBe(1000);
  });

  it('should lowercase all terms for case-insensitive matching', () => {
    const directive = createValidDirective({
      priorities: {
        categories: [
          {
            name: 'UPPERCASE',
            name_lt: 'DIDŽIOSIOS',
            weight_modifier: 1.5,
            scope: 'PERMANENT',
            valid_until: null,
            confidence: 0.9,
          },
        ],
        attributes: [],
        brands: [],
      },
      suppressions: {
        categories: [],
        attributes: [],
        brands: [],
      },
    });

    const weights = toScoringWeights(directive);
    expect(weights.category_weights.has('uppercase')).toBe(true);
    expect(weights.category_weights.has('didžiosios')).toBe(true);
  });

  it('should handle empty directive gracefully', () => {
    const emptyDirective = createValidDirective({
      priorities: {
        categories: [],
        attributes: [],
        brands: [],
      },
      suppressions: {
        categories: [],
        attributes: [],
        brands: [],
      },
      lithuanian_variants: {
        generated: [],
      },
    });

    const weights = toScoringWeights(emptyDirective);
    expect(weights.category_weights.size).toBe(0);
    expect(weights.attribute_weights.size).toBe(0);
    expect(weights.brand_weights.size).toBe(0);
    expect(weights.excluded_brands.size).toBe(0);
    expect(weights.excluded_terms.size).toBe(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle mixed scope items correctly', () => {
    const directive = createValidDirective({
      priorities: {
        categories: [
          {
            name: 'Permanent',
            name_lt: 'Nuolatinis',
            weight_modifier: 1.5,
            scope: 'PERMANENT',
            valid_until: null,
            confidence: 0.9,
          },
          {
            name: 'Seasonal',
            name_lt: 'Sezoninis',
            weight_modifier: 2.0,
            scope: 'SEASONAL',
            valid_until: '2026-08-31',
            confidence: 0.85,
          },
        ],
        attributes: [],
        brands: [],
      },
      suppressions: {
        categories: [],
        attributes: [],
        brands: [],
      },
    });

    const { priorities } = getActiveItems(directive, new Date('2026-06-01'));
    expect(priorities).toHaveLength(2);

    const permanent = priorities.find((p) => p.scope === 'PERMANENT');
    const seasonal = priorities.find((p) => p.scope === 'SEASONAL');

    expect(permanent?.valid_until).toBeNull();
    expect(seasonal?.valid_until).toBe('2026-08-31');
  });

  it('should handle items without Lithuanian variants', () => {
    const directive = createValidDirective({
      priorities: {
        categories: [
          {
            name: 'NoVariants',
            name_lt: 'BePakaitų',
            weight_modifier: 1.5,
            scope: 'PERMANENT',
            valid_until: null,
            confidence: 0.9,
          },
        ],
        attributes: [],
        brands: [],
      },
      lithuanian_variants: {
        generated: [], // No variants for NoVariants
      },
    });

    const { priorities } = getActiveItems(directive);
    const item = priorities.find((p) => p.name === 'NoVariants');

    expect(item?.variants).toEqual([]);
    expect(item?.name_lt).toBe('BePakaitų');
  });

  it('should handle DEMOTE action differently from EXCLUDE', () => {
    const directive = createValidDirective({
      suppressions: {
        categories: [],
        attributes: [],
        brands: [
          {
            brand: 'DemotedBrand',
            action: 'DEMOTE',
            suppress_factor: 0.3,
            scope: 'PERMANENT',
            valid_until: null,
            reason: 'lower priority',
            confidence: 0.9,
          },
          {
            brand: 'ExcludedBrand',
            action: 'EXCLUDE',
            suppress_factor: 0.0,
            scope: 'PERMANENT',
            valid_until: null,
            reason: 'competitor',
            confidence: 0.99,
          },
        ],
      },
    });

    const weights = toScoringWeights(directive);

    // Demoted brand should have reduced weight, not excluded
    expect(weights.brand_weights.has('demotedbrand')).toBe(true);
    expect(weights.brand_weights.get('demotedbrand')).toBe(0.3);
    expect(weights.excluded_brands.has('demotedbrand')).toBe(false);

    // Excluded brand should be in excluded set
    expect(weights.excluded_brands.has('excludedbrand')).toBe(true);
    expect(weights.brand_weights.has('excludedbrand')).toBe(false);
  });
});

// ============================================================================
// Integration-like Tests (without actual API calls)
// ============================================================================

describe('FocusDirective Integration', () => {
  it('should support full workflow: directive -> active items -> weights', () => {
    const directive = createValidDirective();

    // Step 1: Validate directive
    expect(isValidFocusDirective(directive)).toBe(true);

    // Step 2: Check if review needed
    const needsReview = requiresReview(directive);
    expect(needsReview).toBe(false);

    // Step 3: Get active items
    const { priorities, suppressions } = getActiveItems(directive);
    expect(priorities.length).toBeGreaterThan(0);

    // Step 4: Convert to scoring weights
    const weights = toScoringWeights(directive);
    expect(weights.category_weights.size).toBeGreaterThan(0);
    expect(weights.volume_strategy).toBe('BALANCED');
  });

  it('should handle review-required directive workflow', () => {
    const directive = createValidDirective({
      metadata: {
        ...createValidDirective().metadata,
        average_confidence: 0.5,
        requires_human_review: true,
        review_reasons: ['Low confidence', 'Ambiguous input'],
      },
      contradictions: [
        {
          conflict: 'Volume strategy conflict',
          items: ['high volume', 'long tail'],
          resolution_suggestion: 'Clarify target strategy',
        },
      ],
    });

    expect(isValidFocusDirective(directive)).toBe(true);
    expect(requiresReview(directive)).toBe(true);

    // Should still produce weights even when review needed
    const weights = toScoringWeights(directive);
    expect(weights).toBeDefined();
  });
});
