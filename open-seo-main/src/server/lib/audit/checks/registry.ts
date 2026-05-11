/**
 * Check registry for SEO checks.
 * Phase 32: 107 SEO Checks Implementation
 * Phase 100: JSON-based context support
 */
import type {
  CheckDefinition,
  CheckTier,
  CheckCategory,
  CheckContext,
  SEODataContext,
  AnyCheckContext,
  CheckResult,
} from "./types";
import { isSEODataContext } from "./types";

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

/**
 * Phase 100: Execute a check with the appropriate context type.
 *
 * Routing logic:
 * 1. If SEODataContext provided AND check has runV2 → use runV2
 * 2. If SEODataContext provided AND check is v2Only → skip (return null)
 * 3. If CheckContext provided AND check has run → use run
 * 4. If CheckContext provided AND check is v2Only → skip (return null)
 *
 * @param check - The check definition to execute
 * @param ctx - Either CheckContext (Cheerio) or SEODataContext (JSON)
 * @param forceLegacy - Force use of legacy run() even if runV2 available
 * @returns CheckResult or null if check should be skipped
 */
export async function executeCheck(
  check: CheckDefinition,
  ctx: AnyCheckContext,
  forceLegacy = false
): Promise<CheckResult | null> {
  const isJsonContext = isSEODataContext(ctx);

  // JSON context provided
  if (isJsonContext) {
    // Prefer runV2 if available and not forcing legacy
    if (check.runV2 && !forceLegacy) {
      return check.runV2(ctx);
    }
    // v2Only check but no runV2 or forcing legacy - cannot run
    if (check.v2Only) {
      return null;
    }
    // Fallback: cannot run legacy check with JSON context
    // This would require the caller to provide Cheerio context
    return null;
  }

  // Cheerio context provided
  // v2Only checks cannot run with Cheerio context
  if (check.v2Only) {
    return null;
  }

  // Use legacy run()
  return check.run(ctx as CheckContext);
}

/**
 * Phase 100: Check if a definition supports a given context type.
 */
export function checkSupportsContext(
  check: CheckDefinition,
  ctx: AnyCheckContext,
  forceLegacy = false
): boolean {
  const isJsonContext = isSEODataContext(ctx);

  if (isJsonContext) {
    // JSON context: needs runV2 (unless forcing legacy, which won't work)
    if (forceLegacy) return false;
    return !!check.runV2;
  }

  // Cheerio context: needs run and not v2Only
  return !check.v2Only;
}

/**
 * Phase 100: Get migration status for all checks.
 * Returns counts of checks by migration state.
 */
export function getMigrationStatus(): {
  total: number;
  legacyOnly: number;
  dualSupport: number;
  v2Only: number;
} {
  const checks = getAllChecks();
  let legacyOnly = 0;
  let dualSupport = 0;
  let v2Only = 0;

  for (const check of checks) {
    if (check.v2Only) {
      v2Only++;
    } else if (check.runV2) {
      dualSupport++;
    } else {
      legacyOnly++;
    }
  }

  return {
    total: checks.length,
    legacyOnly,
    dualSupport,
    v2Only,
  };
}
