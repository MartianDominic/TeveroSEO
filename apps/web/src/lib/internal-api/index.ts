/**
 * Internal API Module
 *
 * Provides secure, typed communication between apps/web and backend services.
 *
 * @example
 * ```typescript
 * import { internalApi, withFallback, VoiceProfileSchema } from '@/lib/internal-api';
 *
 * const profile = await withFallback(
 *   () => internalApi.get('/internal/voice/profile', { schema: VoiceProfileSchema }),
 *   () => getCachedProfile(),
 * );
 * ```
 */

// Client exports
export {
  internalApiRequest,
  internalApi,
  InternalApiError,
  type InternalApiRequestOptions,
} from "./client";

// Fallback utilities
export {
  withFallback,
  withDegradedMode,
  withRetry,
  createCachedFallback,
  defaultShouldFallback,
  type FallbackOptions,
  type DegradedResult,
  type RetryOptions,
} from "./with-fallback";

// Schemas and types
export {
  // Common
  IsoDateTimeSchema,
  PaginationMetaSchema,
  type PaginationMeta,
  // Content
  ContentGenerationResponseSchema,
  ContentQualitySchema,
  type ContentGenerationResponse,
  type ContentQuality,
  // Voice
  VoiceProfileSchema,
  VoiceProfileSummarySchema,
  type VoiceProfile,
  type VoiceProfileSummary,
  // Client
  ClientAccessVerificationSchema,
  ClientDetailsSchema,
  type ClientAccessVerification,
  type ClientDetails,
  // GSC
  GscQueryDataSchema,
  GscSnapshotResponseSchema,
  type GscQueryData,
  type GscSnapshotResponse,
  // API Response
  ApiErrorResponseSchema,
  createSuccessSchema,
  createApiResponseSchema,
  type ApiErrorResponse,
} from "./schemas";
