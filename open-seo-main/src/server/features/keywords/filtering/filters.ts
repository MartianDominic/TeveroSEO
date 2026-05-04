/**
 * Individual Filter Functions for Keyword Constraint Pipeline
 *
 * Each function is a pure filter that checks one constraint type
 * and returns { passes: boolean, reason?: ExclusionReason }.
 */

import type { GeoConstraints, NegativeFilters, AudienceConstraints, ExclusionReason } from './types';

// ============================================================================
// Pattern Constants
// ============================================================================

/**
 * Default Lithuanian DIY/self-service patterns.
 * These exclude keywords that indicate non-commercial intent.
 * Using looser matching to handle inflected forms.
 */
export const DEFAULT_NEGATIVE_PATTERNS = [
  /pačiam/i,                  // "by myself" (DIY)
  /savitarn/i,                // "self-service" (handles savitarna, savitarnos, etc.)
  /namų sąlygomis/i,          // "at home conditions"
  /nemokamai/i,               // "free" (usually not commercial)
  /kaip padaryti/i,           // "how to make" (DIY)
];

/**
 * B2C patterns - indicate personal/home/family context.
 * Using looser matching to handle inflected forms.
 */
export const B2C_PATTERNS = [
  /asmenin/i,                 // "personal" (handles asmeninis, asmeninė, etc.)
  /namų/i,                    // "home"
  /šeimai/i,                  // "for family"
  /vaikams/i,                 // "for children"
];

/**
 * B2B patterns - indicate business/corporate context.
 * Using looser matching to handle inflected forms.
 */
export const B2B_PATTERNS = [
  /įmonėms/i,                 // "for companies"
  /verslui/i,                 // "for business"
  /korporatyvin/i,            // "corporate" (handles korporatyvinis, korporatyvinė, etc.)
  /autoparkui/i,              // "for fleet"
  /flotai/i,                  // "fleets"
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a keyword contains a term, accounting for Lithuanian inflections.
 * Uses stem-based matching by removing common endings.
 */
function containsTermStemMatch(keyword: string, term: string): boolean {
  const keywordLower = keyword.toLowerCase();
  const termLower = term.toLowerCase();

  // Direct substring match
  if (keywordLower.includes(termLower)) {
    return true;
  }

  // Lithuanian stem matching: remove common endings
  const endings = ['a', 'as', 'os', 'ai', 'ų', 'oms', 'o', 'ė', 'ės', 'ei', 'ėms'];

  for (const ending of endings) {
    if (termLower.endsWith(ending) && termLower.length > ending.length + 3) {
      const stem = termLower.slice(0, -ending.length);
      if (keywordLower.includes(stem)) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Filter Result Interface
// ============================================================================

interface FilterCheckResult {
  passes: boolean;
  reason?: ExclusionReason;
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Check geographic constraints.
 *
 * Excludes keywords that:
 * - Target the wrong city (not in includeCities)
 * - Are generic (no city) when genericAllowed is false
 */
export function checkGeoFilter(
  keyword: string,
  geoClassification: { passesGeoFilter: boolean; city?: string; geoScore: number } | undefined,
  constraints: GeoConstraints | undefined
): FilterCheckResult {
  // No constraints = pass
  if (!constraints) {
    return { passes: true };
  }

  // No geo classification data = pass (can't filter without data)
  if (!geoClassification) {
    return { passes: true };
  }

  // If geo classifier already marked it as failing
  if (!geoClassification.passesGeoFilter) {
    const city = geoClassification.city || 'unknown';
    return {
      passes: false,
      reason: `geo:wrong_city:${city}` as ExclusionReason,
    };
  }

  // Check for generic (no city) keywords
  if (!geoClassification.city) {
    if (!constraints.genericAllowed) {
      return {
        passes: false,
        reason: 'geo:generic_not_allowed',
      };
    }
    // Generic allowed, pass
    return { passes: true };
  }

  // If we have a city and includeCities is specified, verify it's in the list
  if (constraints.includeCities && constraints.includeCities.length > 0) {
    const cityLower = geoClassification.city.toLowerCase();
    const isInTargetList = constraints.includeCities.some(
      c => c.toLowerCase() === cityLower
    );
    if (!isInTargetList) {
      return {
        passes: false,
        reason: `geo:wrong_city:${geoClassification.city}` as ExclusionReason,
      };
    }
  }

  // All checks passed
  return { passes: true };
}

/**
 * Check negative term/brand/intent filters.
 *
 * Excludes keywords that match:
 * - Excluded terms (case-insensitive substring)
 * - Competitor brands
 * - Negative intent patterns (DIY, self-service, etc.)
 */
export function checkNegativeFilter(
  keyword: string,
  filters: NegativeFilters | undefined
): FilterCheckResult {
  // No filters = pass
  if (!filters) {
    return { passes: true };
  }

  const keywordLower = keyword.toLowerCase();

  // Check excluded terms (with stem matching for inflections)
  if (filters.excludeTerms && filters.excludeTerms.length > 0) {
    for (const term of filters.excludeTerms) {
      if (containsTermStemMatch(keyword, term)) {
        return {
          passes: false,
          reason: `negative:term:${term.toLowerCase()}` as ExclusionReason,
        };
      }
    }
  }

  // Check excluded brands (with stem matching)
  if (filters.excludeBrands && filters.excludeBrands.length > 0) {
    for (const brand of filters.excludeBrands) {
      if (containsTermStemMatch(keyword, brand)) {
        return {
          passes: false,
          reason: `negative:brand:${brand.toLowerCase()}` as ExclusionReason,
        };
      }
    }
  }

  // Check negative intent patterns (with stem matching)
  if (filters.excludeIntents && filters.excludeIntents.length > 0) {
    for (const intent of filters.excludeIntents) {
      if (containsTermStemMatch(keyword, intent)) {
        return {
          passes: false,
          reason: `negative:intent:${intent.toLowerCase()}` as ExclusionReason,
        };
      }
    }
  }

  // Check default Lithuanian DIY patterns
  if (filters.defaultPatterns) {
    for (const pattern of DEFAULT_NEGATIVE_PATTERNS) {
      if (pattern.test(keyword)) {
        // Extract the matched pattern term for the reason
        const match = keyword.match(pattern);
        const matchedTerm = match ? match[0].toLowerCase() : 'default_pattern';
        return {
          passes: false,
          reason: `negative:term:${matchedTerm}` as ExclusionReason,
        };
      }
    }
  }

  // All checks passed
  return { passes: true };
}

/**
 * Check audience constraints (B2B vs B2C).
 *
 * Excludes keywords that:
 * - Match B2C patterns when b2bOnly is true
 * - Match B2B patterns when b2cAllowed is false (future)
 */
export function checkAudienceFilter(
  keyword: string,
  constraints: AudienceConstraints | undefined
): FilterCheckResult {
  // No constraints = pass
  if (!constraints) {
    return { passes: true };
  }

  // If B2B only mode, exclude B2C patterns (but allow B2B patterns)
  if (constraints.b2bOnly) {
    const hasB2CPattern = B2C_PATTERNS.some(pattern => pattern.test(keyword));
    if (hasB2CPattern) {
      return {
        passes: false,
        reason: 'audience:b2c_excluded',
      };
    }
    // B2B patterns are allowed in b2bOnly mode, so we don't check them
  }

  // If B2C not allowed (strict B2B mode - different from b2bOnly)
  // Currently b2cAllowed defaults to true, so this is rarely used
  // This would exclude both B2C AND B2B patterns, allowing only neutral keywords
  if (constraints.b2cAllowed === false && !constraints.b2bOnly) {
    const hasB2BPattern = B2B_PATTERNS.some(pattern => pattern.test(keyword));
    if (hasB2BPattern) {
      return {
        passes: false,
        reason: 'audience:b2b_excluded',
      };
    }
  }

  // All checks passed
  return { passes: true };
}

/**
 * Check relevance threshold filter.
 *
 * Excludes keywords with combinedScore below the threshold.
 * If no score provided, passes (can't filter without data).
 */
export function checkRelevanceFilter(
  combinedScore: number | undefined,
  threshold: number
): FilterCheckResult {
  // No score data = pass (can't filter without data)
  if (combinedScore === undefined) {
    return { passes: true };
  }

  // Check if below threshold
  if (combinedScore < threshold) {
    return {
      passes: false,
      reason: `relevance:below_threshold:${combinedScore.toFixed(2)}` as ExclusionReason,
    };
  }

  // Passed threshold
  return { passes: true };
}
