/**
 * T1-83: Service schema present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: service page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-83",
  name: "Service schema present",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add Service or ProfessionalService JSON-LD schema with serviceType and provider",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "service" && pageType !== "unknown") {
      return {
        checkId: "T1-83",
        passed: true,
        severity: "info",
        message: `Service schema check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Get JSON-LD scripts
    const jsonLd = $('script[type="application/ld+json"]').text();

    // Check for Service schema types
    const hasServiceSchema = /"@type"\s*:\s*"(?:Service|ProfessionalService|HomeAndConstructionBusiness|FinancialService|LegalService)"/.test(jsonLd);

    // Check for microdata Service
    const hasMicrodata = $('[itemtype*="Service"]').length > 0;

    const passed = hasServiceSchema || hasMicrodata;

    return {
      checkId: "T1-83",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "Service schema found"
        : "Missing Service schema - add JSON-LD for better rich results",
      details: { hasServiceSchema, hasMicrodata },
      autoEditable: !passed,
    };
  },
});
