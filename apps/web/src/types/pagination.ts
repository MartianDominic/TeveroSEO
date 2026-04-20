/**
 * Cursor-based pagination types for large dataset handling.
 */

export interface CursorPaginationParams {
  cursor?: string;          // Encoded cursor (clientId + sortValue)
  limit?: number;           // Page size (default 50)
  sortBy?: string;          // Column to sort by
  sortDir?: "asc" | "desc"; // Sort direction
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

export interface FilterParams {
  search?: string;                    // Search in client name
  status?: string[];                  // Filter by status
  goalAttainmentMin?: number;         // Min goal attainment %
  goalAttainmentMax?: number;         // Max goal attainment %
  hasAlerts?: boolean;                // Has pending alerts
  alertSeverity?: string[];           // Filter by alert severity
  ownerId?: string;                   // Filter by team member
  tags?: string[];                    // Filter by tags
}

/**
 * Encode cursor data as base64url string.
 */
export function encodeCursor(clientId: string, sortValue: string | number): string {
  return Buffer.from(JSON.stringify({ clientId, sortValue })).toString("base64url");
}

/**
 * Decode cursor string back to components.
 */
export function decodeCursor(cursor: string): { clientId: string; sortValue: string | number } | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString()) as { clientId: string; sortValue: string | number };
  } catch {
    return null;
  }
}
