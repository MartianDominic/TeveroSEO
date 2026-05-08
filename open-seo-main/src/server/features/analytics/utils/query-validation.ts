/**
 * Query Validation Utilities
 * SQL injection prevention for analytics services
 *
 * This module provides reusable validation functions for:
 * - ORDER BY column validation (allowlist-based)
 * - LIKE pattern sanitization (escape special chars)
 * - Limit parameter validation (bounded integers)
 * - Search term sanitization
 *
 * SECURITY: All user-provided values that are used in SQL queries
 * should be validated through these utilities before use.
 */

/**
 * Error thrown when validation fails
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// =============================================================================
// ORDER BY Column Validation
// =============================================================================

/**
 * Common order columns for trend analysis
 */
export const ALLOWED_TREND_ORDER_COLUMNS = [
  'date',
  'clicks',
  'impressions',
  'ctr',
  'position',
  'keyword',
  'page_url',
  'query',
] as const;

export type TrendOrderColumn = typeof ALLOWED_TREND_ORDER_COLUMNS[number];

/**
 * Common order columns for analytics queries
 */
export const ALLOWED_ANALYTICS_ORDER_COLUMNS = [
  'clicks',
  'impressions',
  'position',
  'ctr',
  'date',
  'query_time',
  'page_url',
  'query',
  'total_clicks',
  'total_impressions',
  'avg_position',
  'avg_ctr',
  'change_percent',
] as const;

export type AnalyticsOrderColumn = typeof ALLOWED_ANALYTICS_ORDER_COLUMNS[number];

/**
 * Validate an order column against an allowlist.
 * Returns the validated column or the default if input is undefined.
 * Throws ValidationError for invalid columns.
 *
 * @param input - User-provided column name
 * @param allowedColumns - Array of valid column names
 * @param defaultColumn - Default column to use if input is undefined
 * @returns Validated column name
 * @throws ValidationError if column is not in allowlist
 *
 * @example
 * const orderBy = validateOrderColumn(req.query.sort, ALLOWED_TREND_ORDER_COLUMNS, 'date');
 */
export function validateOrderColumn<T extends readonly string[]>(
  input: string | undefined,
  allowedColumns: T,
  defaultColumn: T[number]
): T[number] {
  if (!input) {
    return defaultColumn;
  }

  // Normalize input
  const normalized = input.toLowerCase().trim();

  if (!allowedColumns.includes(normalized as T[number])) {
    throw new ValidationError(
      `Invalid order column: "${input}". Allowed columns: ${allowedColumns.join(', ')}`
    );
  }

  return normalized as T[number];
}

/**
 * Validate order direction.
 * Returns 'asc' or 'desc', defaulting to 'desc'.
 *
 * @param input - User-provided direction
 * @returns Validated direction ('asc' | 'desc')
 */
export function validateOrderDirection(
  input: string | undefined
): 'asc' | 'desc' {
  if (!input) {
    return 'desc';
  }

  const normalized = input.toLowerCase().trim();

  if (normalized === 'asc' || normalized === 'ascending') {
    return 'asc';
  }

  return 'desc';
}

// =============================================================================
// LIKE Pattern Sanitization
// =============================================================================

/**
 * Sanitize a term for use in SQL LIKE patterns.
 * Escapes special LIKE characters: %, _, and backslash.
 *
 * IMPORTANT: This should be used for any user input that will be
 * concatenated into a LIKE pattern.
 *
 * @param term - Raw user input
 * @returns Escaped term safe for LIKE patterns
 *
 * @example
 * const safeTerm = sanitizeLikeTerm(userInput);
 * const pattern = `%${safeTerm}%`;
 * // Use with parameterized query: WHERE column LIKE $1
 */
export function sanitizeLikeTerm(term: string): string {
  if (!term) {
    return '';
  }

  return term
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/%/g, '\\%')    // Escape percent
    .replace(/_/g, '\\_');   // Escape underscore
}

/**
 * Sanitize a search term and wrap with wildcards for substring search.
 * Use this for full-text-like search patterns.
 *
 * @param term - Raw user input
 * @returns Pattern ready for LIKE comparison (e.g., '%term%')
 *
 * @example
 * const pattern = sanitizeSearchPattern(userInput);
 * // Use: WHERE column ILIKE $1
 */
export function sanitizeSearchPattern(term: string): string {
  const sanitized = sanitizeLikeTerm(term);
  return sanitized ? `%${sanitized}%` : '%';
}

/**
 * Sanitize a folder pattern for path matching.
 * Ensures the pattern starts and ends with slashes.
 *
 * @param folder - User-provided folder path
 * @returns Sanitized folder pattern
 */
export function sanitizeFolderPattern(folder: string): string {
  if (!folder) {
    return '/';
  }

  // Sanitize LIKE special characters
  let sanitized = sanitizeLikeTerm(folder);

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Ensure starts with /
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized;
  }

  // Ensure ends with /
  if (!sanitized.endsWith('/')) {
    sanitized = sanitized + '/';
  }

  return sanitized;
}

// =============================================================================
// Limit & Offset Validation
// =============================================================================

/**
 * Default limits for different query types
 */
export const DEFAULT_LIMITS = {
  small: 20,
  medium: 100,
  large: 500,
  max: 10000,
} as const;

/**
 * Validate and bound a limit parameter.
 * Returns a positive integer within the specified bounds.
 *
 * @param input - User-provided limit (number or string)
 * @param max - Maximum allowed limit
 * @param defaultLimit - Default if input is undefined
 * @returns Validated limit
 *
 * @example
 * const limit = validateLimit(req.query.limit, 500, 100);
 */
export function validateLimit(
  input: number | string | undefined,
  max: number = DEFAULT_LIMITS.medium,
  defaultLimit: number = DEFAULT_LIMITS.small
): number {
  if (input === undefined || input === null || input === '') {
    return Math.min(defaultLimit, max);
  }

  const parsed = typeof input === 'string' ? parseInt(input, 10) : input;

  // Handle NaN, Infinity, negative numbers
  if (!Number.isFinite(parsed) || parsed < 1) {
    return Math.min(defaultLimit, max);
  }

  // Clamp to max
  return Math.min(Math.floor(parsed), max);
}

/**
 * Validate an offset parameter.
 * Returns a non-negative integer.
 *
 * @param input - User-provided offset
 * @returns Validated offset (>= 0)
 */
export function validateOffset(
  input: number | string | undefined
): number {
  if (input === undefined || input === null || input === '') {
    return 0;
  }

  const parsed = typeof input === 'string' ? parseInt(input, 10) : input;

  // Handle NaN, Infinity, negative numbers
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

// =============================================================================
// Regex Pattern Validation
// =============================================================================

/**
 * Maximum allowed length for regex patterns (prevent ReDoS)
 */
export const MAX_REGEX_LENGTH = 200;

/**
 * Validate and sanitize a regex pattern.
 * Returns null if pattern is invalid or potentially dangerous.
 *
 * @param pattern - User-provided regex pattern
 * @returns Validated pattern or null
 */
export function validateRegexPattern(pattern: string): string | null {
  // Reject empty patterns
  if (!pattern || pattern.trim().length === 0) {
    return null;
  }

  // Limit pattern length to prevent ReDoS
  if (pattern.length > MAX_REGEX_LENGTH) {
    return null;
  }

  // Test that the pattern is valid regex
  try {
    new RegExp(pattern);
  } catch {
    return null;
  }

  return pattern;
}

// =============================================================================
// Date Validation
// =============================================================================

/**
 * Validate a date string in YYYY-MM-DD format.
 * Returns the validated date string or throws.
 *
 * @param input - User-provided date string
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated date string
 * @throws ValidationError if date is invalid
 */
export function validateDateString(
  input: string | undefined,
  fieldName: string = 'date'
): string {
  if (!input) {
    throw new ValidationError(`${fieldName} is required`);
  }

  // Check format: YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(input)) {
    throw new ValidationError(
      `Invalid ${fieldName} format: "${input}". Expected YYYY-MM-DD`
    );
  }

  // Check that it's a valid date
  const parsed = new Date(input);
  if (isNaN(parsed.getTime())) {
    throw new ValidationError(`Invalid ${fieldName}: "${input}"`);
  }

  return input;
}

/**
 * Validate an optional date string.
 * Returns the validated date string or undefined.
 *
 * @param input - User-provided date string
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated date string or undefined
 */
export function validateOptionalDateString(
  input: string | undefined,
  fieldName: string = 'date'
): string | undefined {
  if (!input) {
    return undefined;
  }

  return validateDateString(input, fieldName);
}

// =============================================================================
// String ID Validation
// =============================================================================

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate a UUID string.
 *
 * @param input - User-provided ID
 * @param fieldName - Name of the field (for error messages)
 * @returns Validated UUID
 * @throws ValidationError if UUID is invalid
 */
export function validateUUID(
  input: string | undefined,
  fieldName: string = 'id'
): string {
  if (!input) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (!UUID_REGEX.test(input)) {
    throw new ValidationError(`Invalid ${fieldName}: not a valid UUID`);
  }

  return input;
}

/**
 * Validate a site ID (could be UUID or GSC site URL).
 * Basic sanitization to prevent injection.
 *
 * @param input - User-provided site ID
 * @returns Validated site ID
 * @throws ValidationError if invalid
 */
export function validateSiteId(input: string | undefined): string {
  if (!input) {
    throw new ValidationError('siteId is required');
  }

  // Remove any SQL-dangerous characters
  const sanitized = input.trim();

  // Check for suspicious patterns
  if (sanitized.includes(';') || sanitized.includes('--') || sanitized.includes('/*')) {
    throw new ValidationError('Invalid siteId: contains forbidden characters');
  }

  // Must be non-empty after trimming
  if (sanitized.length === 0) {
    throw new ValidationError('siteId cannot be empty');
  }

  // Max length check
  if (sanitized.length > 2048) {
    throw new ValidationError('siteId too long');
  }

  return sanitized;
}
