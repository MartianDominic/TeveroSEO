/**
 * Rule Engine Types
 * Phase 92-04: RuleEngineService
 *
 * Defines rule interfaces for the 41-point SEO-AGI scorecard.
 */

import type { CheerioAPI } from "cheerio";
import type { Vertical } from "../types";

/**
 * Rule category for organization and weighting.
 */
export type RuleCategory =
  | "structure"
  | "content"
  | "trust"
  | "readability"
  | "schema"
  | "compliance";

/**
 * Severity level for rule violations.
 */
export type RuleSeverity = "critical" | "high" | "medium" | "low";

/**
 * Context passed to rule evaluate functions.
 */
export interface RuleContext {
  html: string;
  $: CheerioAPI;
  text: string;
  url: string;
  vertical: Vertical;
  isYmyl: boolean;
  metadata: {
    wordCount: number;
    headings: string[];
    schemas: string[];
    images: number;
    links: { internal: number; external: number };
  };
}

/**
 * Result returned from rule evaluation.
 */
export interface RuleResult {
  passed: boolean;
  score: number; // 0-100
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Definition of a single SEO rule.
 */
export interface RuleDefinition {
  /** Unique rule ID, e.g., "R-01", "R-HC-01" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Rule category for scoring grouping */
  category: RuleCategory;
  /** Default weight multiplier (1.0 = normal) */
  weight: number;
  /** Severity of rule violation */
  severity: RuleSeverity;
  /** Which verticals this rule applies to ("all" or specific array) */
  verticals: Vertical[] | "all";
  /** Evaluation function that checks rule compliance */
  evaluate: (ctx: RuleContext) => RuleResult;
}
