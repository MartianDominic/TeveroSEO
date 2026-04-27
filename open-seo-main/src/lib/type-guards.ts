/**
 * Type-safe utilities for open-seo-main.
 *
 * Provides type guards, assertions, and helper functions to eliminate
 * unsafe patterns like `as any` casts and non-null assertions.
 */

/**
 * Custom error for not found entities.
 * Maps to HTTP 404 responses in API handlers.
 */
export class NotFoundError extends Error {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Custom error for validation failures.
 * Maps to HTTP 400 responses in API handlers.
 */
export class ValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Assert database result exists.
 * Throws NotFoundError if not found.
 *
 * @example
 * const result = await db.query.keywords.findFirst({...});
 * assertFound(result, 'Keyword', keywordId);
 * // result is now typed as non-null
 */
export function assertFound<T>(
  result: T | null | undefined,
  entity: string,
  id?: string
): asserts result is T {
  if (result === null || result === undefined) {
    const message = id ? `${entity} not found: ${id}` : `${entity} not found`;
    throw new NotFoundError(message);
  }
}

/**
 * Safe access to first element of query result.
 * Returns null instead of undefined for consistency.
 *
 * @example
 * const [row] = await db.select().from(users).limit(1);
 * // row could be undefined
 *
 * const user = firstOrNull(await db.select().from(users).limit(1));
 * // user is typed as User | null
 */
export function firstOrNull<T>(results: T[]): T | null {
  return results.length > 0 ? results[0] : null;
}

/**
 * Assert array is not empty.
 * Provides type narrowing to tuple with at least one element.
 *
 * @example
 * const items = await fetchItems();
 * assertNonEmpty(items, 'No items found');
 * // items is now [T, ...T[]]
 * const first = items[0]; // Guaranteed to exist
 */
export function assertNonEmpty<T>(
  array: T[],
  context: string
): asserts array is [T, ...T[]] {
  if (array.length === 0) {
    throw new ValidationError(`Expected non-empty array: ${context}`);
  }
}

/**
 * Type guard for checking if value is defined (not null or undefined).
 *
 * @example
 * const items = [1, null, 2, undefined, 3];
 * const defined = items.filter(isDefined); // number[]
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Filter out null/undefined from array with type narrowing.
 *
 * @example
 * const maybeUsers: (User | null)[] = await Promise.all(fetches);
 * const users: User[] = filterDefined(maybeUsers);
 */
export function filterDefined<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(isDefined);
}

/**
 * Parse numeric string or return null.
 * Useful for query parameters and user input.
 *
 * @example
 * const page = parseIntOrNull(searchParams.get('page')) ?? 1;
 */
export function parseIntOrNull(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parse float string or return null.
 *
 * @example
 * const score = parseFloatOrNull(searchParams.get('minScore')) ?? 0;
 */
export function parseFloatOrNull(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Safe property access with type checking.
 * Returns undefined if object is null/undefined.
 *
 * @example
 * const name = getProperty(user, 'name'); // string | undefined
 */
export function getProperty<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  return obj?.[key];
}

/**
 * Type guard for string enum membership.
 * Useful for validating status fields from user input.
 *
 * @example
 * const STATUSES = ['pending', 'active', 'completed'] as const;
 * if (isEnumValue(input.status, STATUSES)) {
 *   // status is typed as 'pending' | 'active' | 'completed'
 * }
 */
export function isEnumValue<T extends readonly string[]>(
  value: unknown,
  enumArray: T
): value is T[number] {
  return typeof value === "string" && enumArray.includes(value);
}

/**
 * Assert value is a valid enum member.
 * Throws ValidationError if not.
 *
 * @example
 * assertEnumValue(input.status, PROSPECT_STATUS, 'status');
 * // status is now typed as enum member
 */
export function assertEnumValue<T extends readonly string[]>(
  value: unknown,
  enumArray: T,
  fieldName: string
): asserts value is T[number] {
  if (!isEnumValue(value, enumArray)) {
    throw new ValidationError(
      `Invalid ${fieldName}: ${String(value)}. Must be one of: ${enumArray.join(", ")}`
    );
  }
}

/**
 * Safely narrow unknown to Record type for JSON objects.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Assert value is a Record (plain object).
 */
export function assertRecord(
  value: unknown,
  context: string
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ValidationError(`Expected object for ${context}, got ${typeof value}`);
  }
}

/**
 * Type-safe object key check.
 */
export function hasKey<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isRecord(obj) && key in obj;
}

/**
 * Safely cast a value with runtime validation.
 * Alternative to `as any` when you need to validate at runtime.
 *
 * @example
 * const config = safeCast(
 *   rawConfig,
 *   (v): v is TriggerConfig => isRecord(v) && hasKey(v, 'threshold'),
 *   'TriggerConfig'
 * );
 */
export function safeCast<T>(
  value: unknown,
  guard: (v: unknown) => v is T,
  typeName: string
): T {
  if (!guard(value)) {
    throw new ValidationError(`Value is not a valid ${typeName}`);
  }
  return value;
}

/**
 * Extract and validate a typed property from an unknown object.
 *
 * @example
 * const threshold = extractNumber(config, 'threshold', 20);
 */
export function extractNumber(
  obj: unknown,
  key: string,
  defaultValue: number
): number {
  if (!isRecord(obj)) return defaultValue;
  const value = obj[key];
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  return defaultValue;
}

/**
 * Extract and validate a string property from an unknown object.
 */
export function extractString(
  obj: unknown,
  key: string,
  defaultValue: string
): string {
  if (!isRecord(obj)) return defaultValue;
  const value = obj[key];
  if (typeof value === "string") return value;
  return defaultValue;
}

/**
 * Extract and validate a boolean property from an unknown object.
 */
export function extractBoolean(
  obj: unknown,
  key: string,
  defaultValue: boolean
): boolean {
  if (!isRecord(obj)) return defaultValue;
  const value = obj[key];
  if (typeof value === "boolean") return value;
  return defaultValue;
}

/**
 * Extract and validate a string array property from an unknown object.
 */
export function extractStringArray(
  obj: unknown,
  key: string,
  defaultValue: string[] = []
): string[] {
  if (!isRecord(obj)) return defaultValue;
  const value = obj[key];
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  return defaultValue;
}
