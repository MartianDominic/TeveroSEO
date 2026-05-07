/**
 * Rule Registry
 * Phase 92-04: RuleEngineService
 *
 * Central registry for all SEO rules. Provides functions to retrieve
 * rules by vertical, ID, or get all applicable rules for a context.
 */

import { universalRules } from "./universal";
import { healthcareRules } from "./healthcare";
import { legalRules } from "./legal";
import { financialRules } from "./financial";
import { ecommerceRules } from "./ecommerce";
import { saasRules } from "./saas";
import type { RuleDefinition } from "./types";
import type { Vertical } from "../types";

// Re-export types
export type {
  RuleDefinition,
  RuleContext,
  RuleResult,
  RuleCategory,
  RuleSeverity,
} from "./types";

/**
 * Vertical-specific rule packs.
 * Each vertical can have additional rules beyond universal.
 */
const VERTICAL_RULES: Record<Vertical, RuleDefinition[]> = {
  healthcare: healthcareRules,
  legal: legalRules,
  financial: financialRules,
  ecommerce: ecommerceRules,
  saas: saasRules,
  real_estate: [], // Use universal only
  home_services: [], // Use universal only
  hospitality: [], // Use universal only
  education: [], // Use universal only
  professional: [], // Use universal only
  manufacturing: [], // Use universal only
  nonprofit: [], // Use universal only
  general: [], // Use universal only
};

/**
 * Get all universal rules that apply to all verticals.
 */
export function getUniversalRules(): RuleDefinition[] {
  return universalRules;
}

/**
 * Get vertical-specific rules (not including universal).
 * Returns empty array for verticals without specific rules.
 */
export function getVerticalRules(vertical: Vertical): RuleDefinition[] {
  return VERTICAL_RULES[vertical] || [];
}

/**
 * Get all rules for a vertical (universal + vertical-specific).
 */
export function getAllRulesForVertical(vertical: Vertical): RuleDefinition[] {
  return [...universalRules, ...getVerticalRules(vertical)];
}

/**
 * Get a specific rule by ID.
 * Searches across all rule packs.
 */
export function getRuleById(ruleId: string): RuleDefinition | undefined {
  // Check universal rules first
  const universal = universalRules.find((r) => r.id === ruleId);
  if (universal) return universal;

  // Check all vertical rules
  for (const rules of Object.values(VERTICAL_RULES)) {
    const found = rules.find((r) => r.id === ruleId);
    if (found) return found;
  }

  return undefined;
}

/**
 * Get all rules across all verticals (for validation/testing).
 */
export function getAllRules(): RuleDefinition[] {
  const allVerticalRules = Object.values(VERTICAL_RULES).flat();
  return [...universalRules, ...allVerticalRules];
}

/**
 * Get rules by category.
 */
export function getRulesByCategory(
  category: RuleDefinition["category"]
): RuleDefinition[] {
  return getAllRules().filter((r) => r.category === category);
}

/**
 * Get rules by severity.
 */
export function getRulesBySeverity(
  severity: RuleDefinition["severity"]
): RuleDefinition[] {
  return getAllRules().filter((r) => r.severity === severity);
}
