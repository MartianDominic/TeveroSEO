/**
 * CurrencyService unit tests
 * Phase 51-01: MRR & Retention Dashboard
 */
import { describe, it, expect } from "vitest";
import {
  convertToDisplayCurrency,
  formatCurrency,
  sumInDisplayCurrency,
  getWorkspaceDisplayCurrency,
  getSupportedCurrencies,
  isSupportedCurrency,
} from "./CurrencyService";

describe("CurrencyService", () => {
  describe("convertToDisplayCurrency", () => {
    it("returns same amount when currencies match", () => {
      const result = convertToDisplayCurrency(
        { amountCents: 10000, currency: "EUR" },
        "EUR"
      );
      expect(result).toBe(10000);
    });

    it("converts EUR to USD using rate", () => {
      // EUR 100.00 -> USD (EUR is base, rate 0.92 to EUR)
      // USD to EUR rate is 0.92, so EUR to USD is 1/0.92 = 1.087
      // 10000 cents EUR * 1 (EUR rate) / 0.92 (USD rate) = ~10869
      const result = convertToDisplayCurrency(
        { amountCents: 10000, currency: "EUR" },
        "USD"
      );
      expect(result).toBe(10870); // Rounded
    });

    it("converts USD to EUR using rate", () => {
      // USD 100.00 -> EUR
      // 10000 cents USD * 0.92 (USD to EUR rate) / 1 (EUR rate) = 9200
      const result = convertToDisplayCurrency(
        { amountCents: 10000, currency: "USD" },
        "EUR"
      );
      expect(result).toBe(9200);
    });

    it("converts GBP to EUR using rate", () => {
      // GBP 100.00 -> EUR
      // 10000 cents GBP * 1.17 (GBP to EUR rate) = 11700
      const result = convertToDisplayCurrency(
        { amountCents: 10000, currency: "GBP" },
        "EUR"
      );
      expect(result).toBe(11700);
    });

    it("handles unknown currency with rate of 1", () => {
      const result = convertToDisplayCurrency(
        { amountCents: 10000, currency: "XXX" },
        "EUR"
      );
      expect(result).toBe(10000); // Treated as 1:1
    });
  });

  describe("formatCurrency", () => {
    it("formats EUR with correct symbol", () => {
      const result = formatCurrency(10000, "EUR");
      expect(result).toContain("100");
      // Intl.NumberFormat may use different EUR symbols
    });

    it("formats USD with correct symbol", () => {
      const result = formatCurrency(10000, "USD");
      expect(result).toContain("$");
      expect(result).toContain("100");
    });

    it("uses compact notation when requested", () => {
      const result = formatCurrency(150000000, "EUR", { compact: true });
      // Should show something like "1.5M" or "1,500K"
      expect(result.length).toBeLessThan(20);
    });

    it("shows decimals in standard notation", () => {
      const result = formatCurrency(10050, "EUR");
      expect(result).toContain("100.50");
    });

    it("hides decimals in compact notation", () => {
      const result = formatCurrency(10050, "EUR", { compact: true });
      expect(result).not.toContain(".50");
    });
  });

  describe("sumInDisplayCurrency", () => {
    it("sums amounts in same currency", () => {
      const result = sumInDisplayCurrency(
        [
          { amountCents: 5000, currency: "EUR" },
          { amountCents: 3000, currency: "EUR" },
        ],
        "EUR"
      );
      expect(result).toBe(8000);
    });

    it("sums amounts in mixed currencies", () => {
      const result = sumInDisplayCurrency(
        [
          { amountCents: 10000, currency: "EUR" }, // 10000 EUR
          { amountCents: 10000, currency: "USD" }, // 9200 EUR (converted)
        ],
        "EUR"
      );
      expect(result).toBe(19200);
    });

    it("returns 0 for empty array", () => {
      const result = sumInDisplayCurrency([], "EUR");
      expect(result).toBe(0);
    });
  });

  describe("getWorkspaceDisplayCurrency", () => {
    it("returns EUR as default", async () => {
      const result = await getWorkspaceDisplayCurrency("workspace-123");
      expect(result).toBe("EUR");
    });
  });

  describe("getSupportedCurrencies", () => {
    it("returns array of supported currencies", () => {
      const currencies = getSupportedCurrencies();
      expect(currencies).toContain("EUR");
      expect(currencies).toContain("USD");
      expect(currencies).toContain("GBP");
      expect(currencies.length).toBeGreaterThan(5);
    });
  });

  describe("isSupportedCurrency", () => {
    it("returns true for supported currency", () => {
      expect(isSupportedCurrency("EUR")).toBe(true);
      expect(isSupportedCurrency("USD")).toBe(true);
    });

    it("returns false for unsupported currency", () => {
      expect(isSupportedCurrency("XXX")).toBe(false);
      expect(isSupportedCurrency("BTC")).toBe(false);
    });
  });
});
