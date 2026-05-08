/**
 * Date Utilities for Analytics
 * Consolidates common date operations used across Phase 96 services.
 */
import { format, subDays, startOfDay, endOfDay } from "date-fns";

/**
 * Format a date as YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Get GSC date range accounting for data latency (3 days)
 *
 * @param mode - "incremental" for yesterday only, "backfill" for custom days, "full" for 16 months
 * @param customDays - Number of days for backfill mode (default 30)
 * @returns Start and end date strings in YYYY-MM-DD format
 */
export function getGSCDateRange(
  mode: "incremental" | "backfill" | "full" = "incremental",
  customDays?: number
): { startDate: string; endDate: string } {
  const latencyDays = 3; // GSC has 3-day data latency
  const endDate = subDays(new Date(), latencyDays);

  let startDate: Date;
  switch (mode) {
    case "incremental":
      startDate = subDays(endDate, 1); // Yesterday only
      break;
    case "backfill":
      startDate = subDays(endDate, customDays ?? 30);
      break;
    case "full":
      startDate = subDays(endDate, 16 * 30); // ~16 months (GSC limit)
      break;
  }

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

/**
 * Get comparison period for analytics
 *
 * @param period - "WoW" (week), "MoM" (month), or "YoY" (year)
 * @param endDate - The reference end date
 * @returns Start and end date strings for the comparison period
 */
export function getComparisonPeriod(
  period: "WoW" | "MoM" | "YoY",
  endDate: Date
): { startDate: string; endDate: string } {
  const periodDays = {
    WoW: 7,
    MoM: 30,
    YoY: 365,
  };

  const days = periodDays[period];
  const comparisonEnd = subDays(endDate, days);
  const comparisonStart = subDays(comparisonEnd, days);

  return {
    startDate: formatDate(comparisonStart),
    endDate: formatDate(comparisonEnd),
  };
}

/**
 * Get default analytics date range (last 30 days, accounting for GSC latency)
 */
export function getDefaultAnalyticsRange(): { startDate: string; endDate: string } {
  const endDate = subDays(new Date(), 3); // GSC latency
  const startDate = subDays(endDate, 30);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

/**
 * Parse and validate date string
 *
 * @param dateStr - Date string to parse
 * @returns Parsed Date object or null if invalid
 */
export function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get start and end of day for a date
 *
 * @param date - The date to get bounds for
 * @returns Start and end of day timestamps
 */
export function getDayBounds(date: Date): { start: Date; end: Date } {
  return {
    start: startOfDay(date),
    end: endOfDay(date),
  };
}
