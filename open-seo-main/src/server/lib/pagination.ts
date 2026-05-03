/**
 * Cursor-based pagination utilities for Drizzle ORM.
 * Phase 69-03: Query Optimization
 *
 * Provides efficient cursor pagination for large datasets.
 * Uses opaque cursors (base64url encoded) for security and flexibility.
 *
 * @example
 * ```typescript
 * // In a repository method
 * const cursor = req.query.cursor;
 * const limit = Math.min(req.query.limit ?? 50, 100);
 *
 * const cursorCondition = buildCursorCondition(cursor, {
 *   primaryKey: 'id',
 *   sortColumn: 'createdAt',
 *   sortDirection: 'desc',
 * }, prospects);
 *
 * const items = await db.query.prospects.findMany({
 *   where: and(
 *     eq(prospects.workspaceId, workspaceId),
 *     cursorCondition,
 *   ),
 *   orderBy: [desc(prospects.createdAt), desc(prospects.id)],
 *   limit: limit + 1, // Fetch one extra to determine hasMore
 * });
 *
 * const hasMore = items.length > limit;
 * const data = hasMore ? items.slice(0, -1) : items;
 * const nextCursor = hasMore ? encodeCursor(last(data).id, last(data).createdAt) : null;
 * ```
 */

import { sql, gt, lt, type SQL } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for cursor-based pagination.
 */
export interface CursorConfig {
  /** Primary key column name (used as tiebreaker) */
  primaryKey: string;
  /** Optional sort column name (for compound cursors) */
  sortColumn?: string;
  /** Sort direction (defaults to 'desc' for most-recent-first) */
  sortDirection?: "asc" | "desc";
}

/**
 * Decoded cursor data.
 */
export interface CursorData {
  /** Primary key value */
  id: string;
  /** Sort column value (for compound cursors) */
  value?: string;
}

/**
 * Result type for cursor-paginated queries.
 */
export interface CursorPaginationResult<T> {
  /** The items for this page */
  items: T[];
  /** Cursor for the next page (null if no more pages) */
  nextCursor: string | null;
  /** Whether there are more items after this page */
  hasMore: boolean;
}

// ============================================================================
// Cursor Encoding/Decoding
// ============================================================================

/**
 * Encode cursor data as a base64url string.
 * Uses ':' as separator for compound cursors (id:sortValue).
 *
 * @param id - Primary key value
 * @param value - Optional sort column value
 * @returns Base64url encoded cursor string
 *
 * @example
 * ```typescript
 * // Simple cursor (id only)
 * const cursor = encodeCursor("abc123");
 * // => "YWJjMTIz"
 *
 * // Compound cursor (id + sortValue)
 * const cursor = encodeCursor("abc123", "2024-01-15T10:30:00Z");
 * // => "YWJjMTIzOjIwMjQtMDEtMTVUMTA6MzA6MDBa"
 * ```
 */
export function encodeCursor(id: string, value?: string): string {
  const data = value !== undefined ? `${id}:${value}` : id;
  return Buffer.from(data).toString("base64url");
}

/**
 * Decode a cursor string back to its components.
 * Returns null if the cursor is invalid.
 *
 * @param cursor - Base64url encoded cursor string
 * @returns Decoded cursor data or null if invalid
 *
 * @example
 * ```typescript
 * const data = decodeCursor("YWJjMTIzOjIwMjQtMDEtMTVUMTA6MzA6MDBa");
 * // => { id: "abc123", value: "2024-01-15T10:30:00Z" }
 * ```
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const colonIndex = decoded.indexOf(":");

    if (colonIndex === -1) {
      // Simple cursor (id only)
      return { id: decoded };
    }

    // Compound cursor (id:value)
    const id = decoded.slice(0, colonIndex);
    const value = decoded.slice(colonIndex + 1);
    return { id, value };
  } catch {
    return null;
  }
}

// ============================================================================
// Cursor Condition Builder
// ============================================================================

/**
 * Build a WHERE condition for cursor-based pagination.
 *
 * For compound cursors (with sortColumn), uses row comparison:
 * - DESC: (sortColumn, id) < (cursorValue, cursorId)
 * - ASC: (sortColumn, id) > (cursorValue, cursorId)
 *
 * For simple cursors (id only):
 * - DESC: id < cursorId
 * - ASC: id > cursorId
 *
 * @param cursor - Cursor string (undefined for first page)
 * @param config - Cursor configuration
 * @param table - Drizzle table reference
 * @returns SQL condition for WHERE clause, or undefined for first page
 *
 * @example
 * ```typescript
 * // First page (no cursor)
 * buildCursorCondition(undefined, config, table);
 * // => undefined
 *
 * // Subsequent pages
 * buildCursorCondition("YWJjMTIz", {
 *   primaryKey: 'id',
 *   sortColumn: 'createdAt',
 *   sortDirection: 'desc',
 * }, prospects);
 * // => SQL condition for (createdAt, id) < (cursorValue, cursorId)
 * ```
 */
export function buildCursorCondition(
  cursor: string | undefined,
  config: CursorConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any
): SQL | undefined {
  if (!cursor) {
    return undefined;
  }

  const decoded = decodeCursor(cursor);
  if (!decoded) {
    // Invalid cursor - return undefined to skip filtering
    return undefined;
  }

  const { id, value } = decoded;
  const direction = config.sortDirection ?? "desc";

  // Compound cursor: (sortColumn, id) comparison
  if (config.sortColumn && value !== undefined) {
    // Row comparison for compound sort
    // For DESC: we want rows where (sortColumn, id) < (value, cursorId)
    // For ASC: we want rows where (sortColumn, id) > (value, cursorId)
    const sortCol = table[config.sortColumn];
    const pkCol = table[config.primaryKey];

    if (!sortCol || !pkCol) {
      return undefined;
    }

    // SQL row comparison: (col1, col2) < (val1, val2) or (col1, col2) > (val1, val2)
    if (direction === "desc") {
      return sql`(${sortCol}, ${pkCol}) < (${value}, ${id})`;
    } else {
      return sql`(${sortCol}, ${pkCol}) > (${value}, ${id})`;
    }
  }

  // Simple cursor: id-only comparison
  const pkCol = table[config.primaryKey];
  if (!pkCol) {
    return undefined;
  }

  if (direction === "desc") {
    return lt(pkCol, id);
  } else {
    return gt(pkCol, id);
  }
}

// ============================================================================
// Pagination Helper
// ============================================================================

/**
 * Process query results into a cursor pagination response.
 *
 * Expects one extra item fetched (limit + 1) to determine hasMore.
 *
 * @param items - Query results (should fetch limit + 1 items)
 * @param limit - Page size
 * @param config - Cursor configuration
 * @returns Pagination result with items, nextCursor, and hasMore
 *
 * @example
 * ```typescript
 * const items = await db.query.prospects.findMany({
 *   where: condition,
 *   limit: limit + 1,
 * });
 *
 * return buildPaginationResult(items, limit, {
 *   primaryKey: 'id',
 *   sortColumn: 'createdAt',
 * });
 * ```
 */
export function buildPaginationResult<T extends Record<string, unknown>>(
  items: T[],
  limit: number,
  config: Pick<CursorConfig, "primaryKey" | "sortColumn">
): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    const id = String(lastItem[config.primaryKey] ?? "");
    const value = config.sortColumn
      ? String(lastItem[config.sortColumn] ?? "")
      : undefined;
    nextCursor = encodeCursor(id, value);
  }

  return {
    items: data,
    nextCursor,
    hasMore,
  };
}

// ============================================================================
// Constants
// ============================================================================

/** Default page size for cursor pagination */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size (enforced on all list endpoints) */
export const MAX_PAGE_SIZE = 100;

/**
 * Clamp page size to valid range.
 *
 * @param limit - Requested limit
 * @param defaultLimit - Default if not provided
 * @returns Clamped limit value
 */
export function clampPageSize(
  limit: number | undefined,
  defaultLimit: number = DEFAULT_PAGE_SIZE
): number {
  if (limit === undefined) {
    return defaultLimit;
  }
  return Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
}
