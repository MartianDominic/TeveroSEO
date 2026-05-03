/**
 * Pagination types and utilities.
 *
 * @module @tevero/utils/pagination
 *
 * Provides shared pagination types for cursor-based and offset-based pagination.
 * These types should be used consistently across all TeveroSEO services.
 */

/**
 * Cursor-based pagination request parameters.
 * Used for efficient pagination of large datasets.
 */
export interface CursorPaginationParams {
  /** Opaque cursor for fetching the next page */
  cursor?: string;
  /** Maximum items per page (default varies by endpoint, max 100) */
  limit?: number;
  /** Column to sort by */
  sortBy?: string;
  /** Sort direction */
  sortDir?: "asc" | "desc";
}

/**
 * Cursor-based pagination response metadata.
 */
export interface CursorPaginationResult<T> {
  /** The page data */
  data: T[];
  /** Cursor for the next page (null if no more pages) */
  nextCursor: string | null;
  /** Cursor for the previous page (null if on first page) */
  prevCursor: string | null;
  /** Whether there are more pages */
  hasMore: boolean;
  /** Total count if available (may be expensive to compute) */
  totalCount?: number;
  /** Error message for graceful degradation */
  error?: string;
}

/**
 * Offset-based pagination request parameters.
 * Simpler but less efficient for large datasets.
 */
export interface OffsetPaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortDir?: "asc" | "desc";
}

/**
 * Offset-based pagination response metadata.
 */
export interface OffsetPaginationMeta {
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrev: boolean;
}

/**
 * Generic paginated response with offset-based pagination.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: OffsetPaginationMeta;
}

/**
 * Filter parameters common across endpoints.
 */
export interface FilterParams {
  /** Search query string */
  search?: string;
  /** Filter by status values */
  status?: string[];
  /** Filter by date range start (ISO 8601) */
  dateFrom?: string;
  /** Filter by date range end (ISO 8601) */
  dateTo?: string;
  /** Filter by owner/assignee ID */
  ownerId?: string;
  /** Filter by tags */
  tags?: string[];
}

/**
 * Encode cursor data as base64url string.
 *
 * @param data - Object containing cursor state
 * @returns Base64url encoded cursor string
 *
 * @example
 * ```typescript
 * const cursor = encodeCursor({ id: "abc123", sortValue: 42 });
 * // "eyJpZCI6ImFiYzEyMyIsInNvcnRWYWx1ZSI6NDJ9"
 * ```
 */
export function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString("base64url");
}

/**
 * Decode cursor string back to object.
 * Returns null if the cursor is invalid.
 *
 * @param cursor - Base64url encoded cursor string
 * @returns Decoded cursor object or null
 *
 * @example
 * ```typescript
 * const data = decodeCursor(cursor);
 * if (data) {
 *   const { id, sortValue } = data;
 * }
 * ```
 */
export function decodeCursor<T = Record<string, unknown>>(
  cursor: string
): T | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf-8")
    );
    return decoded as T;
  } catch {
    return null;
  }
}

/**
 * Calculate offset pagination metadata.
 *
 * @param total - Total number of items
 * @param page - Current page (1-indexed)
 * @param limit - Items per page
 * @returns Pagination metadata
 */
export function calculatePaginationMeta(
  total: number,
  page: number,
  limit: number
): OffsetPaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Calculate offset from page number.
 *
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Offset for database query
 */
export function calculateOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * limit;
}
