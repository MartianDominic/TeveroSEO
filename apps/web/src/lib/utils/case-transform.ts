/**
 * Case Transformation Utilities
 *
 * Provides automatic conversion between snake_case (Python/AI-Writer)
 * and camelCase (TypeScript/JavaScript) at API boundaries.
 *
 * FIX CRIT-API-02: Inconsistent client_id vs clientId naming
 *
 * Usage:
 * ```ts
 * // When receiving data from AI-Writer (Python)
 * const response = await fetch("/api/ai-writer/clients");
 * const data = toCamelCase(await response.json());
 * // data.clientId instead of data.client_id
 *
 * // When sending data to AI-Writer
 * const payload = toSnakeCase({ clientId: "123", userName: "John" });
 * // payload: { client_id: "123", user_name: "John" }
 * ```
 */

/**
 * Convert a string from snake_case to camelCase.
 *
 * @example
 * snakeToCamel("client_id") // "clientId"
 * snakeToCamel("created_at") // "createdAt"
 * snakeToCamel("api_key_secret") // "apiKeySecret"
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert a string from camelCase to snake_case.
 *
 * @example
 * camelToSnake("clientId") // "client_id"
 * camelToSnake("createdAt") // "created_at"
 * camelToSnake("apiKeySecret") // "api_key_secret"
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Check if a string is in snake_case format.
 */
export function isSnakeCase(str: string): boolean {
  return /^[a-z]+(_[a-z]+)*$/.test(str);
}

/**
 * Check if a string is in camelCase format.
 */
export function isCamelCase(str: string): boolean {
  return /^[a-z]+([A-Z][a-z]*)*$/.test(str);
}

/**
 * Type helper for converting snake_case keys to camelCase.
 */
type SnakeToCamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamelCase<U>>}`
  : S;

/**
 * Type helper for converting object keys from snake_case to camelCase.
 */
type KeysToCamelCase<T> = {
  [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: T[K] extends object
    ? T[K] extends Array<infer U>
      ? U extends object
        ? Array<KeysToCamelCase<U>>
        : T[K]
      : KeysToCamelCase<T[K]>
    : T[K];
};

/**
 * Type helper for converting camelCase keys to snake_case.
 */
type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Capitalize<T>
    ? `_${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${T}${CamelToSnakeCase<U>}`
  : S;

/**
 * Type helper for converting object keys from camelCase to snake_case.
 */
type KeysToSnakeCase<T> = {
  [K in keyof T as K extends string ? CamelToSnakeCase<K> : K]: T[K] extends object
    ? T[K] extends Array<infer U>
      ? U extends object
        ? Array<KeysToSnakeCase<U>>
        : T[K]
      : KeysToSnakeCase<T[K]>
    : T[K];
};

/**
 * Recursively convert all object keys from snake_case to camelCase.
 * Handles nested objects and arrays.
 *
 * @example
 * toCamelCase({ client_id: "123", user_data: { first_name: "John" } })
 * // { clientId: "123", userData: { firstName: "John" } }
 */
export function toCamelCase<T extends Record<string, unknown>>(
  obj: T
): KeysToCamelCase<T>;
export function toCamelCase<T>(obj: T): T;
export function toCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item));
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = toCamelCase(value);
    }

    return result;
  }

  return obj;
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 * Handles nested objects and arrays.
 *
 * @example
 * toSnakeCase({ clientId: "123", userData: { firstName: "John" } })
 * // { client_id: "123", user_data: { first_name: "John" } }
 */
export function toSnakeCase<T extends Record<string, unknown>>(
  obj: T
): KeysToSnakeCase<T>;
export function toSnakeCase<T>(obj: T): T;
export function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item));
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = toSnakeCase(value);
    }

    return result;
  }

  return obj;
}

/**
 * Fields that should NOT be transformed (e.g., HTTP headers, external API fields).
 */
const SKIP_TRANSFORM_KEYS = new Set([
  "Content-Type",
  "Authorization",
  "X-Correlation-Id",
  "X-Request-Id",
  "X-User-Id",
  "Cache-Control",
  "Accept",
  "Accept-Language",
  "If-None-Match",
  "ETag",
]);

/**
 * Selectively convert object keys, skipping certain keys.
 * Useful for request/response objects that mix different conventions.
 */
export function toCamelCaseSelective<T extends Record<string, unknown>>(
  obj: T,
  skipKeys: Set<string> = SKIP_TRANSFORM_KEYS
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return obj as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = skipKeys.has(key) ? key : snakeToCamel(key);

    if (Array.isArray(value)) {
      result[newKey] = value.map((item) =>
        typeof item === "object" && item !== null
          ? toCamelCaseSelective(item as Record<string, unknown>, skipKeys)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[newKey] = toCamelCaseSelective(
        value as Record<string, unknown>,
        skipKeys
      );
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Selectively convert object keys to snake_case, skipping certain keys.
 */
export function toSnakeCaseSelective<T extends Record<string, unknown>>(
  obj: T,
  skipKeys: Set<string> = SKIP_TRANSFORM_KEYS
): Record<string, unknown> {
  if (obj === null || obj === undefined) {
    return obj as unknown as Record<string, unknown>;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = skipKeys.has(key) ? key : camelToSnake(key);

    if (Array.isArray(value)) {
      result[newKey] = value.map((item) =>
        typeof item === "object" && item !== null
          ? toSnakeCaseSelective(item as Record<string, unknown>, skipKeys)
          : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[newKey] = toSnakeCaseSelective(
        value as Record<string, unknown>,
        skipKeys
      );
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

/**
 * Create a Zod transform that converts response keys from snake_case to camelCase.
 * Use this with .transform() on Zod schemas for automatic conversion.
 *
 * @example
 * const ClientSchema = z.object({
 *   client_id: z.string(),
 *   created_at: z.string(),
 * }).transform(createCamelCaseTransform);
 *
 * // Result type will have camelCase keys: { clientId, createdAt }
 */
export function createCamelCaseTransform<T extends Record<string, unknown>>(
  data: T
): KeysToCamelCase<T> {
  return toCamelCase(data) as KeysToCamelCase<T>;
}

/**
 * Create a Zod transform that converts request keys from camelCase to snake_case.
 */
export function createSnakeCaseTransform<T extends Record<string, unknown>>(
  data: T
): KeysToSnakeCase<T> {
  return toSnakeCase(data) as KeysToSnakeCase<T>;
}
