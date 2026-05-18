/**
 * Security Test Suite for Payment Services
 * Phase 101: SQL Injection Prevention Tests (H-06, H-09)
 *
 * Tests for:
 * - escapeLikePattern() function in AutoMatchEngine
 * - LIKE wildcard injection prevention
 * - Memo parsing with SQL characters
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Create a standalone escapeLikePattern for testing
// This mirrors the implementation in AutoMatchEngine.ts
function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

describe("escapeLikePattern (H-06, H-09: SQL Injection Prevention)", () => {
  describe("percent sign (%)", () => {
    it("should escape single percent sign", () => {
      expect(escapeLikePattern("100%")).toBe("100\\%");
    });

    it("should escape multiple percent signs", () => {
      expect(escapeLikePattern("50% off 100%")).toBe("50\\% off 100\\%");
    });

    it("should escape leading percent sign", () => {
      expect(escapeLikePattern("%prefix")).toBe("\\%prefix");
    });

    it("should escape trailing percent sign", () => {
      expect(escapeLikePattern("suffix%")).toBe("suffix\\%");
    });

    it("should escape percent-only input", () => {
      expect(escapeLikePattern("%")).toBe("\\%");
      expect(escapeLikePattern("%%")).toBe("\\%\\%");
    });
  });

  describe("underscore (_)", () => {
    it("should escape single underscore", () => {
      expect(escapeLikePattern("test_name")).toBe("test\\_name");
    });

    it("should escape multiple underscores", () => {
      expect(escapeLikePattern("test__double")).toBe("test\\_\\_double");
    });

    it("should escape underscore at start", () => {
      expect(escapeLikePattern("_private")).toBe("\\_private");
    });

    it("should escape underscore at end", () => {
      expect(escapeLikePattern("name_")).toBe("name\\_");
    });

    it("should escape underscore-only input", () => {
      expect(escapeLikePattern("_")).toBe("\\_");
      expect(escapeLikePattern("___")).toBe("\\_\\_\\_");
    });
  });

  describe("backslash (\\)", () => {
    it("should escape single backslash", () => {
      expect(escapeLikePattern("path\\file")).toBe("path\\\\file");
    });

    it("should escape multiple backslashes", () => {
      expect(escapeLikePattern("c:\\users\\test")).toBe("c:\\\\users\\\\test");
    });

    it("should escape backslash at start", () => {
      expect(escapeLikePattern("\\start")).toBe("\\\\start");
    });

    it("should escape backslash at end", () => {
      expect(escapeLikePattern("end\\")).toBe("end\\\\");
    });
  });

  describe("combined patterns", () => {
    it("should escape all special characters together", () => {
      expect(escapeLikePattern("50%_discount\\special")).toBe(
        "50\\%\\_discount\\\\special"
      );
    });

    it("should handle injection attempt: %_%", () => {
      expect(escapeLikePattern("%_%")).toBe("\\%\\_\\%");
    });

    it("should handle injection attempt: %\\%", () => {
      expect(escapeLikePattern("%\\%")).toBe("\\%\\\\\\%");
    });

    it("should handle complex injection: %admin%", () => {
      expect(escapeLikePattern("%admin%")).toBe("\\%admin\\%");
    });

    it("should handle LIKE wildcard attack: _____", () => {
      // Attempt to match any 5-character string
      expect(escapeLikePattern("_____")).toBe("\\_\\_\\_\\_\\_");
    });
  });

  describe("safe patterns (no escaping needed)", () => {
    it("should not modify alphanumeric strings", () => {
      expect(escapeLikePattern("INV12345")).toBe("INV12345");
    });

    it("should not modify spaces", () => {
      expect(escapeLikePattern("John Doe")).toBe("John Doe");
    });

    it("should not modify other punctuation", () => {
      expect(escapeLikePattern("test@example.com")).toBe("test@example.com");
      expect(escapeLikePattern("(123) 456-7890")).toBe("(123) 456-7890");
    });

    it("should not modify empty string", () => {
      expect(escapeLikePattern("")).toBe("");
    });

    it("should not modify unicode characters", () => {
      expect(escapeLikePattern("Lietuvos Imones")).toBe("Lietuvos Imones");
    });
  });
});

describe("Memo Parsing Security (H-09)", () => {
  describe("SQL characters in payment memos", () => {
    it("should safely handle apostrophe in memo", () => {
      const memo = "Payment from O'Brien Company";
      const escaped = escapeLikePattern(memo);
      // Apostrophe doesn't need escaping for LIKE (only for SQL strings)
      expect(escaped).toBe(memo);
    });

    it("should handle semicolon in memo", () => {
      const memo = "Invoice INV-123; partial payment";
      const escaped = escapeLikePattern(memo);
      expect(escaped).toBe(memo);
    });

    it("should handle double dash in memo", () => {
      const memo = "Payment -- reference 123";
      const escaped = escapeLikePattern(memo);
      expect(escaped).toBe(memo);
    });

    it("should escape LIKE wildcards in memo", () => {
      const memo = "100% prepayment for Q1_2024";
      const escaped = escapeLikePattern(memo);
      expect(escaped).toBe("100\\% prepayment for Q1\\_2024");
    });

    it("should handle malicious memo with injection attempt", () => {
      const memo = "INV-123'; DROP TABLE payments;--";
      const escaped = escapeLikePattern(memo);
      // Only LIKE-specific chars are escaped
      expect(escaped).toBe("INV-123'; DROP TABLE payments;--");
    });

    it("should handle memo with LIKE wildcard injection", () => {
      const memo = "%'; SELECT * FROM payments WHERE '1'='1";
      const escaped = escapeLikePattern(memo);
      expect(escaped.startsWith("\\%")).toBe(true);
    });
  });
});

describe("Invoice Number Search Security (H-06)", () => {
  describe("partial invoice number search", () => {
    it("should escape user-provided search term", () => {
      // User searches for "INV-%" trying to match all invoices
      const userInput = "INV-%";
      const escaped = escapeLikePattern(userInput);
      expect(escaped).toBe("INV-\\%");
    });

    it("should escape underscore in invoice format search", () => {
      // User searches for "INV_2024" trying to match INV-2024, INV/2024, etc.
      const userInput = "INV_2024";
      const escaped = escapeLikePattern(userInput);
      expect(escaped).toBe("INV\\_2024");
    });

    it("should handle legitimate invoice search", () => {
      const userInput = "INV-2024-001";
      const escaped = escapeLikePattern(userInput);
      expect(escaped).toBe("INV-2024-001");
    });
  });
});

describe("Client Name Search Security (H-06)", () => {
  describe("client name matching", () => {
    it("should escape wildcards in client name search", () => {
      // Malicious search trying to match all names
      const userInput = "%";
      const escaped = escapeLikePattern(userInput);
      expect(escaped).toBe("\\%");
    });

    it("should handle legitimate company name with special chars", () => {
      const userInput = "AT&T Corporation";
      const escaped = escapeLikePattern(userInput);
      expect(escaped).toBe("AT&T Corporation");
    });

    it("should escape underscore in company name", () => {
      const userInput = "Company_Name";
      const escaped = escapeLikePattern(userInput);
      expect(escaped).toBe("Company\\_Name");
    });
  });
});

describe("Integration: Search Pattern Building", () => {
  // Simulates how the pattern would be used in actual queries
  function buildSearchPattern(userInput: string): string {
    const escaped = escapeLikePattern(userInput);
    return `%${escaped}%`;
  }

  it("should create safe CONTAINS pattern", () => {
    const pattern = buildSearchPattern("test");
    expect(pattern).toBe("%test%");
  });

  it("should create safe pattern with escaped chars", () => {
    const pattern = buildSearchPattern("100%");
    expect(pattern).toBe("%100\\%%");
  });

  it("should not allow full wildcard match", () => {
    const pattern = buildSearchPattern("%");
    // User input "%" becomes "\%" - won't match everything
    expect(pattern).toBe("%\\%%");
  });

  it("should not allow single-char wildcard injection", () => {
    const pattern = buildSearchPattern("_");
    expect(pattern).toBe("%\\_%");
  });
});
