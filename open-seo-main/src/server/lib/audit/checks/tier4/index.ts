/**
 * Tier 4 Checks Index
 * Phase 32: 107 SEO Checks Implementation
 *
 * Registers all 7 Tier 4 crawl-based checks.
 * Tier 4 checks require site-wide crawl data (SiteContext).
 */

// Import all category files to register checks
import "./architecture"; // T4-01 to T4-05
import "./differentiation"; // T4-06 to T4-07

// Re-export check IDs for documentation
export { architectureCheckIds } from "./architecture";
export { differentiationCheckIds } from "./differentiation";

// Export aggregated check info
import { getChecksByTier } from "../registry";

/**
 * Get all Tier 4 check definitions.
 */
export function getTier4Checks() {
  return getChecksByTier(4);
}

/**
 * Expected Tier 4 check IDs.
 */
export const TIER_4_CHECK_IDS = [
  // Site Architecture (T4-01 to T4-05)
  "T4-01", // Click depth <= 3
  "T4-02", // No orphan pages
  "T4-03", // Pillar links to all spokes
  "T4-04", // Spokes link back to pillar
  "T4-05", // 15-25 spokes per cluster
  // Content Differentiation (T4-06 to T4-07)
  "T4-06", // 30-40% unique content
  "T4-07", // No scaled content patterns
] as const;

/**
 * Verify all Tier 4 checks are registered.
 */
export function verifyTier4Registration(): { valid: boolean; missing: string[]; extra: string[] } {
  const registered = getTier4Checks();
  const registeredIds = new Set(registered.map((c) => c.id));
  const expectedIds = new Set(TIER_4_CHECK_IDS);

  const missing = TIER_4_CHECK_IDS.filter((id) => !registeredIds.has(id));
  const extra = Array.from(registeredIds).filter((id) => !expectedIds.has(id as typeof TIER_4_CHECK_IDS[number]));

  return {
    valid: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
