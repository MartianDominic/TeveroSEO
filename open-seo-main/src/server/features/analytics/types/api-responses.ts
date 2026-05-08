/**
 * Standardized API Response Types for Analytics Routes
 * Phase 96 API Documentation: Consistent error format and response types
 *
 * This module defines:
 * - Standard error response format with error codes
 * - Success response envelope with data and metadata
 * - Helper functions for creating consistent responses
 * - Exported Zod schemas for client-side validation
 *
 * Usage:
 * ```ts
 * import { createErrorResponse, createSuccessResponse, ERROR_CODES } from '@/server/features/analytics/types/api-responses';
 *
 * // Error response
 * return Response.json(createErrorResponse('VALIDATION_ERROR', 'Invalid siteId', details), { status: 400 });
 *
 * // Success response
 * return Response.json(createSuccessResponse(data, { cachedAt: new Date().toISOString() }));
 * ```
 */

import { z, ZodError } from 'zod';

/**
 * Format Zod validation errors into a consistent array structure.
 * Zod 4+ deprecated the parameterless .flatten() signature.
 * Use .issues directly for forward compatibility.
 */
export function formatZodErrors(zodError: ZodError): Array<{ path: string; message: string }> {
  return zodError.issues.map((issue) => ({
    path: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

// --- Error Codes ---

/**
 * Standard error codes for API responses.
 * These codes enable programmatic error handling on the client side.
 */
export const ERROR_CODES = {
  /** Request validation failed (Zod parse errors, invalid params) */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Authentication required or invalid credentials */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** User authenticated but lacks permission for this resource */
  FORBIDDEN: 'FORBIDDEN',
  /** Requested resource not found */
  NOT_FOUND: 'NOT_FOUND',
  /** Too many requests, rate limit exceeded */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Server error, unexpected failure */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** CSRF token missing or invalid */
  CSRF_INVALID: 'CSRF_INVALID',
  /** Method not allowed for this endpoint */
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  /** External service (GSC, GA4) not connected */
  SERVICE_NOT_CONNECTED: 'SERVICE_NOT_CONNECTED',
  /** Resource conflict (duplicate, version mismatch) */
  CONFLICT: 'CONFLICT',
  /** Feature not available for current plan/subscription */
  FEATURE_UNAVAILABLE: 'FEATURE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// --- Zod Schemas ---

/**
 * Schema for the error detail object within error responses.
 */
export const ApiErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

/**
 * Standard error response schema.
 * All error responses from analytics API follow this format.
 */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: ApiErrorDetailSchema,
});

/**
 * Pagination metadata schema.
 */
export const PaginationMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
});

/**
 * Cache metadata schema for cached responses.
 * Note: Uses z.iso.datetime() instead of deprecated z.string().datetime() in Zod 4.x
 */
export const CacheMetaSchema = z.object({
  cachedAt: z.iso.datetime().optional(),
  dataAsOf: z.iso.datetime().optional(),
  staleAfter: z.iso.datetime().optional(),
});

/**
 * Rate limit metadata schema.
 */
export const RateLimitMetaSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  resetAt: z.iso.datetime().optional(),
});

/**
 * Combined response metadata schema.
 */
export const ApiMetaSchema = z.object({
  cache: CacheMetaSchema.optional(),
  pagination: PaginationMetaSchema.optional(),
  rateLimit: RateLimitMetaSchema.optional(),
});

/**
 * Create a success response schema for a given data schema.
 * @param dataSchema - Zod schema for the data field
 */
export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: ApiMetaSchema.optional(),
  });

// --- TypeScript Types ---

export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type CacheMeta = z.infer<typeof CacheMetaSchema>;
export type RateLimitMeta = z.infer<typeof RateLimitMetaSchema>;
export type ApiMeta = z.infer<typeof ApiMetaSchema>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// --- Helper Functions ---

/**
 * Create a standardized error response object.
 *
 * @param code - Error code from ERROR_CODES
 * @param message - Human-readable error message
 * @param details - Optional additional context (validation errors, etc.)
 * @returns ApiError object ready for Response.json()
 *
 * @example
 * ```ts
 * return Response.json(
 *   createErrorResponse('VALIDATION_ERROR', 'Invalid parameters', formatZodErrors(zodError)),
 *   { status: 400 }
 * );
 * ```
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown
): ApiError {
  const response: ApiError = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details !== undefined) {
    response.error.details = details;
  }

  return response;
}

/**
 * Create a standardized success response object.
 *
 * @param data - The response data payload
 * @param meta - Optional metadata (cache info, pagination, etc.)
 * @returns ApiSuccess object ready for Response.json()
 *
 * @example
 * ```ts
 * return Response.json(
 *   createSuccessResponse(trends, { cache: { cachedAt: new Date().toISOString() } })
 * );
 * ```
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: ApiMeta
): ApiSuccess<T> {
  const response: ApiSuccess<T> = {
    success: true,
    data,
  };

  if (meta !== undefined) {
    response.meta = meta;
  }

  return response;
}

/**
 * Get the appropriate HTTP status code for an error code.
 *
 * @param code - Error code from ERROR_CODES
 * @returns HTTP status code
 */
export function getHttpStatusForError(code: ErrorCode): number {
  switch (code) {
    case ERROR_CODES.VALIDATION_ERROR:
      return 400;
    case ERROR_CODES.UNAUTHORIZED:
      return 401;
    case ERROR_CODES.FORBIDDEN:
      return 403;
    case ERROR_CODES.NOT_FOUND:
      return 404;
    case ERROR_CODES.METHOD_NOT_ALLOWED:
      return 405;
    case ERROR_CODES.CONFLICT:
      return 409;
    case ERROR_CODES.RATE_LIMITED:
      return 429;
    case ERROR_CODES.INTERNAL_ERROR:
      return 500;
    case ERROR_CODES.CSRF_INVALID:
      return 403;
    case ERROR_CODES.SERVICE_NOT_CONNECTED:
      return 424; // Failed Dependency
    case ERROR_CODES.FEATURE_UNAVAILABLE:
      return 403;
    default:
      return 500;
  }
}

/**
 * Create a Response object with proper status code and JSON body.
 *
 * @param code - Error code from ERROR_CODES
 * @param message - Human-readable error message
 * @param details - Optional additional context
 * @returns Response object ready to return from route handler
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: unknown
): Response {
  return Response.json(createErrorResponse(code, message, details), {
    status: getHttpStatusForError(code),
  });
}

// --- Convenience Error Response Functions ---
// These follow the OpenAPI spec format: { success: false, error: { code, message, details? } }

/**
 * Validation error response (400).
 * Use for Zod parse failures and invalid parameters.
 */
export function validationErrorResponse(
  message: string = 'Invalid parameters',
  details?: unknown
): Response {
  return errorResponse(ERROR_CODES.VALIDATION_ERROR, message, details);
}

/**
 * Unauthorized error response (401).
 * Use when authentication is required but missing or invalid.
 */
export function unauthorizedErrorResponse(
  message: string = 'Authentication required'
): Response {
  return errorResponse(ERROR_CODES.UNAUTHORIZED, message);
}

/**
 * Forbidden error response (403).
 * Use when authenticated but lacking permission.
 */
export function forbiddenErrorResponse(
  message: string = 'Access denied'
): Response {
  return errorResponse(ERROR_CODES.FORBIDDEN, message);
}

/**
 * Not found error response (404).
 * Use for missing resources.
 */
export function notFoundErrorResponse(
  message: string = 'Resource not found'
): Response {
  return errorResponse(ERROR_CODES.NOT_FOUND, message);
}

/**
 * Method not allowed error response (405).
 */
export function methodNotAllowedErrorResponse(
  message: string = 'Method not allowed'
): Response {
  return errorResponse(ERROR_CODES.METHOD_NOT_ALLOWED, message);
}

/**
 * Internal server error response (500).
 * Use for unexpected errors. Never expose internal details to clients.
 */
export function internalErrorResponse(
  message: string = 'Internal server error'
): Response {
  return errorResponse(ERROR_CODES.INTERNAL_ERROR, message);
}

/**
 * CSRF invalid error response (403).
 */
export function csrfInvalidErrorResponse(
  message: string = 'CSRF token missing or invalid'
): Response {
  return errorResponse(ERROR_CODES.CSRF_INVALID, message);
}

/**
 * Service not connected error response (424 Failed Dependency).
 * Use when external service (GSC, GA4) is not connected.
 */
export function serviceNotConnectedErrorResponse(
  message: string = 'Service not connected'
): Response {
  return errorResponse(ERROR_CODES.SERVICE_NOT_CONNECTED, message);
}

/**
 * Conflict error response (409).
 * Use for duplicate resources or version mismatches.
 */
export function conflictErrorResponse(
  message: string = 'Resource conflict'
): Response {
  return errorResponse(ERROR_CODES.CONFLICT, message);
}

/**
 * Create a success Response object.
 *
 * @param data - The response data payload
 * @param meta - Optional metadata
 * @param status - HTTP status code (default: 200)
 * @returns Response object ready to return from route handler
 */
export function successResponse<T>(
  data: T,
  meta?: ApiMeta,
  status: number = 200
): Response {
  return Response.json(createSuccessResponse(data, meta), { status });
}

// --- Endpoint-Specific Response Schemas ---

/**
 * Master Dashboard response schema.
 */
export const MasterDashboardResponseSchema = ApiSuccessSchema(
  z.object({
    totals: z.object({
      clicks: z.number(),
      impressions: z.number(),
      avgPosition: z.number(),
      avgCtr: z.number(),
    }),
    comparison: z.object({
      clicksChange: z.number(),
      impressionsChange: z.number(),
      positionChange: z.number(),
      ctrChange: z.number(),
    }),
    sites: z.array(z.object({
      siteId: z.string(),
      siteName: z.string(),
      siteUrl: z.string(),
      tags: z.array(z.string()),
      metrics: z.object({
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      }),
      comparison: z.object({
        clicksChange: z.number(),
        impressionsChange: z.number(),
        ctrChange: z.number(),
        positionChange: z.number(),
      }),
      trend: z.array(z.object({
        date: z.string(),
        clicks: z.number(),
      })),
    })),
    meta: z.object({
      siteCount: z.number(),
      dateRange: z.object({
        startDate: z.string(),
        endDate: z.string(),
      }),
      comparisonPeriod: z.object({
        startDate: z.string(),
        endDate: z.string(),
      }).nullable(),
    }),
  })
);

/**
 * Trends response schema.
 */
export const TrendsResponseSchema = ApiSuccessSchema(
  z.object({
    pages: z.array(z.object({
      pageUrl: z.string(),
      pageTitle: z.string().optional(),
      currentClicks: z.number(),
      previousClicks: z.number(),
      currentImpressions: z.number(),
      previousImpressions: z.number(),
      currentPosition: z.number(),
      previousPosition: z.number(),
      changePercent: z.number(),
      trend: z.enum(['growing', 'decaying', 'stable']),
      confidence: z.enum(['high', 'medium', 'low']),
      topQueries: z.array(z.string()),
    })),
    meta: z.object({
      totalAnalyzed: z.number(),
      growingCount: z.number(),
      decayingCount: z.number(),
      stableCount: z.number(),
      periodDays: z.number(),
      threshold: z.number(),
    }),
  })
);

/**
 * Cannibalization response schema.
 */
export const CannibalizationResponseSchema = ApiSuccessSchema(
  z.object({
    issues: z.array(z.object({
      query: z.string(),
      pages: z.array(z.object({
        url: z.string(),
        position: z.number(),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
      })),
      severity: z.enum(['high', 'medium', 'low']),
      impactEstimate: z.number(),
      recommendation: z.string().optional(),
    })).optional(),
    summary: z.object({
      total: z.number(),
      high: z.number(),
      medium: z.number(),
      low: z.number(),
      totalImpactEstimate: z.number(),
    }).optional(),
    issue: z.unknown().nullable().optional(),
    message: z.string().optional(),
  })
);

/**
 * Striking Distance response schema.
 */
export const StrikingDistanceResponseSchema = ApiSuccessSchema(
  z.object({
    pages: z.array(z.object({
      pageUrl: z.string(),
      pageTitle: z.string().optional(),
      avgPosition: z.number(),
      impressions: z.number(),
      currentClicks: z.number(),
      potentialClicks: z.number(),
      clickGain: z.number(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      topQueries: z.array(z.object({
        query: z.string(),
        position: z.number(),
        impressions: z.number(),
        clicks: z.number(),
      })),
    })),
    meta: z.object({
      totalPages: z.number(),
      totalPotentialClicks: z.number(),
      avgDifficulty: z.number(),
    }),
  })
);

/**
 * Annotations response schema.
 */
export const AnnotationsResponseSchema = ApiSuccessSchema(
  z.array(z.object({
    id: z.string(),
    siteId: z.string().nullable(),
    workspaceId: z.string(),
    annotationDate: z.string(),
    annotationType: z.enum(['core_update', 'spam_update', 'helpful_content', 'product_reviews', 'link_spam', 'site_change', 'custom']),
    title: z.string(),
    description: z.string().optional(),
    impact: z.enum(['positive', 'negative', 'neutral', 'unknown']),
    autoGenerated: z.boolean(),
    sourceUrl: z.string().optional(),
    createdBy: z.string().optional(),
    createdAt: z.string(),
  }))
);

/**
 * Tags response schema.
 */
export const TagsResponseSchema = ApiSuccessSchema(
  z.array(z.object({
    tag: z.string(),
    count: z.number(),
  }))
);

/**
 * Content Groups response schema.
 */
export const ContentGroupsResponseSchema = ApiSuccessSchema(
  z.array(z.object({
    id: z.string(),
    siteId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    matchType: z.enum(['folder', 'regex', 'manual']),
    matchPattern: z.string().nullable(),
    color: z.string().nullable(),
    isAutoGenerated: z.boolean().nullable(),
    pageCount: z.number(),
    metrics: z.object({
      totalClicks: z.number(),
      totalImpressions: z.number(),
      avgPosition: z.number(),
      clicksChange: z.number(),
      impressionsChange: z.number(),
    }),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }))
);

/**
 * Topic Clusters response schema.
 */
export const TopicClustersResponseSchema = ApiSuccessSchema(
  z.array(z.object({
    id: z.string(),
    siteId: z.string(),
    name: z.string(),
    hubPage: z.object({
      url: z.string(),
      topic: z.string(),
      title: z.string().optional(),
      clicks: z.number(),
      impressions: z.number(),
      position: z.number(),
      internalLinks: z.number(),
    }),
    spokePages: z.array(z.object({
      url: z.string(),
      topic: z.string().nullable(),
      title: z.string().optional(),
      linksToHub: z.boolean(),
      internalLinkCount: z.number(),
      clicks: z.number(),
      impressions: z.number(),
      position: z.number().nullable(),
    })),
    coverage: z.number(),
    gaps: z.array(z.string()),
    totalClicks: z.number(),
    totalImpressions: z.number(),
    avgPosition: z.number(),
    lastAnalyzedAt: z.string().nullable(),
    createdAt: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }))
);

/**
 * Index Coverage response schema.
 */
export const IndexCoverageResponseSchema = ApiSuccessSchema(
  z.object({
    total: z.number(),
    indexed: z.number(),
    notIndexed: z.number(),
    byState: z.record(z.string(), z.number()),
    lastUpdated: z.string(),
  })
);

/**
 * Sync Health response schema.
 */
export const SyncHealthResponseSchema = ApiSuccessSchema(
  z.object({
    status: z.enum(['healthy', 'degraded', 'critical']),
    queue: z.object({
      gscSync: z.object({
        waiting: z.number(),
        active: z.number(),
        completed: z.number(),
        failed: z.number(),
        delayed: z.number(),
      }),
      annotationsImport: z.object({
        waiting: z.number(),
        active: z.number(),
        completed: z.number(),
        failed: z.number(),
        delayed: z.number(),
      }),
    }),
    deadLetterQueue: z.object({
      gscSync: z.number(),
      annotationsImport: z.number(),
      total: z.number(),
      unreplayed: z.number(),
      last24h: z.number(),
    }),
    lastFlowStatus: z.unknown(),
    averageJobDuration: z.object({
      gscSyncMs: z.number().nullable(),
      gscSyncFormatted: z.string().nullable(),
      annotationsMs: z.number().nullable(),
      annotationsFormatted: z.string().nullable(),
    }),
    lastSync: z.object({
      completedAt: z.number(),
      sitesProcessed: z.number(),
      rowsInserted: z.number(),
    }).nullable(),
    recentErrors: z.array(z.object({
      failedAt: z.number().nullable(),
      error: z.string(),
      jobId: z.string().nullable(),
    })),
    nextScheduled: z.number().nullable(),
  })
);

/**
 * Portfolio response schema.
 */
export const PortfolioResponseSchema = ApiSuccessSchema(
  z.object({
    totalClicks: z.number(),
    totalImpressions: z.number(),
    avgPosition: z.number(),
    avgCtr: z.number(),
    clientCount: z.number(),
    totalQueries: z.number(),
    totalPages: z.number(),
  })
);

/**
 * Visibility config response schema.
 */
export const VisibilityResponseSchema = ApiSuccessSchema(
  z.object({
    showClicks: z.boolean(),
    showImpressions: z.boolean(),
    showPosition: z.boolean(),
    showCtr: z.boolean(),
    showQueries: z.boolean(),
    showPages: z.boolean(),
    showCompetitors: z.boolean(),
    canViewGrowing: z.boolean(),
    canViewDecaying: z.boolean(),
    canViewCannibalization: z.boolean(),
    canExport: z.boolean(),
  })
);

/**
 * Refresh response schema.
 */
export const RefreshResponseSchema = ApiSuccessSchema(
  z.object({
    jobId: z.string().nullable(),
    estimatedTime: z.number(),
    queuePosition: z.number(),
    message: z.string(),
  })
);

// --- Export all schemas for client consumption ---

export const AnalyticsApiSchemas = {
  error: ApiErrorSchema,
  meta: ApiMetaSchema,
  masterDashboard: MasterDashboardResponseSchema,
  trends: TrendsResponseSchema,
  cannibalization: CannibalizationResponseSchema,
  strikingDistance: StrikingDistanceResponseSchema,
  annotations: AnnotationsResponseSchema,
  tags: TagsResponseSchema,
  contentGroups: ContentGroupsResponseSchema,
  topicClusters: TopicClustersResponseSchema,
  indexCoverage: IndexCoverageResponseSchema,
  syncHealth: SyncHealthResponseSchema,
  portfolio: PortfolioResponseSchema,
  visibility: VisibilityResponseSchema,
  refresh: RefreshResponseSchema,
} as const;
