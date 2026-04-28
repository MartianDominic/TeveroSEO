/**
 * Shared Schemas for Cross-Service Communication
 *
 * These Zod schemas define the contract between services (apps/web <-> AI-Writer).
 * They ensure type safety and validation at service boundaries.
 *
 * Important:
 * - All datetime fields use ISO 8601 format (with timezone)
 * - IDs are strings (UUIDs for new records, number strings for legacy)
 * - Arrays may be empty but never undefined
 *
 * When adding new schemas:
 * 1. Define the Zod schema
 * 2. Export the TypeScript type using z.infer
 * 3. Add to the appropriate category section
 * 4. Update the corresponding AI-Writer endpoint documentation
 */

import { z } from "zod";

// ============================================================================
// Common Types
// ============================================================================

/**
 * ISO 8601 datetime string with timezone.
 * Example: "2024-01-15T10:30:00.000Z"
 */
export const IsoDateTimeSchema = z.string().datetime({ message: "Expected ISO 8601 datetime" });

/**
 * Pagination metadata for list responses.
 */
export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  hasMore: z.boolean(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// ============================================================================
// Content Generation
// ============================================================================

/**
 * Response from content generation endpoint.
 */
export const ContentGenerationResponseSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  wordCount: z.number().int().nonnegative(),
  qualityScore: z.number().min(0).max(100).optional(),
  createdAt: IsoDateTimeSchema,
  metadata: z
    .object({
      model: z.string().optional(),
      tokensUsed: z.number().int().optional(),
      generationTimeMs: z.number().int().optional(),
    })
    .optional(),
});

export type ContentGenerationResponse = z.infer<typeof ContentGenerationResponseSchema>;

/**
 * Content quality assessment result.
 */
export const ContentQualitySchema = z.object({
  score: z.number().min(0).max(100),
  passesGate: z.boolean(),
  issues: z.array(
    z.object({
      type: z.enum(["readability", "tone", "seo", "grammar", "structure"]),
      severity: z.enum(["error", "warning", "info"]),
      message: z.string(),
      location: z
        .object({
          startOffset: z.number().int().optional(),
          endOffset: z.number().int().optional(),
        })
        .optional(),
    })
  ),
  suggestions: z.array(z.string()),
});

export type ContentQuality = z.infer<typeof ContentQualitySchema>;

// ============================================================================
// Voice Profile
// ============================================================================

/**
 * Brand voice profile schema.
 */
export const VoiceProfileSchema = z.object({
  id: z.number().int().positive(),
  clientId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  toneAttributes: z.record(z.string(), z.number().min(0).max(100)),
  vocabulary: z.array(z.string()),
  writingStyleGuide: z.string().optional(),
  doNotUse: z.array(z.string()),
  targetAudience: z.string().optional(),
  brandPersonality: z.array(z.string()),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type VoiceProfile = z.infer<typeof VoiceProfileSchema>;

/**
 * Voice profile summary (for list views).
 */
export const VoiceProfileSummarySchema = z.object({
  id: z.number().int().positive(),
  clientId: z.number().int().positive(),
  name: z.string(),
  lastUsed: IsoDateTimeSchema.nullable(),
  contentCount: z.number().int().nonnegative(),
});

export type VoiceProfileSummary = z.infer<typeof VoiceProfileSummarySchema>;

// ============================================================================
// Client Management
// ============================================================================

/**
 * Client access verification response.
 */
export const ClientAccessVerificationSchema = z.object({
  hasAccess: z.boolean(),
  clientId: z.number().int().positive(),
  organizationId: z.string().uuid().nullable(),
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
});

export type ClientAccessVerification = z.infer<typeof ClientAccessVerificationSchema>;

/**
 * Client details schema.
 */
export const ClientDetailsSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  domain: z.string().url().optional(),
  industry: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  settings: z
    .object({
      defaultVoiceId: z.number().int().optional(),
      qualityGateThreshold: z.number().min(0).max(100).optional(),
      autoPublish: z.boolean().optional(),
    })
    .optional(),
});

export type ClientDetails = z.infer<typeof ClientDetailsSchema>;

// ============================================================================
// GSC (Google Search Console) Data
// ============================================================================

/**
 * GSC query performance data.
 */
export const GscQueryDataSchema = z.object({
  query: z.string(),
  clicks: z.number().int().nonnegative(),
  impressions: z.number().int().nonnegative(),
  ctr: z.number().min(0).max(1),
  position: z.number().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD format"),
});

export type GscQueryData = z.infer<typeof GscQueryDataSchema>;

/**
 * GSC snapshot response.
 */
export const GscSnapshotResponseSchema = z.object({
  clientId: z.number().int().positive(),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  queries: z.array(GscQueryDataSchema),
  totals: z.object({
    clicks: z.number().int().nonnegative(),
    impressions: z.number().int().nonnegative(),
    avgCtr: z.number(),
    avgPosition: z.number(),
  }),
  fetchedAt: IsoDateTimeSchema,
});

export type GscSnapshotResponse = z.infer<typeof GscSnapshotResponseSchema>;

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Standard API success response wrapper.
 */
export function createSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: PaginationMetaSchema.optional(),
  });
}

/**
 * Standard API error response.
 */
export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Union type for API responses.
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("success", [
    createSuccessSchema(dataSchema),
    ApiErrorResponseSchema,
  ]);
}
