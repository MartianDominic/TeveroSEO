/**
 * Tests for date range validation utility.
 * DUP-004 FIX: Consolidated date range validation tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DateRangeValidator,
  validateDateRange,
  getDefaultDateRange,
  MAX_DATE_RANGE_DAYS,
  GSC_DATA_LATENCY_DAYS,
} from "./date-range-validator";

describe("DateRangeValidator", () => {
  describe("validate", () => {
    it("returns valid for correct date range", () => {
      const result = DateRangeValidator.validate("2024-01-01", "2024-01-31");
      expect(result.valid).toBe(true);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it("returns valid for same start and end date", () => {
      const result = DateRangeValidator.validate("2024-01-15", "2024-01-15");
      expect(result.valid).toBe(true);
    });

    it("returns invalid when start date is after end date", () => {
      const result = DateRangeValidator.validate("2024-01-31", "2024-01-01");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("before");
    });

    it("returns invalid for date range exceeding max days", () => {
      const result = DateRangeValidator.validate("2023-01-01", "2024-12-31");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceed");
    });

    it("accepts custom max days parameter", () => {
      // 30 day range should fail with 7 day max
      const result = DateRangeValidator.validate(
        "2024-01-01",
        "2024-01-31",
        7
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("7 days");
    });

    it("returns invalid for invalid start date", () => {
      const result = DateRangeValidator.validate("invalid", "2024-01-31");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid start date");
    });

    it("returns invalid for invalid end date", () => {
      const result = DateRangeValidator.validate("2024-01-01", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid end date");
    });

    it("accepts Date objects", () => {
      const start = new Date("2024-01-01");
      const end = new Date("2024-01-31");
      const result = DateRangeValidator.validate(start, end);
      expect(result.valid).toBe(true);
    });

    it("returns invalid for future end date", () => {
      // Use a date just a few days in the future to avoid hitting the 365-day limit first
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const result = DateRangeValidator.validate(
        startDate.toISOString().split("T")[0]!,
        futureDate.toISOString().split("T")[0]!
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("future");
    });
  });

  describe("getDefaultRange", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns 30 day range by default", () => {
      const { startDate, endDate } = DateRangeValidator.getDefaultRange();
      expect(endDate.toISOString().split("T")[0]).toBe("2024-06-15");
      expect(startDate.toISOString().split("T")[0]).toBe("2024-05-16");
    });

    it("returns custom day range", () => {
      const { startDate, endDate } = DateRangeValidator.getDefaultRange(7);
      expect(endDate.toISOString().split("T")[0]).toBe("2024-06-15");
      expect(startDate.toISOString().split("T")[0]).toBe("2024-06-08");
    });

    it("accounts for GSC latency when requested", () => {
      const { startDate, endDate } = DateRangeValidator.getDefaultRange(
        30,
        true
      );
      // With 3-day latency, end date should be June 12
      expect(endDate.toISOString().split("T")[0]).toBe("2024-06-12");
      expect(startDate.toISOString().split("T")[0]).toBe("2024-05-13");
    });
  });

  describe("getDefaultRangeStrings", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns formatted date strings", () => {
      const { startDate, endDate } =
        DateRangeValidator.getDefaultRangeStrings();
      expect(startDate).toBe("2024-05-16");
      expect(endDate).toBe("2024-06-15");
    });
  });

  describe("parseQueryParams", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses provided dates when valid", () => {
      const result = DateRangeValidator.parseQueryParams(
        "2024-01-01",
        "2024-01-31"
      );
      expect(result.valid).toBe(true);
      expect(result.startDate?.toISOString().split("T")[0]).toBe("2024-01-01");
    });

    it("returns default range when dates not provided", () => {
      const result = DateRangeValidator.parseQueryParams(null, null, 30);
      expect(result.valid).toBe(true);
      expect(result.endDate?.toISOString().split("T")[0]).toBe("2024-06-15");
    });

    it("returns default range when only one date provided", () => {
      const result = DateRangeValidator.parseQueryParams(
        "2024-01-01",
        null,
        30
      );
      expect(result.valid).toBe(true);
      // Should use defaults since endDate is null
    });
  });

  describe("getComparisonPeriod", () => {
    it("returns correct WoW comparison period", () => {
      const reference = new Date("2024-06-15");
      const { startDate, endDate } = DateRangeValidator.getComparisonPeriod(
        "WoW",
        reference
      );
      // 7 days before reference = June 8
      // 7 days before that = June 1
      expect(endDate.toISOString().split("T")[0]).toBe("2024-06-08");
      expect(startDate.toISOString().split("T")[0]).toBe("2024-06-01");
    });

    it("returns correct MoM comparison period", () => {
      const reference = new Date("2024-06-15");
      const { startDate, endDate } = DateRangeValidator.getComparisonPeriod(
        "MoM",
        reference
      );
      // 30 days before reference = May 16
      // 30 days before that = April 16
      expect(endDate.toISOString().split("T")[0]).toBe("2024-05-16");
      expect(startDate.toISOString().split("T")[0]).toBe("2024-04-16");
    });

    it("returns correct YoY comparison period", () => {
      const reference = new Date("2024-06-15");
      const { startDate, endDate } = DateRangeValidator.getComparisonPeriod(
        "YoY",
        reference
      );
      // 365 days before reference = June 16 2023 (2024 is a leap year)
      // The comparison period ends 365 days before reference
      expect(endDate.toISOString().split("T")[0]).toBe("2023-06-16");
      // And starts another 365 days before that
      expect(startDate.toISOString().split("T")[0]).toBe("2022-06-16");
    });
  });
});

describe("convenience functions", () => {
  it("validateDateRange works as alias", () => {
    const result = validateDateRange("2024-01-01", "2024-01-31");
    expect(result.valid).toBe(true);
  });

  it("getDefaultDateRange works as alias", () => {
    const { startDate, endDate } = getDefaultDateRange(7);
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);
  });
});

describe("constants", () => {
  it("exports MAX_DATE_RANGE_DAYS", () => {
    expect(MAX_DATE_RANGE_DAYS).toBe(365);
  });

  it("exports GSC_DATA_LATENCY_DAYS", () => {
    expect(GSC_DATA_LATENCY_DAYS).toBe(3);
  });
});
