/**
 * Safe Parsing Utilities
 * Defensive utility functions for handling potentially null/undefined values
 * to prevent runtime crashes from malformed data.
 */

/**
 * Safely parse a URL string and return a URL object or null.
 * Prevents crashes from malformed or null URL strings.
 */
export function safeUrl(urlString: string | null | undefined): URL | null {
  if (!urlString) return null;
  try {
    return new URL(urlString);
  } catch {
    return null;
  }
}

/**
 * Safely extract the pathname from a URL string.
 * Returns fallback if URL is null, undefined, or malformed.
 */
export function safeGetPathname(
  urlString: string | null | undefined,
  fallback: string = '/'
): string {
  if (!urlString) return fallback;
  try {
    return new URL(urlString).pathname || fallback;
  } catch {
    // For malformed URLs, try to extract a readable portion
    return urlString.length > 50 ? urlString.slice(0, 50) + '...' : urlString;
  }
}

/**
 * Safely access an array element at a given index.
 * Returns undefined if the array is null/undefined or index is out of bounds.
 */
export function safeArrayAccess<T>(
  arr: T[] | null | undefined,
  index: number
): T | undefined {
  if (!arr || index < 0 || index >= arr.length) return undefined;
  return arr[index];
}

/**
 * Safely get the first element of an array.
 * Returns undefined if array is empty or null/undefined.
 */
export function safeFirst<T>(arr: T[] | null | undefined): T | undefined {
  return safeArrayAccess(arr, 0);
}

/**
 * Safely get the last element of an array.
 * Returns undefined if array is empty or null/undefined.
 */
export function safeLast<T>(arr: T[] | null | undefined): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[arr.length - 1];
}

/**
 * Safely format a date string to locale string.
 * Returns fallback if date is null, undefined, or invalid.
 */
export function safeFormatDate(
  dateStr: string | number | null | undefined,
  fallback: string = '-'
): string {
  if (dateStr === null || dateStr === undefined) return fallback;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

/**
 * Safely format a date to locale time string.
 * Returns fallback if date is null, undefined, or invalid.
 */
export function safeFormatTime(
  dateStr: string | number | null | undefined,
  fallback: string = '-'
): string {
  if (dateStr === null || dateStr === undefined) return fallback;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? fallback : date.toLocaleTimeString();
}

/**
 * Safely format a date to ISO string.
 * Returns fallback if date is null, undefined, or invalid.
 */
export function safeFormatIso(
  dateStr: string | number | null | undefined,
  fallback: string = ''
): string {
  if (dateStr === null || dateStr === undefined) return fallback;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? fallback : date.toISOString();
}

/**
 * Type guard to check if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a non-empty array.
 */
export function isNonEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safely coerce a value to number, returning fallback if invalid.
 */
export function safeNumber(
  value: unknown,
  fallback: number = 0
): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}
