/**
 * Date Range Validation Utility
 *
 * DUP-004 FIX: Consolidates date range validation logic duplicated in 5+ files.
 *
 * Previously duplicated in:
 * - routes/api/analytics/branded-split.ts
 * - routes/api/analytics/master.ts
 * - routes/api/analytics/cannibalization.ts
 * - routes/api/analytics/portfolio.ts
 * - routes/api/analytics/export.ts
 *
 * This is the canonical date range validation for the platform.
 *
 * @module server/lib/date-range-validator
 */

import { z } from "zod";
import { subDays, isAfter, isBefore, differenceInDays, format } from "date-fns";

/**
 * Maximum allowed date range (365 days by default).
 */
export const MAX_DATE_RANGE_DAYS = 365;

/**
 * GSC data latency in days.
 * GSC data typically has a 2-3 day processing delay.
 */
export const GSC_DATA_LATENCY_DAYS = 3;

/**
 * Validation result type.
 */
export interface DateRangeValidationResult {
  valid: boolean;
  error?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Zod schema for date range validation.
 * Accepts ISO strings or Date objects.
 */
export const dateRangeSchema = z
  .object({
    startDate: z.union([
      z.string().datetime({ offset: true }),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
      z.date(),
    ]),
    endDate: z.union([
      z.string().datetime({ offset: true }),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      z.date(),
    ]),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return !isAfter(start, end);
    },
    { message: "Start date must be before or equal to end date" }
  )
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      const diff = differenceInDays(end, start);
      return diff <= MAX_DATE_RANGE_DAYS;
    },
    { message: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` }
  );

/**
 * Date Range Validator class with static methods for common operations.
 */
export class DateRangeValidator {
  /**
   * Validate a date range.
   *
   * @param startDate - Start date (string or Date)
   * @param endDate - End date (string or Date)
   * @param maxDays - Maximum allowed range (default: 365)
   * @returns Validation result
   *
   * @example
   * const result = DateRangeValidator.validate('2024-01-01', '2024-01-31');
   * if (!result.valid) {
   *   return Response.json({ error: result.error }, { status: 400 });
   * }
   */
  static validate(
    startDate: Date | string,
    endDate: Date | string,
    maxDays: number = MAX_DATE_RANGE_DAYS
  ): DateRangeValidationResult {
    const start = typeof startDate === "string" ? new Date(startDate) : startDate;
    const end = typeof endDate === "string" ? new Date(endDate) : endDate;

    // Check for invalid dates
    if (isNaN(start.getTime())) {
      return { valid: false, error: "Invalid start date" };
    }
    if (isNaN(end.getTime())) {
      return { valid: false, error: "Invalid end date" };
    }

    // Check order
    if (isAfter(start, end)) {
      return { valid: false, error: "Start date must be before or equal to end date" };
    }

    // Check range
    const diff = differenceInDays(end, start);
    if (diff > maxDays) {
      return { valid: false, error: `Date range cannot exceed ${maxDays} days` };
    }

    // Check future dates
    const now = new Date();
    if (isAfter(end, now)) {
      return { valid: false, error: "End date cannot be in the future" };
    }

    return { valid: true, startDate: start, endDate: end };
  }

  /**
   * Validate with Zod schema (for use with request parsing).
   *
   * @param data - Object with startDate and endDate
   * @returns Zod parse result
   */
  static validateWithZod(data: unknown) {
    return dateRangeSchema.safeParse(data);
  }

  /**
   * Get a default date range (last N days).
   *
   * @param days - Number of days back from today (default: 30)
   * @param accountForLatency - Whether to account for GSC data latency
   * @returns Start and end Date objects
   *
   * @example
   * // Get last 30 days
   * const { startDate, endDate } = DateRangeValidator.getDefaultRange();
   *
   * // Get last 7 days with GSC latency adjustment
   * const range = DateRangeValidator.getDefaultRange(7, true);
   */
  static getDefaultRange(
    days: number = 30,
    accountForLatency: boolean = false
  ): { startDate: Date; endDate: Date } {
    const latency = accountForLatency ? GSC_DATA_LATENCY_DAYS : 0;
    const endDate = subDays(new Date(), latency);
    const startDate = subDays(endDate, days);
    return { startDate, endDate };
  }

  /**
   * Get default date range as formatted strings (YYYY-MM-DD).
   *
   * @param days - Number of days back from today
   * @param accountForLatency - Whether to account for GSC data latency
   * @returns Start and end date strings
   */
  static getDefaultRangeStrings(
    days: number = 30,
    accountForLatency: boolean = false
  ): { startDate: string; endDate: string } {
    const { startDate, endDate } = this.getDefaultRange(days, accountForLatency);
    return {
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    };
  }

  /**
   * Parse and validate date strings from query parameters.
   *
   * @param startDateStr - Start date string (optional)
   * @param endDateStr - End date string (optional)
   * @param defaultDays - Default range if dates not provided
   * @param accountForLatency - Whether to account for GSC data latency
   * @returns Validation result with parsed dates
   *
   * @example
   * const result = DateRangeValidator.parseQueryParams(
   *   searchParams.get('startDate'),
   *   searchParams.get('endDate'),
   *   30,
   *   true
   * );
   */
  static parseQueryParams(
    startDateStr: string | null | undefined,
    endDateStr: string | null | undefined,
    defaultDays: number = 30,
    accountForLatency: boolean = false
  ): DateRangeValidationResult {
    // Use defaults if not provided
    if (!startDateStr || !endDateStr) {
      const { startDate, endDate } = this.getDefaultRange(defaultDays, accountForLatency);
      return { valid: true, startDate, endDate };
    }

    return this.validate(startDateStr, endDateStr);
  }

  /**
   * Get comparison period for analytics.
   *
   * @param period - "WoW" (week), "MoM" (month), or "YoY" (year)
   * @param referenceDate - The reference end date
   * @returns Start and end dates for the comparison period
   */
  static getComparisonPeriod(
    period: "WoW" | "MoM" | "YoY",
    referenceDate: Date = new Date()
  ): { startDate: Date; endDate: Date } {
    const periodDays = {
      WoW: 7,
      MoM: 30,
      YoY: 365,
    };

    const days = periodDays[period];
    const endDate = subDays(referenceDate, days);
    const startDate = subDays(endDate, days);

    return { startDate, endDate };
  }
}

/**
 * Convenience function for quick validation.
 */
export function validateDateRange(
  startDate: Date | string,
  endDate: Date | string,
  maxDays?: number
): DateRangeValidationResult {
  return DateRangeValidator.validate(startDate, endDate, maxDays);
}

/**
 * Convenience function for getting default range.
 */
export function getDefaultDateRange(
  days?: number,
  accountForLatency?: boolean
): { startDate: Date; endDate: Date } {
  return DateRangeValidator.getDefaultRange(days, accountForLatency);
}
