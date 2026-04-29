/**
 * Zod validation schemas for API responses.
 * Replaces unsafe type assertions with runtime validation.
 *
 * @module api-response-schemas
 */
import { z } from "zod";

// ============================================
// Alert Schemas
// ============================================

export const AlertSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  alertType: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  status: z.enum(["pending", "acknowledged", "resolved", "dismissed"]),
  title: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string(),
  acknowledgedAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  emailSentAt: z.string().nullable(),
});

export const AlertArraySchema = z.array(AlertSchema);

export type Alert = z.infer<typeof AlertSchema>;

export const AlertRuleSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  alertType: z.string(),
  enabled: z.boolean(),
  threshold: z.number().nullable(),
  severity: z.enum(["info", "warning", "critical"]),
  emailNotify: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const AlertRuleArraySchema = z.array(AlertRuleSchema);

export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const AlertCountResponseSchema = z.object({
  count: z.number(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

// ============================================
// Audit Schemas
// ============================================

export const AuditStatusSchema = z.object({
  status: z.string(),
  pagesCrawled: z.number(),
  pagesTotal: z.number(),
  lighthouseTotal: z.number(),
  lighthouseCompleted: z.number(),
  lighthouseFailed: z.number(),
  currentPhase: z.string().nullable(),
  startUrl: z.string(),
  startedAt: z.string(),
});

export type AuditStatus = z.infer<typeof AuditStatusSchema>;

// ============================================
// Backlinks Schemas
// ============================================

export const BacklinksOverviewSchema = z.object({
  totalBacklinks: z.number(),
  referringDomains: z.number(),
  domainRank: z.number(),
  trustRank: z.number(),
  spamScore: z.number(),
});

export type BacklinksOverview = z.infer<typeof BacklinksOverviewSchema>;

export const ReferringDomainSchema = z.object({
  domain: z.string(),
  backlinks: z.number(),
  domainRank: z.number(),
  firstSeen: z.string(),
});

export const ReferringDomainArraySchema = z.array(ReferringDomainSchema);

export type ReferringDomain = z.infer<typeof ReferringDomainSchema>;

export const TopPageSchema = z.object({
  url: z.string(),
  backlinks: z.number(),
  referringDomains: z.number(),
});

export const TopPageArraySchema = z.array(TopPageSchema);

export type TopPage = z.infer<typeof TopPageSchema>;

// ============================================
// Crawl Progress Schemas
// ============================================

export const CrawlProgressEntrySchema = z.object({
  url: z.string(),
  statusCode: z.number().nullable(),
  title: z.string().nullable(),
  crawledAt: z.number(),
});

export const CrawlProgressArraySchema = z.array(CrawlProgressEntrySchema);

export type CrawlProgressEntry = z.infer<typeof CrawlProgressEntrySchema>;

// ============================================
// Audit History Schemas
// ============================================

export const AuditHistoryEntrySchema = z.object({
  id: z.string(),
  startUrl: z.string(),
  status: z.string(),
  startedAt: z.string(),
  pagesCrawled: z.number(),
});

export const AuditHistoryArraySchema = z.array(AuditHistoryEntrySchema);

export type AuditHistoryEntry = z.infer<typeof AuditHistoryEntrySchema>;

// ============================================
// Helper: Validate API Response
// ============================================

/**
 * Validate an API response against a Zod schema.
 * Returns the validated data or null if validation fails.
 *
 * @param data - The raw API response data
 * @param schema - The Zod schema to validate against
 * @param context - Context string for error logging
 * @returns The validated data or null
 */
export function validateApiResponse<T>(
  data: unknown,
  schema: z.ZodType<T>,
  context: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[validateApiResponse] ${context}:`, result.error.message);
    return null;
  }
  return result.data;
}

/**
 * Validate an API response against a Zod schema.
 * Returns a result object with success status.
 *
 * @param data - The raw API response data
 * @param schema - The Zod schema to validate against
 * @param context - Context string for error logging
 * @returns Result object with success status and data/error
 */
export function validateApiResponseResult<T>(
  data: unknown,
  schema: z.ZodType<T>,
  context: string
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = `Invalid ${context} response: ${result.error.message}`;
    console.error(`[validateApiResponse] ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data };
}
