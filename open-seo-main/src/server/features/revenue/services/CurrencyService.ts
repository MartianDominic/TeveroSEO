/**
 * Currency conversion and formatting for revenue display.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-13: Store amounts in original currency, convert for display only.
 * Note: Uses static rates for MVP. Consider live rates API for production.
 */

/**
 * Static exchange rates to EUR (base currency).
 * In production, fetch from API and cache with TTL.
 */
const EXCHANGE_RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  PLN: 0.23,
  LTL: 0.29, // Lithuanian Litas (historical)
  SEK: 0.088,
  NOK: 0.085,
  DKK: 0.134,
  CHF: 1.04,
  CZK: 0.04,
};

/**
 * Currency amount with original currency tracking.
 */
export interface CurrencyAmount {
  amountCents: number;
  currency: string;
}

/**
 * Convert amount from original currency to display currency.
 * Uses EUR as intermediate base currency for conversions.
 *
 * @param amount - Original amount with currency
 * @param displayCurrency - Target currency for display
 * @returns Amount in display currency (in cents)
 */
export function convertToDisplayCurrency(
  amount: CurrencyAmount,
  displayCurrency: string
): number {
  if (amount.currency === displayCurrency) {
    return amount.amountCents;
  }

  // Convert to EUR first (base), then to display currency
  const toEurRate = EXCHANGE_RATES_TO_EUR[amount.currency] || 1;
  const fromEurRate = EXCHANGE_RATES_TO_EUR[displayCurrency] || 1;

  const inEur = amount.amountCents * toEurRate;
  const inDisplay = inEur / fromEurRate;

  return Math.round(inDisplay);
}

/**
 * Format currency amount for display using Intl.NumberFormat.
 *
 * @param amountCents - Amount in cents
 * @param currency - ISO currency code
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
 * Sum multiple currency amounts into a single display currency.
 *
 * @param amounts - Array of currency amounts
 * @param displayCurrency - Target currency for sum
 * @returns Total in display currency (in cents)
 */
export function sumInDisplayCurrency(
  amounts: CurrencyAmount[],
  displayCurrency: string
): number {
  return amounts.reduce(
    (sum, amount) => sum + convertToDisplayCurrency(amount, displayCurrency),
    0
  );
}

/**
 * Get workspace display currency preference.
 * TODO: Fetch from workspace settings table.
 *
 * @param workspaceId - Workspace ID
 * @returns Display currency code
 */
export async function getWorkspaceDisplayCurrency(
  workspaceId: string
): Promise<string> {
  // TODO: Fetch from workspace settings
  // For MVP, default to EUR
  return "EUR";
}

/**
 * Get list of supported currencies.
 */
export function getSupportedCurrencies(): string[] {
  return Object.keys(EXCHANGE_RATES_TO_EUR);
}

/**
 * Check if a currency is supported for conversion.
 */
export function isSupportedCurrency(currency: string): boolean {
  return currency in EXCHANGE_RATES_TO_EUR;
}

/**
 * CurrencyService aggregated export.
 */
export const CurrencyService = {
  convertToDisplayCurrency,
  formatCurrency,
  sumInDisplayCurrency,
  getWorkspaceDisplayCurrency,
  getSupportedCurrencies,
  isSupportedCurrency,
};
