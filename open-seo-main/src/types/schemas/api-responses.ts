/**
 * Zod schemas for validating external API responses.
 *
 * FIX CRIT-TYPE-01: Runtime validation for API responses
 * FIX CRIT-TYPE-02: Typed interfaces for Google API responses
 *
 * USAGE:
 * Instead of:
 *   const data = await response.json() as BriefResponse;
 *
 * Use:
 *   const json = await response.json();
 *   const result = BriefResponseSchema.safeParse(json);
 *   if (!result.success) {
 *     logger.error('Invalid API response', { error: result.error, json });
 *     throw new AppError('VALIDATION_ERROR', 'Invalid response from service');
 *   }
 *   const data = result.data;
 */

import { z } from "zod";

// ============================================================================
// Generic API Response Schemas
// ============================================================================

/**
 * Standard error response from our internal APIs.
 */
export const ApiErrorSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
});

/**
 * Create a schema for API responses with typed data.
 */
export function createDataResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: z.object({
      total: z.number().optional(),
      page: z.number().optional(),
      limit: z.number().optional(),
    }).optional(),
  });
}

// ============================================================================
// Brief API Response Schemas
// ============================================================================

export const SerpAnalysisDataSchema = z.object({
  commonH2s: z.array(z.object({
    heading: z.string(),
    frequency: z.number(),
  })),
  paaQuestions: z.array(z.string()),
  competitorWordCounts: z.array(z.number()),
  metaLengths: z.object({
    title: z.number(),
    description: z.number(),
  }),
  analyzedAt: z.string(),
  location: z.string(),
});

export const BriefSchema = z.object({
  id: z.string(),
  mappingId: z.string(),
  keyword: z.string(),
  targetWordCount: z.number(),
  voiceMode: z.enum(["preservation", "application", "best_practices"]),
  status: z.enum(["draft", "ready", "generating", "published"]),
  serpAnalysis: SerpAnalysisDataSchema.nullable(),
  articleId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BriefsListResponseSchema = createDataResponseSchema(z.array(BriefSchema));
export const BriefResponseSchema = createDataResponseSchema(BriefSchema);
export const SerpAnalysisResponseSchema = createDataResponseSchema(SerpAnalysisDataSchema);

export const GeneratedBriefResultSchema = z.object({
  brief: BriefSchema,
  suggestedH2s: z.array(z.string()),
  paaQuestions: z.array(z.string()),
  competitorAvgWordCount: z.number(),
});

export const GeneratedBriefResponseSchema = createDataResponseSchema(GeneratedBriefResultSchema);

export const GenerateContentResultSchema = z.object({
  briefId: z.string(),
  articleId: z.string(),
  status: z.string(),
});

export const GenerateContentResponseSchema = createDataResponseSchema(GenerateContentResultSchema);

export const GenerationStatusResultSchema = z.object({
  briefStatus: z.string(),
  articleStatus: z.string().nullable(),
  articleId: z.string().nullable(),
});

export const GenerationStatusResponseSchema = createDataResponseSchema(GenerationStatusResultSchema);

// ============================================================================
// Google API Response Schemas
// ============================================================================

/**
 * Google Analytics 4 runReport response row.
 */
export const GA4ReportRowSchema = z.object({
  dimensionValues: z.array(z.object({
    value: z.string().optional(),
  })).optional(),
  metricValues: z.array(z.object({
    value: z.string().optional(),
  })).optional(),
});

/**
 * Google Analytics 4 runReport response.
 */
export const GA4RunReportResponseSchema = z.object({
  rows: z.array(GA4ReportRowSchema).optional(),
  rowCount: z.number().optional(),
  metadata: z.object({
    currencyCode: z.string().optional(),
    timeZone: z.string().optional(),
  }).optional(),
});

/**
 * Google Search Console searchanalytics.query response row.
 */
export const GSCSearchAnalyticsRowSchema = z.object({
  keys: z.array(z.string()).optional(),
  clicks: z.number().optional(),
  impressions: z.number().optional(),
  ctr: z.number().optional(),
  position: z.number().optional(),
});

/**
 * Google Search Console searchanalytics.query response.
 */
export const GSCSearchAnalyticsResponseSchema = z.object({
  rows: z.array(GSCSearchAnalyticsRowSchema).optional(),
  responseAggregationType: z.string().optional(),
});

/**
 * Google Search Console sitemaps list response.
 */
export const GSCSitemapContentSchema = z.object({
  indexed: z.number().optional(),
  submitted: z.number().optional(),
  type: z.string().optional(),
});

export const GSCSitemapSchema = z.object({
  path: z.string().optional(),
  lastSubmitted: z.string().optional(),
  isPending: z.boolean().optional(),
  isSitemapsIndex: z.boolean().optional(),
  lastDownloaded: z.string().optional(),
  warnings: z.number().optional(),
  errors: z.number().optional(),
  contents: z.array(GSCSitemapContentSchema).optional(),
});

export const GSCSitemapsListResponseSchema = z.object({
  sitemap: z.array(GSCSitemapSchema).optional(),
});

// ============================================================================
// OAuth/Token Response Schemas
// ============================================================================

/**
 * OAuth token response schema.
 */
export const OAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

/**
 * Google userinfo response schema.
 */
export const GoogleUserInfoSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
  verified_email: z.boolean().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  picture: z.string().optional(),
  locale: z.string().optional(),
});

// ============================================================================
// Client Access Verification Schema
// ============================================================================

export const ClientAccessResponseSchema = z.object({
  hasAccess: z.boolean(),
});

// ============================================================================
// Dokobit Webhook Schemas
// ============================================================================

export const DokobitSessionResponseSchema = z.object({
  session_id: z.string().optional(),
  url: z.string().optional(),
  status: z.string().optional(),
});

export const DokobitSignedDocumentSchema = z.object({
  file_content: z.string().optional(),
  signer_name: z.string().optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse an API response and return either data or null.
 * Logs parse failures for debugging.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw data to parse
 * @param context - Context for error logging
 * @returns Parsed data or null if validation fails
 */
export function safeParseApiResponse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: { endpoint: string; logger?: { error: (msg: string, meta: Record<string, unknown>) => void } }
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = `Invalid API response from ${context.endpoint}`;
    const meta = {
      endpoint: context.endpoint,
      errors: result.error.issues.map(e => ({ path: e.path.join('.'), message: e.message })),
      receivedData: JSON.stringify(data).slice(0, 500), // Truncate for logging
    };
    if (context.logger) {
      context.logger.error(errorMsg, meta);
    } else {
      console.error(errorMsg, meta);
    }
    return null;
  }
  return result.data;
}

/**
 * Parse API response and throw if invalid.
 * Use when you want to fail fast on invalid responses.
 *
 * @param schema - Zod schema to validate against
 * @param data - Raw data to parse
 * @param errorMessage - Error message to throw on failure
 * @returns Parsed and validated data
 * @throws Error with the provided message if validation fails
 */
export function parseApiResponseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  errorMessage: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`${errorMessage}: ${details}`);
  }
  return result.data;
}

// ============================================================================
// Type exports for use with the schemas
// ============================================================================

export type Brief = z.infer<typeof BriefSchema>;
export type SerpAnalysisData = z.infer<typeof SerpAnalysisDataSchema>;
export type GeneratedBriefResult = z.infer<typeof GeneratedBriefResultSchema>;
export type GenerateContentResult = z.infer<typeof GenerateContentResultSchema>;
export type GenerationStatusResult = z.infer<typeof GenerationStatusResultSchema>;
export type GA4ReportRow = z.infer<typeof GA4ReportRowSchema>;
export type GSCSearchAnalyticsRow = z.infer<typeof GSCSearchAnalyticsRowSchema>;
