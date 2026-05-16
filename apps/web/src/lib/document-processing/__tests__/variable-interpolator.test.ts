/**
 * Tests for Variable Interpolation Service
 * Phase 102-10: Task 4 - Variable interpolator
 *
 * TDD: Tests for resolving variables from prospect/SEO data.
 */

import { describe, it, expect } from "vitest";
import {
  interpolateVariables,
  type VariableContext,
  AVAILABLE_VARIABLES,
} from "../variable-interpolator";

describe("variable-interpolator", () => {
  describe("interpolateVariables", () => {
    it("resolves prospect.company to actual value", () => {
      const text = "Welcome to {{prospect.company}}!";
      const context: VariableContext = {
        prospect: {
          company: "TeveroSEO",
        },
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Welcome to TeveroSEO!");
      expect(result.resolvedCount).toBe(1);
      expect(result.unresolvedVariables).toHaveLength(0);
    });

    it("resolves seo_data.rank from SEO data", () => {
      const text = "Your website currently ranks #{{seo_data.rank}} for target keywords.";
      const context: VariableContext = {
        seo_data: {
          rank: 47,
        },
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Your website currently ranks #47 for target keywords.");
      expect(result.resolvedCount).toBe(1);
    });

    it("highlights missing variables instead of removing them", () => {
      const text = "Contact {{prospect.contact_name}} at {{prospect.email}}.";
      const context: VariableContext = {
        prospect: {
          company: "Test Co",
        },
      };

      const result = interpolateVariables(text, context);

      // Missing variables should be highlighted, not removed
      expect(result.text).toContain("{{prospect.contact_name}}");
      expect(result.text).toContain("{{prospect.email}}");
      expect(result.unresolvedVariables).toContain("prospect.contact_name");
      expect(result.unresolvedVariables).toContain("prospect.email");
    });

    it("resolves nested paths (prospect.contact.email)", () => {
      const text = "Email: {{prospect.contact.email}}";
      const context: VariableContext = {
        prospect: {
          contact: {
            email: "test@example.com",
          },
        },
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Email: test@example.com");
    });

    it("supports default values (prospect.company|Unknown)", () => {
      const text = "Company: {{prospect.company|Unknown Company}}";
      const context: VariableContext = {
        prospect: {},
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Company: Unknown Company");
    });

    it("resolves multiple variables in same text", () => {
      const text = "{{prospect.company}} ranks #{{seo_data.rank}} and gets {{seo_data.traffic}} visitors/month.";
      const context: VariableContext = {
        prospect: {
          company: "Acme Inc",
        },
        seo_data: {
          rank: 12,
          traffic: 5000,
        },
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Acme Inc ranks #12 and gets 5,000 visitors/month.");
      expect(result.resolvedCount).toBe(3);
    });

    it("handles pricing variables", () => {
      const text = "Basic package: {{pricing.basic}} | Premium: {{pricing.premium}}";
      const context: VariableContext = {
        pricing: {
          basic: "2,500 EUR",
          premium: "5,000 EUR",
        },
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Basic package: 2,500 EUR | Premium: 5,000 EUR");
    });

    it("handles date variables", () => {
      const text = "Valid until {{dates.expiration}}";
      const context: VariableContext = {
        dates: {
          expiration: "December 31, 2026",
        },
      };

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("Valid until December 31, 2026");
    });

    it("returns original text when no variables present", () => {
      const text = "This text has no variables.";
      const context: VariableContext = {};

      const result = interpolateVariables(text, context);

      expect(result.text).toBe("This text has no variables.");
      expect(result.resolvedCount).toBe(0);
    });

    it("handles empty context gracefully", () => {
      const text = "Hello {{prospect.company}}!";
      const context: VariableContext = {};

      const result = interpolateVariables(text, context);

      expect(result.text).toContain("{{prospect.company}}");
      expect(result.unresolvedVariables).toContain("prospect.company");
    });
  });

  describe("AVAILABLE_VARIABLES", () => {
    it("contains prospect category", () => {
      const prospectVars = AVAILABLE_VARIABLES.find((c) => c.category === "prospect");
      expect(prospectVars).toBeDefined();
      expect(prospectVars!.variables.length).toBeGreaterThan(0);
    });

    it("contains seo_data category", () => {
      const seoVars = AVAILABLE_VARIABLES.find((c) => c.category === "seo_data");
      expect(seoVars).toBeDefined();
      expect(seoVars!.variables.length).toBeGreaterThan(0);
    });

    it("contains pricing category", () => {
      const pricingVars = AVAILABLE_VARIABLES.find((c) => c.category === "pricing");
      expect(pricingVars).toBeDefined();
      expect(pricingVars!.variables.length).toBeGreaterThan(0);
    });

    it("contains dates category", () => {
      const dateVars = AVAILABLE_VARIABLES.find((c) => c.category === "dates");
      expect(dateVars).toBeDefined();
      expect(dateVars!.variables.length).toBeGreaterThan(0);
    });

    it("each variable has path, label, and description", () => {
      for (const category of AVAILABLE_VARIABLES) {
        for (const variable of category.variables) {
          expect(variable.path).toBeDefined();
          expect(variable.label).toBeDefined();
          expect(variable.description).toBeDefined();
        }
      }
    });
  });

  describe("VariableContext type", () => {
    it("accepts nested objects", () => {
      const context: VariableContext = {
        prospect: {
          company: "Test",
          contact: {
            name: "John",
            email: "john@test.com",
          },
        },
        seo_data: {
          rank: 10,
          traffic: 1000,
        },
        pricing: {
          basic: "1000",
          premium: "2000",
        },
        dates: {
          proposal_date: "2026-05-16",
        },
        custom: {
          any_key: "any_value",
        },
      };

      expect(context.prospect!.company).toBe("Test");
      expect(context.prospect!.contact!.name).toBe("John");
    });
  });
});
