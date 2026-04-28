/**
 * Tier 3 Checks Index
 * Phase 32: 107 SEO Checks Implementation
 *
 * Registers all 13 Tier 3 API-required checks.
 * Tier 3 provides 10 of 40 variable points in the scoring system.
 */

// Import all category files to register checks
import "./cwv"; // T3-01 to T3-03
import "./entity-nlp"; // T3-04 to T3-07
import "./backlinks"; // T3-08 to T3-10
import "./engagement"; // T3-11 to T3-13

// Re-export check IDs for documentation
export { cwvCheckIds } from "./cwv";
export { entityNlpCheckIds } from "./entity-nlp";
export { backlinksCheckIds } from "./backlinks";
export { engagementCheckIds } from "./engagement";

// Export aggregated check info
import { getChecksByTier } from "../registry";

/**
 * Get all Tier 3 check definitions.
 */
export function getTier3Checks() {
  return getChecksByTier(3);
}

/**
 * Expected Tier 3 check IDs.
 */
export const TIER_3_CHECK_IDS = [
  // Core Web Vitals (T3-01 to T3-03)
  "T3-01", // LCP <= 2.5s
  "T3-02", // INP <= 200ms
  "T3-03", // CLS <= 0.1
  // Entity/NLP Analysis (T3-04 to T3-07)
  "T3-04", // Entity coverage >= 60%
  "T3-05", // Central entity in every section
  "T3-06", // No term > 2x competitor max
  "T3-07", // Semantic gap identification
  // Backlink Analysis (T3-08 to T3-10)
  "T3-08", // Link velocity 5-10/month
  "T3-09", // Anchor text ratio natural
  "T3-10", // Outbound link DR 50+
  // Engagement Proxies (T3-11 to T3-13)
  "T3-11", // CTR vs position expectation
  "T3-12", // Scroll depth >= 60%
  "T3-13", // Bounce rate vs benchmark
] as const;

/**
 * Verify all Tier 3 checks are registered.
 */
export function verifyTier3Registration(): { valid: boolean; missing: string[]; extra: string[] } {
  const registered = getTier3Checks();
  const registeredIds = new Set(registered.map((c) => c.id));
  const expectedIds = new Set(TIER_3_CHECK_IDS);

  const missing = TIER_3_CHECK_IDS.filter((id) => !registeredIds.has(id));
  const extra = Array.from(registeredIds).filter((id) => !expectedIds.has(id as typeof TIER_3_CHECK_IDS[number]));

  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
