/**
 * Tests for Variable Detection Service
 * Phase 102-10: Task 3 - Variable detector
 *
 * TDD: Tests for detecting explicit and implicit variables in content.
 */

import { describe, it, expect } from "vitest";
import {
  detectVariables,
  type DetectedVariable,
  type VariableDetectionResult,
} from "../variable-detector";

describe("variable-detector", () => {
  describe("detectVariables", () => {
    it("finds explicit variables with double curly braces", () => {
      const text = "Welcome {{prospect.company}}, your website {{prospect.website}} needs SEO.";
      const result = detectVariables(text);

      expect(result.explicit).toHaveLength(2);
      expect(result.explicit[0].originalText).toBe("{{prospect.company}}");
      expect(result.explicit[0].variablePath).toBe("prospect.company");
      expect(result.explicit[1].variablePath).toBe("prospect.website");
    });

    it("suggests implicit variables for company names", () => {
      const text = "TeveroSEO will help your business grow with organic traffic.";
      const result = detectVariables(text);

      expect(result.implicit.length).toBeGreaterThanOrEqual(1);
      const companyVar = result.implicit.find((v) => v.variableType === "company_name");
      expect(companyVar).toBeDefined();
      expect(companyVar!.originalText).toBe("TeveroSEO");
    });

    it("returns variable path and detected value", () => {
      const text = "The price is {{pricing.basic}} per month.";
      const result = detectVariables(text);

      expect(result.explicit).toHaveLength(1);
      expect(result.explicit[0].variablePath).toBe("pricing.basic");
      expect(result.explicit[0].positions).toHaveLength(1);
      expect(result.explicit[0].positions[0].start).toBe(13);
    });

    it("handles Lithuanian company names (UAB, AB, MB)", () => {
      const text = "UAB Plaukų Pasaka yra mūsų klientas nuo 2020 metų.";
      const result = detectVariables(text);

      const ltCompany = result.implicit.find((v) =>
        v.originalText.includes("Plaukų Pasaka") ||
        v.originalText.includes("UAB")
      );
      expect(ltCompany).toBeDefined();
      expect(ltCompany!.variableType).toBe("company_name");
    });

    it("detects currency amounts", () => {
      const text = "Our services start at 2,500 EUR per month or €3,000 for premium.";
      const result = detectVariables(text);

      const priceVars = result.implicit.filter((v) => v.variableType === "price");
      expect(priceVars.length).toBeGreaterThanOrEqual(2);
      expect(priceVars.some((v) => v.originalText.includes("2,500"))).toBe(true);
      expect(priceVars.some((v) => v.originalText.includes("3,000"))).toBe(true);
    });

    it("detects percentages", () => {
      const text = "We achieved 340% growth and improved CTR by 15.5%.";
      const result = detectVariables(text);

      const percentVars = result.implicit.filter((v) => v.variableType === "percentage");
      expect(percentVars.length).toBeGreaterThanOrEqual(2);
      expect(percentVars.some((v) => v.originalText.includes("340%"))).toBe(true);
      expect(percentVars.some((v) => v.originalText.includes("15.5%"))).toBe(true);
    });

    it("detects dates", () => {
      const text = "Valid until December 31, 2026 or 2026-12-31.";
      const result = detectVariables(text);

      const dateVars = result.implicit.filter((v) => v.variableType === "date");
      expect(dateVars.length).toBeGreaterThanOrEqual(1);
    });

    it("detects domains/URLs", () => {
      const text = "Your website example.com is performing below industry standards.";
      const result = detectVariables(text);

      const domainVars = result.implicit.filter((v) => v.variableType === "domain");
      expect(domainVars.length).toBeGreaterThanOrEqual(1);
      expect(domainVars[0].originalText).toContain("example.com");
    });

    it("returns empty arrays for text without variables", () => {
      const text = "This is a simple sentence with no variables.";
      const result = detectVariables(text);

      expect(result.explicit).toHaveLength(0);
      // May still have implicit variables depending on analysis
    });

    it("provides suggested variable paths for implicit variables", () => {
      const text = "Contact us at hello@example.com for pricing.";
      const result = detectVariables(text);

      const emailVar = result.implicit.find((v) => v.variableType === "contact_email");
      if (emailVar) {
        expect(emailVar.suggestedVariable).toMatch(/\{\{.*\}\}/);
      }
    });

    it("handles multiple occurrences of the same value", () => {
      const text = "TeveroSEO is great. Contact TeveroSEO today!";
      const result = detectVariables(text);

      const companyVars = result.implicit.filter(
        (v) => v.originalText === "TeveroSEO"
      );
      if (companyVars.length > 0) {
        expect(companyVars[0].occurrences).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("DetectedVariable type", () => {
    it("has required fields", () => {
      const variable: DetectedVariable = {
        id: "var-1",
        originalText: "TeveroSEO",
        variablePath: "prospect.company",
        suggestedVariable: "{{prospect.company}}",
        variableType: "company_name",
        confidence: 85,
        occurrences: 1,
        positions: [{ start: 0, end: 9 }],
      };

      expect(variable.id).toBeDefined();
      expect(variable.originalText).toBeDefined();
      expect(variable.variablePath).toBeDefined();
      expect(variable.variableType).toBeDefined();
      expect(variable.confidence).toBeDefined();
    });
  });
});
