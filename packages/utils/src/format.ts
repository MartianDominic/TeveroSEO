/**
 * Formatting utilities for numbers and currency.
 *
 * @module @tevero/utils/format
 *
 * Provides consistent formatting functions used across the platform.
 * Uses Intl.NumberFormat for proper locale-aware formatting.
 */

/**
 * Format a number with locale-aware thousand separators.
 *
 * @param value - The number to format (null/undefined returns "-")
 * @param locale - Optional locale (default: user's locale via Intl)
 * @returns Formatted number string or "-" for null/undefined
 *
 * @example
 * ```typescript
 * formatNumber(1234567)    // "1,234,567" (in en-US)
 * formatNumber(null)       // "-"
 * formatNumber(undefined)  // "-"
 * ```
 */
export function formatNumber(
  value: number | null | undefined,
  locale?: string
): string {
  if (value == null) return "-";
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format a number with compact notation (K, M, B).
 *
 * @param value - The number to format
 * @param locale - Optional locale (default: "en-US")
 * @returns Compact formatted string or "-" for null/undefined
 *
 * @example
 * ```typescript
 * formatCompactNumber(1234)      // "1.2K"
 * formatCompactNumber(1234567)   // "1.2M"
 * formatCompactNumber(null)      // "-"
 * ```
 */
export function formatCompactNumber(
  value: number | null | undefined,
  locale = "en-US"
): string {
  if (value == null) return "-";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format a floating point number with appropriate precision.
 *
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string or "-" for null/undefined
 *
 * @example
 * ```typescript
 * formatFloat(1234.5678)     // "1,234.57"
 * formatFloat(100.123, 1)    // "100.1"
 * formatFloat(null)          // "-"
 * ```
 */
export function formatFloat(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null) return "-";
  if (value > 100) {
    return new Intl.NumberFormat().format(Math.round(value));
  }
  return value.toFixed(decimals);
}

/**
 * Format a currency amount for display.
 *
 * @param amountCents - Amount in cents (smallest currency unit)
 * @param currency - ISO 4217 currency code (e.g., "EUR", "USD")
 * @param options - Formatting options
 * @returns Formatted currency string
 *
 * @example
 * ```typescript
 * formatCurrency(123456, "USD")           // "$1,234.56"
 * formatCurrency(123456, "EUR")           // "EUR 1.234,56" (lt-LT locale)
 * formatCurrency(1234567, "USD", { compact: true }) // "$12K"
 * ```
 */
export function formatCurrency(
  amountCents: number,
  currency: string,
  options?: { compact?: boolean; locale?: string }
): string {
  const amount = amountCents / 100;

  // Use currency-specific locale for proper formatting
  if (currency === "EUR") {
    // Lithuanian/European format
    if (options?.compact) {
      return `EUR ${new Intl.NumberFormat("lt-LT", {
        notation: "compact",
        maximumFractionDigits: 0,
      }).format(amount)}`;
    }
    return `EUR ${new Intl.NumberFormat("lt-LT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }

  // USD and other currencies use en-US format
  const locale = options?.locale ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: options?.compact ? 0 : 2,
    notation: options?.compact ? "compact" : "standard",
  }).format(amount);
}

/**
 * Format a currency amount without the currency symbol.
 *
 * @param amountCents - Amount in cents
 * @param currency - Currency code for locale determination
 * @param options - Formatting options
 * @returns Formatted number string
 *
 * @example
 * ```typescript
 * formatCents(420000, "EUR") // "4.200,00"
 * formatCents(420000, "USD") // "4,200.00"
 * ```
 */
export function formatCents(
  amountCents: number,
  currency: string,
  options?: { compact?: boolean }
): string {
  const amount = amountCents / 100;

  if (currency === "EUR") {
    return amount.toLocaleString("lt-LT", {
      minimumFractionDigits: options?.compact ? 0 : 2,
      maximumFractionDigits: options?.compact ? 0 : 2,
    });
  }

  if (currency === "USD") {
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: options?.compact ? 0 : 2,
      maximumFractionDigits: options?.compact ? 0 : 2,
    });
  }

  // Fallback for other currencies
  return options?.compact ? amount.toFixed(0) : amount.toFixed(2);
}

/**
 * Format an amount (no currency context, just the number).
 *
 * @param amountCents - Amount in cents
 * @param options - Formatting options
 * @returns Formatted number string
 */
export function formatAmount(
  amountCents: number,
  options?: { compact?: boolean }
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options?.compact ? 0 : 2,
    notation: options?.compact ? "compact" : "standard",
  });

  return formatter.format(amountCents / 100);
}

/**
 * Get the currency symbol for a currency code.
 *
 * @param currency - ISO 4217 currency code
 * @returns Currency symbol
 *
 * @example
 * ```typescript
 * getCurrencySymbol("USD") // "$"
 * getCurrencySymbol("EUR") // "EUR"
 * getCurrencySymbol("GBP") // "GBP"
 * ```
 */
export function getCurrencySymbol(currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const parts = formatter.formatToParts(0);
  const symbolPart = parts.find((p) => p.type === "currency");
  return symbolPart?.value ?? currency;
}

/**
 * Parse a currency string back to cents.
 * Note: Simple implementation for common formats.
 *
 * @param value - Currency string (e.g., "$1,234.56")
 * @returns Amount in cents
 *
 * @example
 * ```typescript
 * parseCurrency("$1,234.56") // 123456
 * parseCurrency("EUR 1.234,56") // 123456
 * ```
 */
export function parseCurrency(value: string): number {
  // Remove non-numeric characters except decimal point and minus
  const cleaned = value.replace(/[^0-9.,-]/g, "");

  // Handle European format (comma as decimal separator)
  // If there's a comma after the last period, it's likely European format
  const lastComma = cleaned.lastIndexOf(",");
  const lastPeriod = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma > lastPeriod && lastComma === cleaned.length - 3) {
    // European format: 1.234,56
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // US format: 1,234.56
    normalized = cleaned.replace(/,/g, "");
  }

  const amount = parseFloat(normalized);

  if (isNaN(amount)) return 0;

  return Math.round(amount * 100);
}

/**
 * Format a percentage with configurable precision.
 *
 * @param value - The percentage value (e.g., 0.1234 for 12.34%)
 * @param options - Formatting options
 * @returns Formatted percentage string
 *
 * @example
 * ```typescript
 * formatPercent(0.1234)                    // "12.34%"
 * formatPercent(0.1234, { decimals: 0 })   // "12%"
 * formatPercent(null)                      // "-"
 * ```
 */
export function formatPercent(
  value: number | null | undefined,
  options?: { decimals?: number; multiply?: boolean }
): string {
  if (value == null) return "-";

  const decimals = options?.decimals ?? 2;
  // If multiply is true, value is a decimal (0.1234), else it's already percentage (12.34)
  const pct = options?.multiply !== false ? value * 100 : value;

  return `${pct.toFixed(decimals)}%`;
}
