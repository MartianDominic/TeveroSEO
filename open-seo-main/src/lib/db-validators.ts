/**
 * Database result validators using Zod.
 *
 * Provides type-safe validation of database query results,
 * replacing unsafe `as any` casts with runtime validation.
 */

import { z } from "zod";

/**
 * Custom error for database validation failures.
 * Contains the Zod error for detailed debugging.
 */
export class DatabaseValidationError extends Error {
  readonly statusCode = 500;

  constructor(
    public readonly context: string,
    public readonly zodError: z.ZodError
  ) {
    super(`Database validation failed: ${context}`);
    this.name = "DatabaseValidationError";
    Object.setPrototypeOf(this, DatabaseValidationError.prototype);
  }

  /**
   * Get formatted error messages for logging.
   */
  getFormattedErrors(): string[] {
    return this.zodError.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    );
  }
}

/**
 * Validate and transform a database row.
 * Throws DatabaseValidationError on failure.
 *
 * @example
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   email: z.string().email(),
 *   createdAt: z.coerce.date(),
 * });
 *
 * const user = validateRow(UserSchema, row, 'User');
 */
export function validateRow<T extends z.ZodType>(
  schema: T,
  row: unknown,
  context: string
): z.infer<T> {
  const result = schema.safeParse(row);

  if (!result.success) {
    console.error(
      `DB row validation failed (${context}):`,
      result.error.issues
    );
    throw new DatabaseValidationError(context, result.error);
  }

  return result.data;
}

/**
 * Validate an array of database rows.
 * Throws DatabaseValidationError on first failure.
 *
 * @example
 * const users = validateRows(UserSchema, rows, 'Users');
 */
export function validateRows<T extends z.ZodType>(
  schema: T,
  rows: unknown[],
  context: string
): z.infer<T>[] {
  return rows.map((row, i) => validateRow(schema, row, `${context}[${i}]`));
}

/**
 * Validate a row, returning null on failure instead of throwing.
 * Useful for graceful degradation.
 *
 * @example
 * const user = validateRowOrNull(UserSchema, row, 'User');
 * if (!user) {
 *   logger.warn('Invalid user row, skipping');
 * }
 */
export function validateRowOrNull<T extends z.ZodType>(
  schema: T,
  row: unknown,
  context: string
): z.infer<T> | null {
  const result = schema.safeParse(row);

  if (!result.success) {
    console.warn(
      `DB row validation failed (${context}), returning null:`,
      result.error.issues
    );
    return null;
  }

  return result.data;
}

/**
 * Validate rows, filtering out invalid ones instead of throwing.
 *
 * @example
 * const validUsers = validateRowsFiltered(UserSchema, rows, 'Users');
 * // Invalid rows are logged and skipped
 */
export function validateRowsFiltered<T extends z.ZodType>(
  schema: T,
  rows: unknown[],
  context: string
): z.infer<T>[] {
  const results: z.infer<T>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const validated = validateRowOrNull(schema, rows[i], `${context}[${i}]`);
    if (validated !== null) {
      results.push(validated);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Common Database Field Schemas
// ---------------------------------------------------------------------------

/**
 * UUID string schema.
 * Note: Uses z.uuid() instead of deprecated z.string().uuid() in Zod 4.x
 */
export const IdSchema = z.uuid();

/**
 * Timestamp schema with date coercion.
 * Handles ISO strings, Date objects, and timestamps.
 */
export const TimestampSchema = z.coerce.date();

/**
 * Nullable timestamp schema.
 */
export const NullableTimestampSchema = z.coerce.date().nullable();

/**
 * Nullable string schema.
 */
export const NullableStringSchema = z.string().nullable();

/**
 * Positive integer schema.
 */
export const PositiveIntSchema = z.number().int().positive();

/**
 * Non-negative integer schema (includes 0).
 */
export const NonNegativeIntSchema = z.number().int().nonnegative();

/**
 * Percentage schema (0-100).
 */
export const PercentageSchema = z.number().min(0).max(100);

/**
 * URL schema.
 * Note: Uses z.url() instead of deprecated z.string().url() in Zod 4.x
 */
export const UrlSchema = z.url();

/**
 * Domain schema (without protocol).
 */
export const DomainSchema = z
  .string()
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
    "Invalid domain format"
  );

/**
 * Email schema.
 * Note: Uses z.email() instead of deprecated z.string().email() in Zod 4.x
 */
export const EmailSchema = z.email();

// ---------------------------------------------------------------------------
// Trigger Config Schemas (for TriggerService)
// ---------------------------------------------------------------------------

/**
 * Schema for traffic drop trigger configuration.
 */
export const TrafficDropConfigSchema = z.object({
  threshold: z.number().min(0).max(100).optional().default(20),
  comparisonPeriod: z.enum(["7d", "14d", "30d"]).optional().default("7d"),
  minimumBaseline: z.number().int().positive().optional().default(100),
  cooldownHours: z.number().int().positive().optional().default(24),
});

export type TrafficDropConfig = z.infer<typeof TrafficDropConfigSchema>;

/**
 * Schema for ranking drop trigger configuration.
 */
export const RankingDropConfigSchema = z.object({
  positionDrop: z.number().int().positive().optional().default(5),
  keywords: z.union([z.literal("all_tracked"), z.array(z.string())]).optional(),
  minimumKeywords: z.number().int().positive().optional().default(3),
  comparisonPeriod: z.enum(["7d", "14d", "30d"]).optional().default("7d"),
  cooldownHours: z.number().int().positive().optional().default(24),
});

export type RankingDropConfig = z.infer<typeof RankingDropConfigSchema>;

/**
 * Schema for rollback scope configuration.
 */
export const RollbackScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("single"), changeId: z.string() }),
  z.object({ type: z.literal("resource"), resourceId: z.string() }),
  z.object({ type: z.literal("category"), category: z.string() }),
  z.object({ type: z.literal("batch"), batchId: z.string() }),
  z.object({
    type: z.literal("date_range"),
    from: z.coerce.date(),
    to: z.coerce.date(),
  }),
  z.object({ type: z.literal("audit"), auditId: z.string() }),
  z.object({ type: z.literal("full") }),
]);

export type RollbackScopeConfig = z.infer<typeof RollbackScopeSchema>;

// ---------------------------------------------------------------------------
// Helper to create row schemas
// ---------------------------------------------------------------------------

/**
 * Create a schema for a database table row.
 * Convenience wrapper around z.object.
 *
 * @example
 * const UserRowSchema = createRowSchema({
 *   id: IdSchema,
 *   email: EmailSchema,
 *   name: NullableStringSchema,
 *   createdAt: TimestampSchema,
 * });
 */
export function createRowSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape);
}

/**
 * Parse JSONB config field safely.
 * Returns default config on parse failure.
 *
 * @example
 * const config = parseJsonbConfig(
 *   row.config,
 *   TrafficDropConfigSchema,
 *   { threshold: 20 }
 * );
 */
export function parseJsonbConfig<T extends z.ZodType>(
  value: unknown,
  schema: T,
  defaultValue: z.infer<T>
): z.infer<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  console.warn("JSONB config parse failed, using default:", result.error.issues);
  return defaultValue;
}
