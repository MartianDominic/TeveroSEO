/**
 * API Costs Schema for Phase 63 Classification Cost Tracking.
 *
 * Tracks API credits burned per workspace for:
 * - Grok classification calls ($0.20/1M input tokens)
 * - Gemini fallback calls
 * - Claude refinement calls
 */

import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "./user-schema";

/**
 * Supported API services for cost tracking.
 */
export const API_SERVICES = {
  GROK: "grok",
  GEMINI: "gemini",
  CLAUDE: "claude",
  OPENAI: "openai",
} as const;

export type ApiService = (typeof API_SERVICES)[keyof typeof API_SERVICES];

/**
 * API operations that incur costs.
 */
export const API_OPERATIONS = {
  CLASSIFY: "classify",
  EXPAND: "expand",
  EXTRACT: "extract",
} as const;

export type ApiOperation = (typeof API_OPERATIONS)[keyof typeof API_OPERATIONS];

/**
 * Cost rates per service (cost per 1000 tokens in cents).
 * Based on current pricing:
 * - Grok: $0.20/1M = $0.0002/1K = 0.02 cents/1K tokens
 * - Gemini Flash Lite: ~$0.075/1M = 0.0075 cents/1K tokens
 * - Claude Sonnet: $3/1M = 0.3 cents/1K tokens
 * - OpenAI: $5/1M = 0.5 cents/1K tokens
 */
export const COST_RATES_PER_1K_TOKENS_CENTS = {
  [API_SERVICES.GROK]: 0.02,
  [API_SERVICES.GEMINI]: 0.0075,
  [API_SERVICES.CLAUDE]: 0.3,
  [API_SERVICES.OPENAI]: 0.5,
} as const;

/**
 * API costs tracking table.
 * Records every API call with associated cost for billing and monitoring.
 */
export const apiCosts = pgTable(
  "api_costs",
  {
    /** Unique identifier for the cost record */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** Workspace (organization) that incurred the cost */
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** API service used (grok, gemini, claude, openai) */
    service: text("service").notNull().$type<ApiService>(),
    /** Operation performed (classify, expand, extract) */
    operation: text("operation").notNull().$type<ApiOperation>(),
    /** Estimated input tokens consumed */
    inputTokens: integer("input_tokens").notNull().default(0),
    /** Estimated output tokens consumed */
    outputTokens: integer("output_tokens").notNull().default(0),
    /** Total cost in cents (integer to avoid float precision issues) */
    costCents: integer("cost_cents").notNull(),
    /** Optional metadata (e.g., model version, batch size) */
    metadata: text("metadata"),
    /** When the cost was incurred */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_costs_workspace_id_idx").on(table.workspaceId),
    index("api_costs_service_idx").on(table.service),
    index("api_costs_created_at_idx").on(table.createdAt),
    index("api_costs_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt
    ),
  ]
);

/**
 * Relations for API costs.
 */
export const apiCostsRelations = relations(apiCosts, ({ one }) => ({
  workspace: one(organization, {
    fields: [apiCosts.workspaceId],
    references: [organization.id],
  }),
}));

/**
 * Type definitions for API costs.
 */
export type ApiCostSelect = typeof apiCosts.$inferSelect;
export type ApiCostInsert = typeof apiCosts.$inferInsert;

/**
 * Calculate cost in cents for a given token count and service.
 *
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens (typically ~10-20% of input for classification)
 * @param service - API service used
 * @returns Cost in cents (integer)
 */
export function calculateCostCents(
  inputTokens: number,
  outputTokens: number,
  service: ApiService
): number {
  const ratePerKTokens = COST_RATES_PER_1K_TOKENS_CENTS[service] ?? 0.1;
  const totalTokens = inputTokens + outputTokens;
  // Calculate cost and round up to nearest cent
  const costCents = Math.ceil((totalTokens / 1000) * ratePerKTokens);
  return costCents;
}

/**
 * Estimate tokens from text content.
 * Uses rough approximation of 4 characters per token.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
