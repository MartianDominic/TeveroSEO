/**
 * SaaS Vertical Rules
 * Phase 92-04: RuleEngineService
 *
 * Rules specific to SaaS/software product pages.
 * These rules enforce feature documentation, pricing transparency,
 * and software-specific best practices.
 */

import type { RuleDefinition } from "./types";

/**
 * SaaS-specific rules.
 * Focus on software features, pricing, and integrations.
 */
export const saasRules: RuleDefinition[] = [
  {
    id: "R-SS-01",
    name: "Feature table present",
    description: "Product features are presented in structured format",
    category: "content",
    weight: 1.5,
    severity: "high",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const hasTable = ctx.$("table").length > 0;
      const hasFeatureList =
        ctx.$("ul.features, .feature-list, [class*='feature']").length > 0 ||
        /features?:?\s*\n/i.test(ctx.text);

      const hasFeatures = hasTable || hasFeatureList;
      return {
        passed: hasFeatures,
        score: hasFeatures ? 100 : 50,
        message: hasFeatures
          ? "Feature presentation found"
          : "Consider adding a feature table",
      };
    },
  },
  {
    id: "R-SS-02",
    name: "Pricing transparency",
    description: "Pricing information is clearly displayed",
    category: "content",
    weight: 2.0,
    severity: "high",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const pricingPatterns = [
        /\$\d+(\.\d{2})?\s*\/?m(onth)?/i,
        /\$\d+(\.\d{2})?\s*\/?y(ear)?/i,
        /pricing/i,
        /free (trial|tier|plan)/i,
        /per (user|seat|month)/i,
        /starting at/i,
      ];
      const hasPricing =
        pricingPatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('a[href*="pricing"], .pricing').length > 0;

      return {
        passed: hasPricing,
        score: hasPricing ? 100 : 50,
        message: hasPricing
          ? "Pricing information found"
          : "Consider adding pricing transparency",
      };
    },
  },
  {
    id: "R-SS-03",
    name: "Integration mentions",
    description: "Software integrations are documented",
    category: "content",
    weight: 1.0,
    severity: "medium",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const integrationPatterns = [
        /integrat(es?|ions?)/i,
        /connect(s)? (with|to)/i,
        /works with/i,
        /compatible with/i,
        /api|webhook/i,
      ];
      const hasIntegrations =
        integrationPatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('a[href*="integration"], .integrations').length > 0;

      return {
        passed: hasIntegrations,
        score: hasIntegrations ? 100 : 50,
        message: hasIntegrations
          ? "Integration information found"
          : "Consider mentioning integrations",
      };
    },
  },
  {
    id: "R-SS-04",
    name: "Security/trust badges",
    description: "Security certifications or trust signals present",
    category: "trust",
    weight: 1.5,
    severity: "medium",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const securityPatterns = [
        /\b(soc 2|soc2|iso 27001|gdpr|hipaa|pci|ssl|encrypted)\b/i,
        /security/i,
        /privacy/i,
        /compliant/i,
        /certified/i,
      ];
      const hasSecurity =
        securityPatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('[class*="security"], [class*="trust"], [class*="badge"]').length > 0;

      return {
        passed: hasSecurity,
        score: hasSecurity ? 100 : 50,
        message: hasSecurity
          ? "Security/trust signals found"
          : "Consider adding security badges",
      };
    },
  },
  {
    id: "R-SS-05",
    name: "CTA button prominent",
    description: "Call-to-action (sign up, demo, trial) is prominent",
    category: "structure",
    weight: 1.5,
    severity: "high",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const ctaPatterns = [
        /sign up/i,
        /get started/i,
        /start (free )?trial/i,
        /request demo/i,
        /book a demo/i,
        /try (it )?free/i,
      ];
      const hasCTA =
        ctaPatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('button, a.btn, [class*="cta"]').length > 0;

      return {
        passed: hasCTA,
        score: hasCTA ? 100 : 50,
        message: hasCTA
          ? "CTA button found"
          : "Consider adding prominent CTA",
      };
    },
  },
  {
    id: "R-SS-06",
    name: "Software schema present",
    description: "Page has SoftwareApplication schema",
    category: "schema",
    weight: 1.0,
    severity: "medium",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const softwareSchemas = [
        "SoftwareApplication",
        "WebApplication",
        "MobileApplication",
      ];
      const hasSoftwareSchema = ctx.metadata.schemas.some((s) =>
        softwareSchemas.some(
          (ss) => s.includes(`"@type":"${ss}"`) || s.includes(`"@type": "${ss}"`)
        )
      );
      return {
        passed: hasSoftwareSchema,
        score: hasSoftwareSchema ? 100 : 50,
        message: hasSoftwareSchema
          ? "Software schema found"
          : "Consider adding SoftwareApplication schema",
      };
    },
  },
  {
    id: "R-SS-07",
    name: "Use cases documented",
    description: "Software use cases or customer stories present",
    category: "content",
    weight: 1.0,
    severity: "medium",
    verticals: ["saas"],
    evaluate: (ctx) => {
      const useCasePatterns = [
        /use case/i,
        /case stud(y|ies)/i,
        /customer stor(y|ies)/i,
        /success stor(y|ies)/i,
        /how .* use/i,
        /testimonial/i,
      ];
      const hasUseCases =
        useCasePatterns.some((p) => p.test(ctx.text)) ||
        ctx.$('a[href*="case-stud"], .case-study, .testimonial').length > 0;

      return {
        passed: hasUseCases,
        score: hasUseCases ? 100 : 50,
        message: hasUseCases
          ? "Use cases found"
          : "Consider adding use cases or testimonials",
      };
    },
  },
];
