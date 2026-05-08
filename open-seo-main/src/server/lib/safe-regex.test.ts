/**
 * Tests for Safe Regex Utilities
 * Phase 96-Security: SEC-004 Fix Tests
 */
import { describe, it, expect } from "vitest";
import {
  validateUserRegex,
  isPatternSafe,
  safeMatch,
  safeTest,
  createSafeFilter,
  validatePatterns,
  MAX_PATTERN_LENGTH,
} from "./safe-regex";

describe("Safe Regex Utilities (SEC-004)", () => {
  describe("validateUserRegex", () => {
    describe("valid patterns", () => {
      it("should accept simple patterns", () => {
        const result = validateUserRegex("hello");
        expect(result.valid).toBe(true);
        expect(result.regex).toBeDefined();
      });

      it("should accept patterns with basic quantifiers", () => {
        expect(validateUserRegex("a+").valid).toBe(true);
        expect(validateUserRegex("a*").valid).toBe(true);
        expect(validateUserRegex("a?").valid).toBe(true);
        expect(validateUserRegex("a{1,3}").valid).toBe(true);
      });

      it("should accept character classes", () => {
        expect(validateUserRegex("[a-z]+").valid).toBe(true);
        expect(validateUserRegex("[0-9]*").valid).toBe(true);
        expect(validateUserRegex("\\d+").valid).toBe(true);
        expect(validateUserRegex("\\w+").valid).toBe(true);
      });

      it("should accept flags", () => {
        const result = validateUserRegex("hello", "gi");
        expect(result.valid).toBe(true);
        expect(result.regex?.flags).toContain("g");
        expect(result.regex?.flags).toContain("i");
      });
    });

    describe("dangerous patterns (ReDoS)", () => {
      it("should reject nested quantifiers (a+)+", () => {
        const result = validateUserRegex("(a+)+");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("nested quantifiers");
      });

      it("should reject nested quantifiers (a*)*", () => {
        const result = validateUserRegex("(a*)*");
        expect(result.valid).toBe(false);
      });

      it("should reject nested quantifiers (a+)*", () => {
        const result = validateUserRegex("(a+)*");
        expect(result.valid).toBe(false);
      });

      it("should reject adjacent quantifiers a++", () => {
        // Note: a++ is actually possessive quantifier in some engines, but we reject it
        const result = validateUserRegex("a++");
        expect(result.valid).toBe(false);
      });

      it("should reject patterns with alternation and quantifier (a|b)+", () => {
        const result = validateUserRegex("(a|b)+");
        expect(result.valid).toBe(false);
      });

      it("should reject deeply nested parentheses", () => {
        const result = validateUserRegex("((((a))))");
        expect(result.valid).toBe(false);
      });
    });

    describe("length limits", () => {
      it("should reject empty patterns", () => {
        const result = validateUserRegex("");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("empty");
      });

      it("should reject patterns exceeding max length", () => {
        const longPattern = "a".repeat(MAX_PATTERN_LENGTH + 1);
        const result = validateUserRegex(longPattern);
        expect(result.valid).toBe(false);
        expect(result.error).toContain("maximum length");
      });

      it("should accept patterns at max length", () => {
        const maxPattern = "a".repeat(MAX_PATTERN_LENGTH);
        const result = validateUserRegex(maxPattern);
        expect(result.valid).toBe(true);
      });
    });

    describe("syntax errors", () => {
      it("should reject invalid regex syntax", () => {
        const result = validateUserRegex("[");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid regex syntax");
      });

      it("should reject unbalanced parentheses", () => {
        const result = validateUserRegex("(abc");
        expect(result.valid).toBe(false);
      });
    });
  });

  describe("isPatternSafe", () => {
    it("should return true for safe patterns", () => {
      expect(isPatternSafe("hello")).toBe(true);
      expect(isPatternSafe("[a-z]+")).toBe(true);
      expect(isPatternSafe("\\d{1,10}")).toBe(true);
    });

    it("should return false for dangerous patterns", () => {
      expect(isPatternSafe("(a+)+")).toBe(false);
      expect(isPatternSafe("(a|b)+")).toBe(false);
    });

    it("should return false for empty patterns", () => {
      expect(isPatternSafe("")).toBe(false);
    });

    it("should return false for patterns exceeding max length", () => {
      const longPattern = "a".repeat(MAX_PATTERN_LENGTH + 1);
      expect(isPatternSafe(longPattern)).toBe(false);
    });
  });

  describe("safeMatch", () => {
    it("should match valid patterns", () => {
      const result = safeMatch("hello", "hello world");
      expect(result.success).toBe(true);
      expect(result.match).not.toBeNull();
      expect(result.match?.[0]).toBe("hello");
    });

    it("should return null match for non-matching patterns", () => {
      const result = safeMatch("xyz", "hello world");
      expect(result.success).toBe(true);
      expect(result.match).toBeNull();
    });

    it("should reject dangerous patterns", () => {
      const result = safeMatch("(a+)+", "aaaaaaaaaa");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject overly long input", () => {
      const longInput = "a".repeat(20000);
      const result = safeMatch("a+", longInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain("maximum length");
    });

    it("should include execution time", () => {
      const result = safeMatch("hello", "hello");
      expect(result.executionTimeMs).toBeDefined();
      expect(typeof result.executionTimeMs).toBe("number");
    });
  });

  describe("safeTest", () => {
    it("should return true for matching patterns", () => {
      expect(safeTest("hello", "hello world")).toBe(true);
    });

    it("should return false for non-matching patterns", () => {
      expect(safeTest("xyz", "hello world")).toBe(false);
    });

    it("should return false for dangerous patterns", () => {
      expect(safeTest("(a+)+", "aaaaaaaaaa")).toBe(false);
    });

    it("should support flags", () => {
      expect(safeTest("HELLO", "hello world", "i")).toBe(true);
    });
  });

  describe("createSafeFilter", () => {
    it("should create a working filter function", () => {
      const filter = createSafeFilter("hello");
      expect(filter).not.toBeNull();
      expect(filter!("hello world")).toBe(true);
      expect(filter!("goodbye world")).toBe(false);
    });

    it("should return null for dangerous patterns", () => {
      const filter = createSafeFilter("(a+)+");
      expect(filter).toBeNull();
    });

    it("should be case-insensitive by default", () => {
      const filter = createSafeFilter("hello");
      expect(filter!("HELLO WORLD")).toBe(true);
    });

    it("should support custom flags", () => {
      const filter = createSafeFilter("hello", ""); // No flags = case-sensitive
      expect(filter!("HELLO")).toBe(false);
      expect(filter!("hello")).toBe(true);
    });

    it("should handle long inputs safely", () => {
      const filter = createSafeFilter("test");
      const longInput = "a".repeat(20000);
      // Should return false rather than throwing
      expect(filter!(longInput)).toBe(false);
    });
  });

  describe("validatePatterns", () => {
    it("should validate multiple patterns", () => {
      const results = validatePatterns(["hello", "[a-z]+", "(a+)+"]);

      expect(results["hello"].valid).toBe(true);
      expect(results["[a-z]+"].valid).toBe(true);
      expect(results["(a+)+"].valid).toBe(false);
    });

    it("should return empty object for empty array", () => {
      const results = validatePatterns([]);
      expect(Object.keys(results).length).toBe(0);
    });
  });

  describe("Real-world ReDoS patterns", () => {
    // These are known ReDoS patterns that have caused outages
    it("should reject classic email ReDoS pattern", () => {
      // This pattern can cause exponential backtracking
      const result = validateUserRegex("([a-zA-Z0-9]+)+@");
      expect(result.valid).toBe(false);
    });

    it("should reject path validation ReDoS pattern", () => {
      // This pattern has overlapping character classes with quantifiers
      const result = validateUserRegex("([a-z]+)*");
      expect(result.valid).toBe(false);
    });
  });
});
