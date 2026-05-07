/**
 * LLM Cost Tracking Utility
 * Phase 91-02: Cost Optimization
 *
 * Centralized cost tracking for all LLM API calls.
 * Logs token usage, cache hits, and estimated costs.
 */

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "cost-tracker" });

/**
 * Pricing per million tokens (as of May 2026).
 * Keep in sync with 91-MASTER.md.
 */
const PRICING: Record<string, { input: number; output: number; cached?: number }> = {
  // Grok models
  "grok-4-1-fast-reasoning": { input: 0.20, output: 0.80, cached: 0.05 },
  "grok-4-1-fast-non-reasoning": { input: 0.20, output: 0.80, cached: 0.05 },

  // Gemini models
  "gemini-3.1-pro": { input: 1.25, output: 5.00, cached: 0.125 },
  "gemini-3.1-flash": { input: 0.075, output: 0.30, cached: 0.01 },
  "gemini-3.1-flash-lite": { input: 0.02, output: 0.08 },

  // Claude models (fallback only)
  "claude-sonnet-4-6": { input: 3.00, output: 15.00, cached: 0.30 },
};

export interface CostLogEntry {
  provider: "grok" | "gemini" | "anthropic";
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  estimatedCost: number;
  timestamp: Date;
}

/**
 * Calculate cost for an LLM call.
 *
 * @param model - Model ID (e.g., "grok-4-1-fast-reasoning")
 * @param inputTokens - Total input tokens
 * @param outputTokens - Output tokens
 * @param cachedTokens - Cached input tokens (subset of inputTokens)
 * @returns Estimated cost in USD
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens: number = 0
): number {
  const pricing = PRICING[model];
  if (!pricing) {
    log.warn("Unknown model for pricing", { model });
    return 0;
  }

  const uncachedInputTokens = inputTokens - cachedTokens;
  const cachedCostRate = pricing.cached ?? pricing.input * 0.25; // Default 75% discount

  const inputCost = (uncachedInputTokens / 1_000_000) * pricing.input;
  const cachedCost = (cachedTokens / 1_000_000) * cachedCostRate;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + cachedCost + outputCost;
}

/**
 * Log an LLM cost entry.
 * Structured for aggregation and monitoring.
 */
export function logCost(entry: Omit<CostLogEntry, "timestamp" | "estimatedCost">): void {
  const estimatedCost = calculateCost(
    entry.model,
    entry.inputTokens,
    entry.outputTokens,
    entry.cachedTokens
  );

  const fullEntry: CostLogEntry = {
    ...entry,
    estimatedCost,
    timestamp: new Date(),
  };

  log.info("LLM cost", {
    provider: fullEntry.provider,
    model: fullEntry.model,
    operation: fullEntry.operation,
    inputTokens: fullEntry.inputTokens,
    outputTokens: fullEntry.outputTokens,
    cachedTokens: fullEntry.cachedTokens,
    cacheHitRate: fullEntry.inputTokens > 0
      ? Math.round((fullEntry.cachedTokens / fullEntry.inputTokens) * 100)
      : 0,
    estimatedCostUSD: estimatedCost.toFixed(6),
  });
}

/**
 * Get pricing for a model.
 */
export function getModelPricing(model: string): { input: number; output: number; cached?: number } | null {
  return PRICING[model] ?? null;
}

/**
 * List all known models with pricing.
 */
export function listPricedModels(): string[] {
  return Object.keys(PRICING);
}
