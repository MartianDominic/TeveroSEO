/**
 * Currency formatting utilities for the web app.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * Uses Intl.NumberFormat for proper locale-aware currency formatting.
 */

/**
 * Format a currency amount for display.
 *
 * @param amountCents - Amount in cents
 * @param currency - ISO 4217 currency code (e.g., "EUR", "USD")
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amountCents: number,
  currency: string,
  options?: { compact?: boolean }
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: options?.compact ? 0 : 2,
    notation: options?.compact ? "compact" : "standard",
  });

  return formatter.format(amountCents / 100);
}

/**
 * Format a number as currency without the currency symbol.
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
 */
export function getCurrencySymbol(currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  // Extract just the symbol from a formatted zero
  const parts = formatter.formatToParts(0);
  const symbolPart = parts.find((p) => p.type === "currency");
  return symbolPart?.value || currency;
}

/**
 * Parse a currency string back to cents.
 * Note: This is a simple implementation; for production use a proper parser.
 *
 * @param value - Currency string (e.g., "$1,234.56")
 * @returns Amount in cents
 */
export function parseCurrency(value: string): number {
  // Remove non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) return 0;

  return Math.round(amount * 100);
}
