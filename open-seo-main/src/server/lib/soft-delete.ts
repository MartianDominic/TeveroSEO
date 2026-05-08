/**
 * Soft Delete Query Utilities
 *
 * Provides consistent soft delete filtering across all Drizzle queries.
 * Used by repositories to ensure deleted records are excluded by default.
 *
 * =============================================================================
 * MIGRATION NOTICE (DBS-005/006/007)
 * =============================================================================
 * This file supports TWO soft delete patterns during migration:
 *
 * LEGACY PATTERN (being phased out):
 * - Columns: is_deleted BOOLEAN DEFAULT FALSE, deleted_at TIMESTAMPTZ
 * - Query: WHERE is_deleted = false
 * - Functions: withSoftDelete(), softDeleteValues(), restoreValues()
 *
 * NEW STANDARD PATTERN (target):
 * - Column: soft_deleted_at TIMESTAMPTZ DEFAULT NULL
 * - Query: WHERE soft_deleted_at IS NULL
 * - Functions: withSoftDeleteV2(), softDeleteValuesV2(), restoreValuesV2()
 *
 * After migration 0082 removes legacy columns, the V2 functions will be
 * renamed to the non-V2 names.
 * =============================================================================
 *
 * @example
 * // Basic usage (legacy pattern)
 * const clients = await db.query.clients.findMany({
 *   where: withSoftDelete(clients, eq(clients.workspaceId, orgId))
 * });
 *
 * @example
 * // New pattern usage
 * const tags = await db.query.siteTags.findMany({
 *   where: withSoftDeleteV2(siteTags, eq(siteTags.siteId, siteId))
 * });
 *
 * @example
 * // Include deleted records
 * const allClients = await db.query.clients.findMany({
 *   where: eq(clients.workspaceId, orgId)  // No withSoftDelete
 * });
 */

import { and, eq, isNull, isNotNull, SQL, type AnyColumn } from "drizzle-orm";
import type { PgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";

// Re-export V2 utilities from the new module
export {
  softDeleteColumns,
  softDeleteValuesV2,
  restoreValuesV2,
  isSoftDeletedV2,
  isActiveV2,
  filterActiveV2,
  filterDeletedV2,
} from "../../db/soft-delete-columns";

/**
 * Type for tables that support soft delete.
 * Tables must have is_deleted (boolean) and optionally deleted_at (timestamp).
 */
export interface SoftDeletableTable {
  isDeleted: PgColumn<{
    name: string;
    tableName: string;
    dataType: "boolean";
    columnType: "PgBoolean";
    data: boolean;
    driverParam: boolean;
    notNull: true;
    hasDefault: true;
    isPrimaryKey: false;
    isAutoincrement: false;
    hasRuntimeDefault: false;
    enumValues: undefined;
    baseColumn: never;
    generated: undefined;
  }>;
  deletedAt?: PgColumn<{
    name: string;
    tableName: string;
    dataType: "date";
    columnType: "PgTimestamp";
    data: Date;
    driverParam: string;
    notNull: false;
    hasDefault: false;
    isPrimaryKey: false;
    isAutoincrement: false;
    hasRuntimeDefault: false;
    enumValues: undefined;
    baseColumn: never;
    generated: undefined;
  }>;
}

/**
 * Wraps a condition with soft delete filtering.
 * Ensures is_deleted = false is always included in the WHERE clause.
 *
 * @param table - The table with soft delete columns
 * @param condition - Optional additional condition
 * @returns Combined SQL condition
 *
 * @example
 * // With additional condition
 * const active = withSoftDelete(clients, eq(clients.status, 'active'));
 *
 * // Without additional condition
 * const all = withSoftDelete(clients);
 */
export function withSoftDelete<T extends SoftDeletableTable>(
  table: T,
  condition?: SQL | undefined
): SQL {
  const notDeleted = eq(table.isDeleted, false);

  if (condition) {
    return and(notDeleted, condition)!;
  }

  return notDeleted;
}

/**
 * Soft delete a record by setting is_deleted = true and deleted_at = now().
 * Returns the values object to use in an UPDATE query.
 *
 * @returns Object with soft delete values
 *
 * @example
 * await db.update(clients)
 *   .set(softDeleteValues())
 *   .where(eq(clients.id, clientId));
 */
export function softDeleteValues(): {
  isDeleted: true;
  deletedAt: Date;
} {
  return {
    isDeleted: true,
    deletedAt: new Date(),
  };
}

/**
 * Restore a soft-deleted record by clearing the deletion markers.
 * Returns the values object to use in an UPDATE query.
 *
 * @returns Object with restoration values
 *
 * @example
 * await db.update(clients)
 *   .set(restoreValues())
 *   .where(eq(clients.id, clientId));
 */
export function restoreValues(): {
  isDeleted: false;
  deletedAt: null;
} {
  return {
    isDeleted: false,
    deletedAt: null,
  };
}

/**
 * Check if a record is soft-deleted.
 *
 * @param record - Record with isDeleted field
 * @returns true if record is deleted
 */
export function isDeleted(record: { isDeleted: boolean }): boolean {
  return record.isDeleted === true;
}

/**
 * Check if a record is active (not soft-deleted).
 *
 * @param record - Record with isDeleted field
 * @returns true if record is active
 */
export function isActive(record: { isDeleted: boolean }): boolean {
  return record.isDeleted === false;
}

/**
 * Filter an array of records to exclude soft-deleted ones.
 * Useful for in-memory filtering after fetching.
 *
 * @param records - Array of records with isDeleted field
 * @returns Filtered array of active records
 *
 * @example
 * const clients = await db.query.clients.findMany();
 * const activeClients = filterActive(clients);
 */
export function filterActive<T extends { isDeleted: boolean }>(
  records: T[]
): T[] {
  return records.filter(isActive);
}

/**
 * Filter an array of records to only include soft-deleted ones.
 * Useful for "trash" views.
 *
 * @param records - Array of records with isDeleted field
 * @returns Filtered array of deleted records
 *
 * @example
 * const clients = await db.query.clients.findMany();
 * const trashedClients = filterDeleted(clients);
 */
export function filterDeleted<T extends { isDeleted: boolean }>(
  records: T[]
): T[] {
  return records.filter(isDeleted);
}

// =============================================================================
// NEW STANDARD PATTERN (DBS-005/006/007)
// =============================================================================

/**
 * Type for tables that support the new soft delete pattern.
 * Tables must have soft_deleted_at (timestamp) column.
 */
export interface SoftDeletableTableV2 {
  softDeletedAt: PgColumn<{
    name: string;
    tableName: string;
    dataType: "date";
    columnType: "PgTimestamp";
    data: Date;
    driverParam: string;
    notNull: false;
    hasDefault: false;
    isPrimaryKey: false;
    isAutoincrement: false;
    hasRuntimeDefault: false;
    enumValues: undefined;
    baseColumn: never;
    generated: undefined;
  }>;
}

/**
 * Wraps a condition with soft delete filtering using the new pattern.
 * Ensures soft_deleted_at IS NULL is always included in the WHERE clause.
 *
 * @param table - The table with softDeletedAt column
 * @param condition - Optional additional condition
 * @returns Combined SQL condition
 *
 * @example
 * // With additional condition
 * const activeTags = withSoftDeleteV2(siteTags, eq(siteTags.siteId, siteId));
 *
 * // Without additional condition
 * const allActiveTags = withSoftDeleteV2(siteTags);
 */
export function withSoftDeleteV2<T extends SoftDeletableTableV2>(
  table: T,
  condition?: SQL | undefined
): SQL {
  const notDeleted = isNull(table.softDeletedAt);

  if (condition) {
    return and(notDeleted, condition)!;
  }

  return notDeleted;
}

/**
 * Wraps a condition to only return soft-deleted records using the new pattern.
 * Useful for "trash" views.
 *
 * @param table - The table with softDeletedAt column
 * @param condition - Optional additional condition
 * @returns Combined SQL condition for deleted records only
 */
export function withDeletedOnlyV2<T extends SoftDeletableTableV2>(
  table: T,
  condition?: SQL | undefined
): SQL {
  const onlyDeleted = isNotNull(table.softDeletedAt);

  if (condition) {
    return and(onlyDeleted, condition)!;
  }

  return onlyDeleted;
}
