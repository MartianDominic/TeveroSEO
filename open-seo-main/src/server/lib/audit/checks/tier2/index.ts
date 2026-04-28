/**
 * Tier 2 Checks Index
 * Phase 32: 107 SEO Checks Implementation
 *
 * Registers all 21 Tier 2 light calculation checks.
 * Tier 2 provides 10 of 40 variable points in the scoring system.
 */

// Import all category files to register checks
import "./content-quality"; // T2-01 to T2-05
import "./anchor-analysis"; // T2-06 to T2-08
import "./schema-completeness"; // T2-09 to T2-14
import "./freshness"; // T2-15 to T2-17
import "./mobile"; // T2-18 to T2-21

// Re-export check IDs for documentation
export { contentQualityCheckIds } from "./content-quality";
export { anchorAnalysisCheckIds } from "./anchor-analysis";
export { schemaCompletenessCheckIds } from "./schema-completeness";
export { freshnessCheckIds } from "./freshness";
export { mobileCheckIds } from "./mobile";

// Export aggregated check info
import { getChecksByTier } from "../registry";

/**
 * Get all Tier 2 check definitions.
 */
export function getTier2Checks() {
  return getChecksByTier(2);
}

/**
 * Expected Tier 2 check IDs.
 */
export const TIER_2_CHECK_IDS = [
  // Content Quality (T2-01 to T2-05)
  "T2-01", // Reading level <= Grade 9
  "T2-02", // Keyword density < 3%
  "T2-03", // Word count by query type
  "T2-04", // Statistics every 150-200 words
  "T2-05", // Section word count 167-278
  // Anchor Analysis (T2-06 to T2-08)
  "T2-06", // >=10 unique anchor variations
  "T2-07", // 50% exact / 25% branded / 25% misc ratio
  "T2-08", // Links evenly distributed
  // Schema Completeness (T2-09 to T2-14)
  "T2-09", // author.url to author page
  "T2-10", // author.sameAs has 3+ links
  "T2-11", // author.sameAs includes LinkedIn
  "T2-12", // Organization sameAs array
  "T2-13", // publisher.logo >= 112x112px
  "T2-14", // citation array on YMYL
  // Freshness Signals (T2-15 to T2-17)
  "T2-15", // Visible date matches schema date
  "T2-16", // sitemap lastmod matches schema
  "T2-17", // No date-only updates
  // Mobile Checks (T2-18 to T2-21)
  "T2-18", // H1 above fold on mobile
  "T2-19", // No interstitials on load
  "T2-20", // Tap targets >= 48px
  "T2-21", // Text >= 16px on mobile
] as const;

/**
 * Verify all Tier 2 checks are registered.
 */
export function verifyTier2Registration(): { valid: boolean; missing: string[]; extra: string[] } {
  const registered = getTier2Checks();
  const registeredIds = new Set(registered.map((c) => c.id));
  const expectedIds = new Set(TIER_2_CHECK_IDS);

  const missing = TIER_2_CHECK_IDS.filter((id) => !registeredIds.has(id));
  const extra = Array.from(registeredIds).filter((id) => !expectedIds.has(id as typeof TIER_2_CHECK_IDS[number]));

  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
