/**
 * Common Shared Types
 *
 * Phase 96 Type Unification: Single source of truth for common types
 * used across apps/web, open-seo-main, and shared packages.
 *
 * @module @tevero/types/common
 */

import { z } from "zod";

// =============================================================================
// Date Range Types
// =============================================================================

/**
 * Standard date range representation.
 * Dates are in YYYY-MM-DD format (ISO 8601 date portion).
 */
export interface DateRange {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
}

/**
 * Date range with Date objects (start/end naming).
 * Used for internal processing where Date objects are preferred.
 */
export interface DateRangeDate {
  /** Start date */
  start: Date;
  /** End date */
  end: Date;
}

/**
 * Date range with Date objects (from/to naming).
 * Alternative naming convention used in some repositories.
 */
export interface DateRangeFromTo {
  /** From date */
  from: Date;
  /** To date */
  to: Date;
}

/**
 * Zod schema for DateRange validation.
 *
 * @example
 * ```ts
 * const result = DateRangeSchema.safeParse({ startDate: '2024-01-01', endDate: '2024-01-31' });
 * if (result.success) {
 *   const range: DateRange = result.data;
 * }
 * ```
 */
export const DateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: "startDate must be before or equal to endDate" }
);

/**
 * Comparison period for analytics.
 * - WoW: Week over Week (7 days)
 * - MoM: Month over Month (30 days)
 * - YoY: Year over Year (365 days)
 */
export type ComparisonPeriod = "WoW" | "MoM" | "YoY";

/**
 * Zod schema for ComparisonPeriod.
 */
export const ComparisonPeriodSchema = z.enum(["WoW", "MoM", "YoY"]);

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * Standard pagination parameters for list endpoints.
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Sort field name */
  sortBy?: string;
  /** Sort direction */
  sortDir?: "asc" | "desc";
}

/**
 * Zod schema for PaginationParams validation.
 */
export const PaginationParamsSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(500).optional().default(50),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Cursor-based pagination parameters for large datasets.
 */
export interface CursorPaginationParams {
  /** Encoded cursor (from previous response) */
  cursor?: string;
  /** Number of items per page */
  limit?: number;
  /** Sort field name */
  sortBy?: string;
  /** Sort direction */
  sortDir?: "asc" | "desc";
}

/**
 * Zod schema for CursorPaginationParams validation.
 */
export const CursorPaginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional().default(50),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Cursor-based pagination result wrapper.
 */
export interface CursorPaginationResult<T> {
  /** Result data items */
  data: T[];
  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;
  /** Cursor for previous page (null if at start) */
  prevCursor: string | null;
  /** Whether more items exist */
  hasMore: boolean;
  /** Total count of matching items */
  totalCount: number;
  /** Error message for graceful degradation */
  error?: string;
}

/**
 * Common filter parameters for list endpoints.
 */
export interface FilterParams {
  /** Search query string */
  search?: string;
  /** Filter by status values */
  status?: string[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by owner ID */
  ownerId?: string;
  /** Filter by date from */
  dateFrom?: string;
  /** Filter by date to */
  dateTo?: string;
}

/**
 * Zod schema for FilterParams validation.
 */
export const FilterParamsSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// =============================================================================
// Sort Types
// =============================================================================

/**
 * Sort direction type.
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort configuration for a single field.
 */
export interface SortConfig {
  /** Field to sort by */
  field: string;
  /** Sort direction */
  direction: SortDirection;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Make specific properties of T required.
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties of T optional.
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract the element type from an array type.
 */
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

/**
 * Non-empty array type.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Nullable type helper.
 */
export type Nullable<T> = T | null;

/**
 * Maybe type helper (null or undefined).
 */
export type Maybe<T> = T | null | undefined;

// =============================================================================
// ID Types (Branded)
// =============================================================================

/**
 * Brand type helper for nominal typing.
 */
declare const __brand: unique symbol;
type Brand<B> = { [__brand]: B };

/**
 * Branded string type for type-safe IDs.
 */
export type Branded<T, B> = T & Brand<B>;

/**
 * Client ID branded type.
 */
export type ClientId = Branded<string, "ClientId">;

/**
 * Workspace ID branded type.
 */
export type WorkspaceId = Branded<string, "WorkspaceId">;

/**
 * Site ID branded type.
 */
export type SiteId = Branded<string, "SiteId">;

/**
 * User ID branded type.
 */
export type UserId = Branded<string, "UserId">;

// =============================================================================
// Cursor Encoding Utilities
// =============================================================================

/**
 * Cursor data for encoding/decoding.
 */
interface CursorData {
  id: string;
  sortValue: string | number;
}

/**
 * Zod schema for cursor validation.
 */
const CursorDataSchema = z.object({
  id: z.string(),
  sortValue: z.union([z.string(), z.number()]),
});

/**
 * Encode cursor data as base64url string.
 * Uses browser-compatible base64 encoding.
 *
 * @param id - Entity ID
 * @param sortValue - Sort field value
 * @returns Base64url encoded cursor string
 */
export function encodeCursor(id: string, sortValue: string | number): string {
  const json = JSON.stringify({ id, sortValue });
  // Use btoa for browser compatibility, with base64url conversion
  const base64 = typeof btoa !== "undefined"
    ? btoa(json)
    : Buffer.from(json).toString("base64");
  // Convert base64 to base64url
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode cursor string back to components.
 * Uses Zod validation for type safety.
 *
 * @param cursor - Base64url encoded cursor string
 * @returns Decoded cursor data or null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    // Convert base64url to base64
    let base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    while (base64.length % 4) {
      base64 += "=";
    }
    // Decode using atob for browser compatibility
    const json = typeof atob !== "undefined"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString();
    const decoded = JSON.parse(json);
    const parsed = CursorDataSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
