/**
 * T1-80: LocalBusiness schema complete check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: local page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-80",
  name: "LocalBusiness schema complete",
  tier: 1,
  category: "content-structure",
  severity: "high",
  autoEditable: true,
  editRecipe: "Add complete LocalBusiness JSON-LD schema with name, address, phone, openingHours",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "local" && pageType !== "unknown") {
      return {
        checkId: "T1-80",
        passed: true,
        severity: "info",
        message: `LocalBusiness schema check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Get JSON-LD scripts
    const jsonLdScripts = $('script[type="application/ld+json"]');
    let localBusinessSchema: Record<string, unknown> | null = null;
    let hasSchema = false;

    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const parsed = JSON.parse(content);
          const schemas = Array.isArray(parsed) ? parsed : [parsed];
          for (const schema of schemas) {
            if (schema["@type"]?.includes("LocalBusiness") ||
                schema["@type"]?.includes("Restaurant") ||
                schema["@type"]?.includes("Store")) {
              localBusinessSchema = schema;
              hasSchema = true;
              break;
            }
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    if (!hasSchema) {
      return {
        checkId: "T1-80",
        passed: false,
        severity: "high",
        message: "Missing LocalBusiness JSON-LD schema",
        autoEditable: true,
      };
    }

    // Check for required fields
    const requiredFields = ["name", "address", "telephone"];
    const recommendedFields = ["openingHours", "image", "priceRange", "geo"];

    const missingRequired = requiredFields.filter(f => !localBusinessSchema![f]);
    const missingRecommended = recommendedFields.filter(f => !localBusinessSchema![f]);

    const passed = missingRequired.length === 0;

    return {
      checkId: "T1-80",
      passed,
      severity: passed ? "info" : "high",
      message: passed
        ? `LocalBusiness schema complete (${missingRecommended.length} recommended fields missing)`
        : `LocalBusiness schema incomplete - missing: ${missingRequired.join(", ")}`,
      details: { missingRequired, missingRecommended },
      autoEditable: !passed,
    };
  },
});
