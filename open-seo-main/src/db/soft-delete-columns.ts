/**
 * Soft Delete Column Mixin
 * Phase 96: Standardized soft delete pattern (DBS-005/006/007)
 *
 * Standard pattern: softDeletedAt TIMESTAMPTZ DEFAULT NULL
 * - Single column: simpler queries (WHERE soft_deleted_at IS NULL)
 * - Self-documenting: NULL = active, non-NULL = deleted with timestamp
 * - Efficient: No redundant boolean column
 * - Queryable: Can filter by deletion time range
 *
 * @example
 * // Use in table definitions
 * export const myTable = pgTable(
 *   "my_table",
 *   {
 *     id: uuid("id").primaryKey().defaultRandom(),
 *     name: text("name").notNull(),
 *     ...softDeleteColumns,
 *   }
 * );
 *
 * @example
 * // Query active records
 * const active = await db
 *   .select()
 *   .from(myTable)
 *   .where(isNull(myTable.softDeletedAt));
 *
 * @example
 * // Soft delete a record
 * await db
 *   .update(myTable)
 *   .set({ softDeletedAt: new Date() })
 *   .where(eq(myTable.id, id));
 *
 * @example
 * // Restore a record
 * await db
 *   .update(myTable)
 *   .set({ softDeletedAt: null })
 *   .where(eq(myTable.id, id));
 */

import { timestamp } from "drizzle-orm/pg-core";

/**
 * Standard soft delete columns for table definitions.
 * Spread this into your pgTable column definition.
 */
export const softDeleteColumns = {
  softDeletedAt: timestamp("soft_deleted_at", { withTimezone: true }),
} as const;

/**
 * Type for tables that support the new soft delete pattern.
 * Use this for type constraints in utility functions.
 */
export interface SoftDeletableTableV2 {
  softDeletedAt: ReturnType<typeof timestamp>;
}

/**
 * Get soft delete values for an UPDATE query.
 * Sets softDeletedAt to the current timestamp.
 *
 * @returns Object with softDeletedAt set to current time
 *
 * @example
 * await db.update(myTable)
 *   .set(softDeleteValuesV2())
 *   .where(eq(myTable.id, id));
 */
export function softDeleteValuesV2(): { softDeletedAt: Date } {
  return {
    softDeletedAt: new Date(),
  };
}

/**
 * Get restore values for an UPDATE query.
 * Sets softDeletedAt to null, marking the record as active.
 *
 * @returns Object with softDeletedAt set to null
 *
 * @example
 * await db.update(myTable)
 *   .set(restoreValuesV2())
 *   .where(eq(myTable.id, id));
 */
export function restoreValuesV2(): { softDeletedAt: null } {
  return {
    softDeletedAt: null,
  };
}

/**
 * Check if a record is soft-deleted using the new pattern.
 *
 * @param record - Record with softDeletedAt field
 * @returns true if record is deleted (softDeletedAt is non-null)
 */
export function isSoftDeletedV2(record: {
  softDeletedAt: Date | null;
}): boolean {
  return record.softDeletedAt !== null;
}

/**
 * Check if a record is active using the new pattern.
 *
 * @param record - Record with softDeletedAt field
 * @returns true if record is active (softDeletedAt is null)
 */
export function isActiveV2(record: { softDeletedAt: Date | null }): boolean {
  return record.softDeletedAt === null;
}

/**
 * Filter an array of records to exclude soft-deleted ones.
 * Uses the new pattern (softDeletedAt).
 *
 * @param records - Array of records with softDeletedAt field
 * @returns Filtered array of active records
 *
 * @example
 * const clients = await db.query.clients.findMany();
 * const activeClients = filterActiveV2(clients);
 */
export function filterActiveV2<T extends { softDeletedAt: Date | null }>(
  records: T[]
): T[] {
  return records.filter(isActiveV2);
}

/**
 * Filter an array of records to only include soft-deleted ones.
 * Useful for "trash" views.
 *
 * @param records - Array of records with softDeletedAt field
 * @returns Filtered array of deleted records
 *
 * @example
 * const clients = await db.query.clients.findMany();
 * const trashedClients = filterDeletedV2(clients);
 */
export function filterDeletedV2<T extends { softDeletedAt: Date | null }>(
  records: T[]
): T[] {
  return records.filter(isSoftDeletedV2);
}
