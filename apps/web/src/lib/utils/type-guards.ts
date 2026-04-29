/**
 * Type-safe utilities to replace unsafe casts.
 *
 * This module provides runtime-safe alternatives to:
 * - `as any` casts
 * - Non-null assertions (`!`)
 * - Unsafe array access
 * - Unchecked object property access
 */

/**
 * Assert value is defined (not null/undefined).
 * Throws with context if assertion fails.
 *
 * @example
 * ```ts
 * const id = params.id; // string | undefined
 * assertDefined(id, 'params.id');
 * // id is now narrowed to string
 * ```
 */
export function assertDefined<T>(
  value: T | null | undefined,
  context: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed: ${context} is ${value === null ? 'null' : 'undefined'}`);
  }
}

/**
 * Get value with fallback if undefined.
 * Type-safe alternative to non-null assertion.
 *
 * @example
 * ```ts
 * const name = getOrDefault(user?.name, 'Anonymous');
 * ```
 */
export function getOrDefault<T>(
  value: T | null | undefined,
  defaultValue: T
): T {
  return value ?? defaultValue;
}

/**
 * Safe array access with bounds checking.
 * Returns undefined if index is out of bounds.
 *
 * @example
 * ```ts
 * const first = safeArrayAccess(items, 0, 'items');
 * if (first) {
 *   // use first safely
 * }
 * ```
 */
export function safeArrayAccess<T>(
  array: T[],
  index: number,
  context?: string
): T | undefined {
  if (index < 0 || index >= array.length) {
    if (context && process.env.NODE_ENV === 'development') {
      console.warn(`Array access out of bounds: ${context}[${index}], length=${array.length}`);
    }
    return undefined;
  }
  return array[index];
}

/**
 * Safe array access that throws if index is out of bounds.
 * Use when you expect the index to be valid and want to fail fast.
 *
 * @example
 * ```ts
 * const first = safeArrayAccessOrThrow(items, 0, 'items');
 * // first is guaranteed to be T, not T | undefined
 * ```
 */
export function safeArrayAccessOrThrow<T>(
  array: T[],
  index: number,
  context: string
): T {
  if (index < 0 || index >= array.length) {
    throw new Error(
      `Array access out of bounds: ${context}[${index}], length=${array.length}`
    );
  }
  return array[index];
}

/**
 * Type guard for checking object has property.
 *
 * @example
 * ```ts
 * if (hasProperty(response, 'data')) {
 *   // response.data is accessible
 * }
 * ```
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

/**
 * Type guard for checking object has multiple properties.
 *
 * @example
 * ```ts
 * if (hasProperties(obj, ['id', 'name', 'email'])) {
 *   // obj.id, obj.name, obj.email are all accessible
 * }
 * ```
 */
export function hasProperties<K extends string>(
  obj: unknown,
  keys: K[]
): obj is Record<K, unknown> {
  if (typeof obj !== 'object' || obj === null) return false;
  return keys.every((key) => key in obj);
}

/**
 * Type guard for non-empty string.
 *
 * @example
 * ```ts
 * if (isNonEmptyString(input)) {
 *   // input is string with length > 0
 * }
 * ```
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for valid number (not NaN, finite).
 *
 * @example
 * ```ts
 * if (isValidNumber(value)) {
 *   // value is a valid finite number
 * }
 * ```
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Type guard for non-empty array.
 *
 * @example
 * ```ts
 * if (isNonEmptyArray(items)) {
 *   // items is T[] with at least one element
 *   const first = items[0]; // safe
 * }
 * ```
 */
export function isNonEmptyArray<T>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Result type for safe JSON parsing operations.
 */
export type SafeJsonParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Safe JSON parse with type validation using a type guard.
 * Returns null if parsing fails or validation fails.
 *
 * @example
 * ```ts
 * interface User { id: string; name: string; }
 * const isUser = (data: unknown): data is User =>
 *   hasProperties(data, ['id', 'name']);
 * const user = safeJsonParse<User>(jsonString, isUser);
 * ```
 */
export function safeJsonParse<T>(
  json: string,
  validator: (data: unknown) => data is T
): T | null {
  try {
    const data: unknown = JSON.parse(json);
    if (validator(data)) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Zod-like parse result for failed validation.
 */
export interface ZodLikeParseError {
  success: false;
  error: { message: string };
}

/**
 * Zod-like parse result for successful validation.
 */
export interface ZodLikeParseSuccess<T> {
  success: true;
  data: T;
}

/**
 * Zod schema type for generic schema validation.
 * Mirrors the essential Zod schema interface for type inference.
 */
export interface ZodLikeSchema<T> {
  safeParse(data: unknown): ZodLikeParseSuccess<T> | ZodLikeParseError;
}

/**
 * Safe JSON parse with Zod schema validation.
 * Returns a result object with success status.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * const UserSchema = z.object({ id: z.string(), name: z.string() });
 * const result = safeJsonParseWithSchema(jsonString, UserSchema);
 * if (result.success) {
 *   console.log(result.data); // Typed as { id: string; name: string }
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function safeJsonParseWithSchema<T>(
  json: string,
  schema: ZodLikeSchema<T>,
  context?: string
): SafeJsonParseResult<T> {
  try {
    const data: unknown = JSON.parse(json);
    const parseResult = schema.safeParse(data);
    if (parseResult.success) {
      return { success: true, data: parseResult.data };
    }
    // parseResult is ZodLikeParseError here due to discriminated union narrowing
    const errorMsg = `JSON validation failed${context ? ` for ${context}` : ''}: ${parseResult.error.message}`;
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[safeJsonParseWithSchema] ${errorMsg}`);
    }
    return { success: false, error: errorMsg };
  } catch (e) {
    const errorMsg = `JSON parse failed${context ? ` for ${context}` : ''}: ${e instanceof Error ? e.message : 'Unknown error'}`;
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[safeJsonParseWithSchema] ${errorMsg}`);
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Safe JSON parse with Zod schema that throws on validation failure.
 * Use when you want to fail fast on invalid data.
 *
 * @throws Error if JSON parsing or validation fails
 */
export function safeJsonParseWithSchemaOrThrow<T>(
  json: string,
  schema: ZodLikeSchema<T>,
  context?: string
): T {
  const result = safeJsonParseWithSchema(json, schema, context);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Safe JSON parse that returns unknown without any type assertion.
 * Use this as a safe base for further validation.
 * Returns a result object for explicit error handling.
 */
export function safeJsonParseUnknown(
  json: string,
  context?: string
): SafeJsonParseResult<unknown> {
  try {
    const data: unknown = JSON.parse(json);
    return { success: true, data };
  } catch (e) {
    const errorMsg = `JSON parse failed${context ? ` for ${context}` : ''}: ${e instanceof Error ? e.message : 'Unknown error'}`;
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[safeJsonParseUnknown] ${errorMsg}`);
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Safe JSON parse with fallback value.
 *
 * @example
 * ```ts
 * const config = safeJsonParseWithFallback(jsonString, isConfig, defaultConfig);
 * ```
 */
export function safeJsonParseWithFallback<T>(
  json: string,
  validator: (data: unknown) => data is T,
  fallback: T
): T {
  const result = safeJsonParse(json, validator);
  return result ?? fallback;
}

/**
 * Type-safe object keys.
 * Returns array of keys with proper typing.
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: 2 };
 * const keys = typedKeys(obj); // ('a' | 'b')[]
 * ```
 */
export function typedKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}

/**
 * Type-safe object entries.
 * Returns array of [key, value] tuples with proper typing.
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: 2 };
 * const entries = typedEntries(obj); // ['a' | 'b', number][]
 * ```
 */
export function typedEntries<T extends object>(
  obj: T
): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

/**
 * Type-safe object values.
 * Returns array of values with proper typing.
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: 2 };
 * const values = typedValues(obj); // number[]
 * ```
 */
export function typedValues<T extends object>(obj: T): T[keyof T][] {
  return Object.values(obj) as T[keyof T][];
}

/**
 * Narrow unknown to Record for safe property access.
 * Returns null if not a valid object.
 *
 * @example
 * ```ts
 * const record = asRecord(unknownValue);
 * if (record && 'id' in record) {
 *   // record.id is accessible
 * }
 * ```
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/**
 * Exhaustive check for discriminated unions.
 * Use in switch statements to ensure all cases are handled.
 *
 * @example
 * ```ts
 * type Status = 'pending' | 'active' | 'done';
 * function handle(status: Status) {
 *   switch (status) {
 *     case 'pending': return 1;
 *     case 'active': return 2;
 *     case 'done': return 3;
 *     default: return exhaustiveCheck(status);
 *   }
 * }
 * ```
 */
export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled discriminated union member: ${JSON.stringify(value)}`);
}
