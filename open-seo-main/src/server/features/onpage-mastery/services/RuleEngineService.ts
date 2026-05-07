/**
 * RuleEngineService
 * Phase 92-04: RuleEngineService
 *
 * Implements the 41-point SEO-AGI scorecard with vertical-specific rules
 * and client override hierarchy. Provides weighted scoring with YMYL-aware
 * thresholds.
 *
 * Rule Hierarchy: Universal < Vertical < Client
 * - Universal rules apply to all pages
 * - Vertical rules add domain-specific checks (healthcare, legal, etc.)
 * - Client overrides can adjust weights or disable rules
 */

import { eq } from "drizzle-orm";
import * as cheerio from "cheerio";
import { seoRuleWeights, db, type DbClient } from "@/db";
import {
  getUniversalRules,
  getVerticalRules,
  type RuleDefinition,
  type RuleContext,
} from "../rules";
import type { Vertical, OnPageMasteryContext } from "../types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "RuleEngineService" });

/**
 * Result from scorecard evaluation.
 */
export interface ScorecardResult {
  /** Overall weighted score 0-100 */
  score: number;
  /** Whether page passes quality threshold */
  passed: boolean;
  /** Rules that passed evaluation */
  passedRules: Array<{
    id: string;
    name: string;
    score: number;
    weight: number;
  }>;
  /** Rules that failed evaluation */
  failedRules: Array<{
    id: string;
    name: string;
    score: number;
    weight: number;
    message: string;
  }>;
  /** Page vertical */
  vertical: Vertical;
  /** Whether this is a YMYL page */
  isYmyl: boolean;
  /** Total weight of all evaluated rules */
  totalWeight: number;
  /** Weight achieved from passed rules */
  achievedWeight: number;
}

/**
 * Client override for rule configuration.
 */
interface ClientRuleOverride {
  ruleId: string;
  weight: number;
  enabled: boolean;
}

/**
 * Merged rule with final weight and enabled status.
 */
interface MergedRule {
  rule: RuleDefinition;
  weight: number;
  enabled: boolean;
}

/**
 * RuleEngineService: Evaluates pages against the 41-point SEO scorecard.
 */
export class RuleEngineService {
  constructor(private db: DbClient) {}

  /**
   * Evaluate the 41-point scorecard for a page.
   *
   * @param ctx - Page context including HTML, URL, vertical, and client
   * @returns Scorecard result with scores and rule details
   */
  async evaluateScorecard(ctx: OnPageMasteryContext): Promise<ScorecardResult> {
    // 1. Build rule context from HTML
    const $ = cheerio.load(ctx.html);
    const text = $("body").text().replace(/\s+/g, " ").trim();

    const ruleContext: RuleContext = {
      html: ctx.html,
      $,
      text,
      url: ctx.url,
      vertical: ctx.vertical,
      isYmyl: ctx.isYmyl,
      metadata: this.extractMetadata($, ctx.url),
    };

    // 2. Load rules in hierarchy order
    const universalRules = getUniversalRules();
    const verticalRules = getVerticalRules(ctx.vertical);
    const clientOverrides = await this.loadClientOverrides(ctx.clientId);

    // 3. Merge rules (client overrides take precedence)
    const mergedRules = this.mergeRules(universalRules, verticalRules, clientOverrides);

    // 4. Evaluate each rule
    const passedRules: ScorecardResult["passedRules"] = [];
    const failedRules: ScorecardResult["failedRules"] = [];
    let totalWeight = 0;
    let achievedWeight = 0;

    for (const { rule, weight, enabled } of mergedRules) {
      if (!enabled) continue;

      // Check if rule applies to this vertical
      if (rule.verticals !== "all" && !rule.verticals.includes(ctx.vertical)) {
        continue;
      }

      totalWeight += weight;

      try {
        const result = rule.evaluate(ruleContext);

        if (result.passed) {
          achievedWeight += weight;
          passedRules.push({
            id: rule.id,
            name: rule.name,
            score: result.score,
            weight,
          });
        } else {
          failedRules.push({
            id: rule.id,
            name: rule.name,
            score: result.score,
            weight,
            message: result.message,
          });
        }
      } catch (error) {
        log.warn("Rule evaluation failed", {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error),
        });
        failedRules.push({
          id: rule.id,
          name: rule.name,
          score: 0,
          weight,
          message: `Evaluation error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    // 5. Calculate weighted score
    const score = totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;

    // 6. Determine pass threshold based on YMYL status
    const passThreshold = ctx.isYmyl ? 85 : 70;
    const passed = score >= passThreshold;

    return {
      score,
      passed,
      passedRules,
      failedRules,
      vertical: ctx.vertical,
      isYmyl: ctx.isYmyl,
      totalWeight,
      achievedWeight,
    };
  }

  /**
   * Load client-specific rule weight overrides.
   */
  private async loadClientOverrides(clientId: string): Promise<ClientRuleOverride[]> {
    try {
      const overrides = await this.db
        .select({
          ruleId: seoRuleWeights.ruleId,
          weight: seoRuleWeights.weight,
          enabled: seoRuleWeights.enabled,
        })
        .from(seoRuleWeights)
        .where(eq(seoRuleWeights.clientId, clientId));

      return overrides.map((o) => ({
        ruleId: o.ruleId,
        weight: o.weight ?? 1.0,
        enabled: o.enabled ?? true,
      }));
    } catch (error) {
      log.warn("Failed to load client overrides", {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Merge rules with override hierarchy: Universal < Vertical < Client.
   */
  private mergeRules(
    universal: RuleDefinition[],
    vertical: RuleDefinition[],
    clientOverrides: ClientRuleOverride[]
  ): MergedRule[] {
    // Create map for efficient lookup
    const ruleMap = new Map<string, MergedRule>();

    // Add universal rules
    for (const rule of universal) {
      ruleMap.set(rule.id, { rule, weight: rule.weight, enabled: true });
    }

    // Override/add vertical rules
    for (const rule of vertical) {
      ruleMap.set(rule.id, { rule, weight: rule.weight, enabled: true });
    }

    // Apply client overrides
    for (const override of clientOverrides) {
      const existing = ruleMap.get(override.ruleId);
      if (existing) {
        existing.weight = override.weight;
        existing.enabled = override.enabled;
      }
      // Note: client cannot add new rules, only modify existing
    }

    return Array.from(ruleMap.values());
  }

  /**
   * Extract metadata from HTML for rule evaluation.
   */
  private extractMetadata(
    $: cheerio.CheerioAPI,
    url: string
  ): RuleContext["metadata"] {
    const origin = new URL(url).origin;

    return {
      wordCount: $("body")
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length,
      headings: $("h1, h2, h3, h4, h5, h6")
        .map((_, el) => $(el).text().trim())
        .get(),
      schemas: $('script[type="application/ld+json"]')
        .map((_, el) => $(el).html() || "")
        .get(),
      images: $("img").length,
      links: {
        internal: $(`a[href^="/"], a[href^="${origin}"]`).length,
        external: $('a[href^="http"]')
          .filter((_, el) => !$(el).attr("href")?.startsWith(origin))
          .length,
      },
    };
  }

  /**
   * Get rules for a specific vertical (for UI display).
   */
  async getRulesForVertical(
    vertical: Vertical,
    clientId?: string
  ): Promise<
    Array<{
      rule: RuleDefinition;
      weight: number;
      enabled: boolean;
      isOverridden: boolean;
    }>
  > {
    const universal = getUniversalRules();
    const verticalSpecific = getVerticalRules(vertical);
    const overrides = clientId ? await this.loadClientOverrides(clientId) : [];

    const overrideMap = new Map(overrides.map((o) => [o.ruleId, o]));
    const merged = this.mergeRules(universal, verticalSpecific, overrides);

    return merged.map((m) => ({
      ...m,
      isOverridden: overrideMap.has(m.rule.id),
    }));
  }

  /**
   * Update client rule override.
   */
  async setRuleOverride(
    clientId: string,
    ruleId: string,
    weight: number,
    enabled: boolean
  ): Promise<void> {
    await this.db
      .insert(seoRuleWeights)
      .values({
        clientId,
        ruleId,
        weight,
        enabled,
      })
      .onConflictDoUpdate({
        target: [seoRuleWeights.clientId, seoRuleWeights.ruleId],
        set: { weight, enabled, updatedAt: new Date() },
      });
  }
}

// Singleton instance
let _service: RuleEngineService | null = null;

/**
 * Get singleton RuleEngineService instance.
 */
export function getRuleEngineService(): RuleEngineService {
  if (!_service) {
    _service = new RuleEngineService(db);
  }
  return _service;
}

/**
 * Reset singleton instance (for testing).
 */
export function resetRuleEngineService(): void {
  _service = null;
}
