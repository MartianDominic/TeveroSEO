/**
 * Check registry for SEO checks.
 * Phase 32: 107 SEO Checks Implementation
 */
import type { CheckDefinition, CheckTier, CheckCategory } from "./types";

/** Registry storage by tier */
const checksByTier = new Map<CheckTier, CheckDefinition[]>();

/** Registry storage by category */
const checksByCategory = new Map<CheckCategory, CheckDefinition[]>();

/** All registered checks by ID */
const checksById = new Map<string, CheckDefinition>();

/**
 * Register a check in the registry.
 */
export function registerCheck(check: CheckDefinition): void {
  // Store by ID
  checksById.set(check.id, check);

  // Store by tier
  const tierChecks = checksByTier.get(check.tier) ?? [];
  tierChecks.push(check);
  checksByTier.set(check.tier, tierChecks);

  // Store by category
  const categoryChecks = checksByCategory.get(check.category) ?? [];
  categoryChecks.push(check);
  checksByCategory.set(check.category, categoryChecks);
}

/**
 * Get all checks for a specific tier.
 */
export function getChecksByTier(tier: CheckTier): CheckDefinition[] {
  return checksByTier.get(tier) ?? [];
}

/**
 * Get all checks for a specific category.
 */
export function getChecksByCategory(category: CheckCategory): CheckDefinition[] {
  return checksByCategory.get(category) ?? [];
}

/**
 * Get a check by its ID.
 */
export function getCheckById(id: string): CheckDefinition | undefined {
  return checksById.get(id);
}

/**
 * Get all registered checks.
 */
export function getAllChecks(): CheckDefinition[] {
  return Array.from(checksById.values());
}

/**
 * Clear registry (for testing).
 */
export function clearRegistry(): void {
  checksById.clear();
  checksByTier.clear();
  checksByCategory.clear();
}
