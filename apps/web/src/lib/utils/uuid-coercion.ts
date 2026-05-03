/**
 * UUID coercion utilities for cross-app data consistency.
 *
 * CRIT-10 / HIGH-13 / HIGH-14 Fix:
 * AI-Writer may return UUID objects while apps/web and open-seo-main
 * expect string UUIDs. This module provides defensive coercion utilities
 * to ensure consistent string comparison and storage.
 *
 * Usage:
 *   import { ensureStringId, ensureStringIds } from '@/lib/utils/uuid-coercion';
 *
 *   // Single ID
 *   const clientId = ensureStringId(response.client_id);
 *
 *   // Object with ID fields
 *   const client = ensureStringIds(response, ['id', 'client_id', 'workspace_id']);
 */

/**
 * Ensure a value is a string ID, handling UUID objects and various input types.
 *
 * @param value - The value to coerce to a string ID
 * @returns The string representation, or empty string if null/undefined
 *
 * @example
 * ensureStringId("123e4567-e89b-12d3-a456-426614174000") // returns "123e4567-e89b-12d3-a456-426614174000"
 * ensureStringId({ toString: () => "123..." }) // returns "123..." (handles UUID objects)
 * ensureStringId(null) // returns ""
 */
export function ensureStringId(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  // Handle UUID objects or any object with toString
  if (typeof value === "object" && value !== null) {
    // Check for explicit string conversion method
    if ("toString" in value && typeof value.toString === "function") {
      const stringValue = value.toString();
      // Avoid [object Object] from default toString
      if (stringValue !== "[object Object]") {
        return stringValue;
      }
    }
  }

  // Fallback: convert to string
  return String(value);
}

/**
 * Ensure specific fields in an object are string IDs.
 *
 * Creates a new object with the specified fields coerced to strings.
 * Does not mutate the original object.
 *
 * @param obj - The object containing ID fields
 * @param fields - Array of field names to coerce to strings
 * @returns New object with coerced string IDs
 *
 * @example
 * const response = { id: uuidObject, name: "Test" };
 * const safe = ensureStringIds(response, ['id']);
 * // safe.id is now a string
 */
export function ensureStringIds<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };

  for (const field of fields) {
    if (field in result) {
      (result as Record<string, unknown>)[field as string] = ensureStringId(
        result[field]
      );
    }
  }

  return result;
}

/**
 * Ensure all objects in an array have string IDs for specified fields.
 *
 * @param arr - Array of objects
 * @param fields - Array of field names to coerce to strings
 * @returns New array with coerced string IDs
 *
 * @example
 * const clients = ensureStringIdsArray(response.clients, ['id', 'workspace_id']);
 */
export function ensureStringIdsArray<T extends Record<string, unknown>>(
  arr: T[],
  fields: (keyof T)[]
): T[] {
  return arr.map((obj) => ensureStringIds(obj, fields));
}

/**
 * Compare two IDs for equality, handling both string and UUID object formats.
 *
 * @param a - First ID to compare
 * @param b - Second ID to compare
 * @returns true if the IDs are equal (after string coercion)
 *
 * @example
 * compareIds("123...", uuidObject) // returns true if same UUID
 * compareIds(null, undefined) // returns true (both empty)
 */
export function compareIds(a: unknown, b: unknown): boolean {
  return ensureStringId(a) === ensureStringId(b);
}

/**
 * Check if a value is a valid UUID string format.
 *
 * @param value - The value to check
 * @returns true if the value is a valid UUID string
 */
export function isValidUuidString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}
