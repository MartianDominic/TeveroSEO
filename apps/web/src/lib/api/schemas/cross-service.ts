/**
 * Cross-Service API Contract Schemas
 *
 * Central location for Zod schemas that validate responses from external services
 * (open-seo-main, AI-Writer). These schemas ensure runtime type safety and prevent
 * crashes when API contracts change unexpectedly.
 *
 * FIX CRIT-API-01: Runtime schema validation on cross-service calls
 * FIX HIGH-API-02: Standardized error response format
 *
 * Usage:
 * ```ts
 * import { GoalsListResponseSchema } from "@/lib/api/schemas/cross-service";
 * import { getOpenSeo } from "@/lib/server-fetch";
 *
 * const data = await getOpenSeo("/api/clients/123/goals", {
 *   schema: GoalsListResponseSchema
 * });
 * // data is now type-safe and runtime validated
 * ```
 */
import { z } from "zod";

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Standard pagination metadata for list responses.
 */
export const PaginationSchema = z.object({
  total: z.number().int().min(0).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  hasMore: z.boolean().optional(),
  nextCursor: z.string().nullable().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Standard timestamp fields for records.
 */
export const TimestampSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * UUID validation schema.
 */
export const UUIDSchema = z.string().uuid();

/**
 * ISO 8601 datetime string.
 */
export const ISODateTimeSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid ISO 8601 datetime" }
);

// ============================================================================
// Goal Schemas (open-seo-main)
// ============================================================================

/**
 * Goal template schema from open-seo-main.
 */
export const GoalTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  metric: z.string(),
  description: z.string().nullable(),
});

export type GoalTemplate = z.infer<typeof GoalTemplateSchema>;

/**
 * Goal response schema from open-seo-main.
 */
export const GoalResponseSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  templateId: z.string().nullable(),
  customName: z.string().nullable(),
  targetValue: z.union([z.string(), z.number()]),
  currentValue: z.union([z.string(), z.number()]),
  startDate: z.string().nullable(),
  targetDate: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GoalResponse = z.infer<typeof GoalResponseSchema>;

/**
 * Goal with template association.
 */
export const GoalWithTemplateSchema = z.object({
  goal: GoalResponseSchema,
  template: GoalTemplateSchema,
});

export type GoalWithTemplate = z.infer<typeof GoalWithTemplateSchema>;

/**
 * Goals list response from GET /api/clients/:clientId/goals.
 */
export const GoalsListResponseSchema = z.object({
  goals: z.array(GoalWithTemplateSchema),
});

export type GoalsListResponse = z.infer<typeof GoalsListResponseSchema>;

/**
 * Create goal response from POST /api/clients/:clientId/goals.
 */
export const CreateGoalResponseSchema = z.object({
  id: z.string(),
});

export type CreateGoalResponse = z.infer<typeof CreateGoalResponseSchema>;

/**
 * Bulk create goals response.
 */
export const BulkCreateGoalsResponseSchema = z.object({
  results: z.array(
    z.object({
      success: z.boolean(),
      id: z.string().optional(),
      error: z.string().optional(),
    })
  ),
});

export type BulkCreateGoalsResponse = z.infer<typeof BulkCreateGoalsResponseSchema>;

// ============================================================================
// Client Schemas (AI-Writer)
// ============================================================================

/**
 * Client schema from AI-Writer.
 * Note: AI-Writer uses snake_case, this is the camelCase version after transformation.
 */
export const ClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string().url().nullable().optional(),
  industry: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  settings: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Client = z.infer<typeof ClientSchema>;

/**
 * Client list response.
 */
export const ClientsListResponseSchema = z.object({
  clients: z.array(ClientSchema),
  pagination: PaginationSchema.optional(),
});

export type ClientsListResponse = z.infer<typeof ClientsListResponseSchema>;

// ============================================================================
// Audit Schemas (open-seo-main)
// ============================================================================

/**
 * Audit status enum.
 */
export const AuditStatusSchema = z.enum([
  "pending",
  "crawling",
  "analyzing",
  "completed",
  "failed",
  "cancelled",
]);

export type AuditStatus = z.infer<typeof AuditStatusSchema>;

/**
 * Audit summary response.
 */
export const AuditSummarySchema = z.object({
  id: z.string(),
  clientId: z.string(),
  url: z.string(),
  status: AuditStatusSchema,
  score: z.number().min(0).max(100).nullable(),
  issueCount: z.number().int().min(0).optional(),
  criticalCount: z.number().int().min(0).optional(),
  warningCount: z.number().int().min(0).optional(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export type AuditSummary = z.infer<typeof AuditSummarySchema>;

/**
 * Audit list response.
 */
export const AuditsListResponseSchema = z.object({
  audits: z.array(AuditSummarySchema),
  pagination: PaginationSchema.optional(),
});

export type AuditsListResponse = z.infer<typeof AuditsListResponseSchema>;

// ============================================================================
// Article Schemas (AI-Writer)
// ============================================================================

/**
 * Article status enum.
 */
export const ArticleStatusSchema = z.enum([
  "draft",
  "review",
  "approved",
  "published",
  "archived",
]);

export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;

/**
 * Article schema from AI-Writer.
 */
export const ArticleSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  title: z.string(),
  slug: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().nullable().optional(),
  status: ArticleStatusSchema,
  keywords: z.array(z.string()).optional(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Article = z.infer<typeof ArticleSchema>;

/**
 * Article list response.
 */
export const ArticlesListResponseSchema = z.object({
  articles: z.array(ArticleSchema),
  pagination: PaginationSchema.optional(),
});

export type ArticlesListResponse = z.infer<typeof ArticlesListResponseSchema>;

// ============================================================================
// Analytics Schemas (open-seo-main)
// ============================================================================

/**
 * Analytics metrics for a client.
 */
export const AnalyticsMetricsSchema = z.object({
  impressions: z.number().int().min(0),
  clicks: z.number().int().min(0),
  ctr: z.number().min(0).max(100),
  position: z.number().min(0),
});

export type AnalyticsMetrics = z.infer<typeof AnalyticsMetricsSchema>;

/**
 * Analytics summary response.
 */
export const AnalyticsSummarySchema = z.object({
  clientId: z.string(),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  current: AnalyticsMetricsSchema,
  previous: AnalyticsMetricsSchema.optional(),
  percentChange: z
    .object({
      impressions: z.number(),
      clicks: z.number(),
      ctr: z.number(),
      position: z.number(),
    })
    .optional(),
});

export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

// ============================================================================
// Pattern Schemas (open-seo-main)
// ============================================================================

/**
 * Pattern direction enum.
 */
export const PatternDirectionSchema = z.enum(["up", "down", "stable"]);

export type PatternDirection = z.infer<typeof PatternDirectionSchema>;

/**
 * Pattern schema from open-seo-main.
 */
export const PatternSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  patternType: z.string(),
  status: z.string(),
  title: z.string(),
  description: z.string(),
  affectedClientIds: z.array(z.string()),
  affectedCount: z.number().int().min(0),
  magnitude: z.number(),
  direction: PatternDirectionSchema,
  confidence: z.number().min(0).max(1),
  startDate: z.string(),
  endDate: z.string().nullable(),
  detectedAt: z.string(),
  resolvedAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
});

export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Patterns list response.
 */
export const PatternsListResponseSchema = z.object({
  patterns: z.array(PatternSchema),
  pagination: PaginationSchema.optional(),
});

export type PatternsListResponse = z.infer<typeof PatternsListResponseSchema>;

// ============================================================================
// Schedule Schemas
// ============================================================================

/**
 * Report schedule schema.
 */
export const ScheduleSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  reportType: z.string(),
  locale: z.string().optional(),
  recipients: z.array(z.string().email()),
  enabled: z.boolean(),
  lastRunAt: z.string().nullable().optional(),
  nextRunAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

/**
 * Schedules list response.
 */
export const SchedulesListResponseSchema = z.object({
  schedules: z.array(ScheduleSchema),
});

export type SchedulesListResponse = z.infer<typeof SchedulesListResponseSchema>;

// ============================================================================
// Generic Success Response
// ============================================================================

/**
 * Generic success response wrapper.
 */
export function createSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

/**
 * Generic list response wrapper.
 */
export function createListSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema.optional(),
  });
}

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Standardized error response schema that both services should conform to.
 * FIX HIGH-API-02: Unified error format.
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  status: z.number().int().optional(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// Exports for convenience
// ============================================================================

export const CrossServiceSchemas = {
  // Goals
  GoalTemplateSchema,
  GoalResponseSchema,
  GoalWithTemplateSchema,
  GoalsListResponseSchema,
  CreateGoalResponseSchema,
  BulkCreateGoalsResponseSchema,
  // Clients
  ClientSchema,
  ClientsListResponseSchema,
  // Audits
  AuditStatusSchema,
  AuditSummarySchema,
  AuditsListResponseSchema,
  // Articles
  ArticleStatusSchema,
  ArticleSchema,
  ArticlesListResponseSchema,
  // Analytics
  AnalyticsMetricsSchema,
  AnalyticsSummarySchema,
  // Patterns
  PatternDirectionSchema,
  PatternSchema,
  PatternsListResponseSchema,
  // Schedules
  ScheduleSchema,
  SchedulesListResponseSchema,
  // Generic
  PaginationSchema,
  ErrorResponseSchema,
} as const;
