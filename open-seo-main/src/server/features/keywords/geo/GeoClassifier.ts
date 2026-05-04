import type { GeoClassification, GeoConstraints } from "./types";
import { GeoConstraintsSchema } from "./types";
import { findCity, NEAR_ME_PATTERNS } from "./cities";

export class GeoClassifier {
  /**
   * Classify a keyword based on geographic constraints
   */
  classify(keyword: string, constraints: Partial<GeoConstraints> = {}): GeoClassification {
    const opts = GeoConstraintsSchema.parse(constraints);
    const lowerKeyword = keyword.toLowerCase().trim();

    // 1. Extract city from keyword
    const cityMatch = this.extractCity(lowerKeyword);

    // 2. Check near-me patterns
    const isNearMe = this.checkNearMe(lowerKeyword);

    // 3. Determine classification
    if (cityMatch) {
      return this.classifyWithCity(cityMatch, opts);
    }
    if (isNearMe) {
      return this.classifyNearMe(opts);
    }
    return this.classifyGeneric(opts);
  }

  /**
   * Classify multiple keywords in batch
   */
  classifyBatch(keywords: string[], constraints: Partial<GeoConstraints> = {}): GeoClassification[] {
    return keywords.map(kw => this.classify(kw, constraints));
  }

  /**
   * Extract city from keyword, filtering out street references
   */
  private extractCity(keyword: string): string | null {
    // Street suffixes that indicate this is NOT a city reference
    const streetSuffixes = ["g.", "gatve", "gatves", "gatvė", "gatvės", "prospektas", "aleja", "skersgatvis"];

    // Split into words
    const words = keyword.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Check if next word is a street suffix
      if (i + 1 < words.length && streetSuffixes.includes(words[i + 1])) {
        // This is a street reference, skip
        continue;
      }

      // Try to find city
      const city = findCity(word);
      if (city) {
        return city.name;
      }
    }

    return null;
  }

  /**
   * Check if keyword contains near-me patterns
   */
  private checkNearMe(keyword: string): boolean {
    return NEAR_ME_PATTERNS.some(pattern => pattern.test(keyword));
  }

  /**
   * Classify keyword with explicit city
   */
  private classifyWithCity(city: string, opts: GeoConstraints): GeoClassification {
    // Check if excluded
    if (opts.excludeCities.includes(city)) {
      return {
        hasExplicitCity: true,
        city,
        isNearMe: false,
        isGeneric: false,
        passesGeoFilter: false,
        geoScore: 0.0,
        reason: `Excluded city: ${city}`,
      };
    }

    // Check if included (or no include filter)
    const isIncluded = opts.includeCities.length === 0 || opts.includeCities.includes(city);

    if (isIncluded) {
      return {
        hasExplicitCity: true,
        city,
        isNearMe: false,
        isGeneric: false,
        passesGeoFilter: true,
        geoScore: 1.0,
        reason: `Target city: ${city}`,
      };
    }

    // City not in target list
    return {
      hasExplicitCity: true,
      city,
      isNearMe: false,
      isGeneric: false,
      passesGeoFilter: false,
      geoScore: 0.0,
      reason: `City ${city} not in target list`,
    };
  }

  /**
   * Classify keyword with near-me pattern
   */
  private classifyNearMe(opts: GeoConstraints): GeoClassification {
    return {
      hasExplicitCity: false,
      city: null,
      isNearMe: true,
      isGeneric: false,
      passesGeoFilter: opts.nearMeAllowed,
      geoScore: opts.nearMeAllowed ? 0.9 : 0.0,
      reason: opts.nearMeAllowed ? "Near-me allowed" : "Near-me not allowed",
    };
  }

  /**
   * Classify generic keyword (no city, no near-me)
   */
  private classifyGeneric(opts: GeoConstraints): GeoClassification {
    return {
      hasExplicitCity: false,
      city: null,
      isNearMe: false,
      isGeneric: true,
      passesGeoFilter: opts.genericAllowed,
      geoScore: opts.genericAllowed ? 0.5 : 0.0,
      reason: opts.genericAllowed ? "Generic allowed" : "Generic not allowed",
    };
  }
}

// Singleton instance
export const geoClassifier = new GeoClassifier();
