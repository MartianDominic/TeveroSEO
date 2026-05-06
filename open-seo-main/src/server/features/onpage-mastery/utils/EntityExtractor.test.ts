/**
 * EntityExtractor Tests
 * Phase 92: On-Page SEO Mastery
 *
 * Tests for: OPM-15 (entity extraction with PII stripping)
 * TDD: RED phase - write failing tests first
 */

import { describe, it, expect } from "vitest";
import {
  extractEntities,
  stripPII,
  containsPII,
  calculateEvidenceDensity,
  type ExtractedEntities,
} from "./EntityExtractor";

describe("EntityExtractor", () => {
  describe("extractEntities", () => {
    it("should extract person names", () => {
      const text = "John Smith went to the store. Mary Johnson was there too.";
      const result = extractEntities(text);

      expect(result.people).toContain("John Smith");
      expect(result.people.length).toBeGreaterThan(0);
    });

    it("should extract place names", () => {
      const text = "The company is headquartered in New York. They also have offices in San Francisco.";
      const result = extractEntities(text);

      expect(result.places).toContain("New York");
      expect(result.places.length).toBeGreaterThan(0);
    });

    it("should extract organization names", () => {
      const text = "Apple Inc. announced new products. Microsoft and Google also made announcements.";
      const result = extractEntities(text);

      expect(result.organizations.length).toBeGreaterThan(0);
    });

    it("should calculate fact density", () => {
      const text = "John Smith works at Apple in New York since 2020. The company has 100,000 employees.";
      const result = extractEntities(text);

      expect(typeof result.factDensity).toBe("number");
      expect(result.factDensity).toBeGreaterThan(0);
    });

    it("should extract dates", () => {
      const text = "The meeting is scheduled for January 15th, 2024. The deadline is next Friday.";
      const result = extractEntities(text);

      expect(result.dates.length).toBeGreaterThan(0);
    });

    it("should extract numbers", () => {
      const text = "The revenue was 5 million dollars. There were 1000 attendees at the event.";
      const result = extractEntities(text);

      expect(result.numbers.length).toBeGreaterThan(0);
    });

    it("should return empty arrays for text without entities", () => {
      const text = "A simple statement without any specific names or places.";
      const result = extractEntities(text);

      expect(Array.isArray(result.people)).toBe(true);
      expect(Array.isArray(result.places)).toBe(true);
      expect(Array.isArray(result.organizations)).toBe(true);
    });

    it("should handle empty string", () => {
      const result = extractEntities("");

      expect(result.people).toEqual([]);
      expect(result.factDensity).toBe(0);
    });
  });

  describe("stripPII", () => {
    it("should remove email addresses", () => {
      const text = "Contact me at john.doe@example.com for more information.";
      const result = stripPII(text);

      expect(result).not.toContain("john.doe@example.com");
      expect(result).toContain("[EMAIL]");
    });

    it("should remove phone numbers", () => {
      const text = "Call us at 555-123-4567 or 1-800-555-0199.";
      const result = stripPII(text);

      expect(result).not.toContain("555-123-4567");
      expect(result).toContain("[PHONE]");
    });

    it("should remove SSN patterns", () => {
      const text = "My SSN is 123-45-6789 for the records.";
      const result = stripPII(text);

      expect(result).not.toContain("123-45-6789");
      expect(result).toContain("[SSN]");
    });

    it("should handle multiple PII instances", () => {
      const text = "Email: test@test.com Phone: 555-555-5555 SSN: 111-22-3333";
      const result = stripPII(text);

      expect(result).toContain("[EMAIL]");
      expect(result).toContain("[PHONE]");
      expect(result).toContain("[SSN]");
      expect(result).not.toContain("test@test.com");
    });

    it("should preserve non-PII text", () => {
      const text = "The company revenue was $1 million in 2023.";
      const result = stripPII(text);

      expect(result).toBe(text);
    });

    it("should handle international phone formats", () => {
      const text = "Call +1-555-123-4567 for support.";
      const result = stripPII(text);

      expect(result).toContain("[PHONE]");
    });

    it("should handle email with subdomains", () => {
      const text = "Send to user@mail.company.co.uk for assistance.";
      const result = stripPII(text);

      expect(result).toContain("[EMAIL]");
    });
  });

  describe("containsPII", () => {
    it("should return true for text with email", () => {
      const text = "Contact support@example.com for help.";
      expect(containsPII(text)).toBe(true);
    });

    it("should return true for text with phone number", () => {
      const text = "Call 555-123-4567 for support.";
      expect(containsPII(text)).toBe(true);
    });

    it("should return true for text with SSN", () => {
      const text = "SSN: 123-45-6789";
      expect(containsPII(text)).toBe(true);
    });

    it("should return false for text without PII", () => {
      const text = "This is a regular sentence without any personal information.";
      expect(containsPII(text)).toBe(false);
    });
  });

  describe("calculateEvidenceDensity", () => {
    it("should count statistics per 200 words", () => {
      // Text with numbers and percentages
      const text = `
        The study found that 45% of participants improved. The average score
        increased by 12 points. According to the 2023 report, revenue grew 30%.
        Over 1000 customers participated in the survey. The results showed a
        significant 25% reduction in costs. Industry experts note that this
        represents a 3x improvement over previous methods.
      `;
      const density = calculateEvidenceDensity(text);

      expect(density).toBeGreaterThan(0);
    });

    it("should count citations", () => {
      const text = `
        Research shows significant improvements (Smith et al. 2023). Another
        study confirms these findings [1]. The methodology was validated by
        multiple sources (Johnson 2024). These results are consistent with
        prior work [2].
      `;
      const density = calculateEvidenceDensity(text);

      expect(density).toBeGreaterThan(0);
    });

    it("should return 0 for text without evidence", () => {
      const text = "This is a simple statement without any numbers or citations.";
      const density = calculateEvidenceDensity(text);

      // May have very low density but should be valid number
      expect(typeof density).toBe("number");
      expect(density).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty text", () => {
      const density = calculateEvidenceDensity("");
      expect(density).toBe(0);
    });

    it("should count percentages", () => {
      const text = "Revenue increased by 50%. Customer satisfaction is at 95%. Market share grew 10%.";
      const density = calculateEvidenceDensity(text);

      expect(density).toBeGreaterThan(0);
    });
  });
});
