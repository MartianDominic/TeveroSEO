/**
 * T1-79: Map embed present check
 * Tier 1: DOM/regex check
 * Category: content-structure
 * Applies to: local page types
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";
import { detectPageType } from "./T1-70-page-type";

registerCheck({
  id: "T1-79",
  name: "Map embed present",
  tier: 1,
  category: "content-structure",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add a Google Maps embed or interactive map showing your business location",
  run: (ctx: CheckContext): CheckResult => {
    const { $, html } = ctx;

    // Detect page type
    const { type: pageType } = detectPageType($, html);

    if (pageType && pageType !== "local" && pageType !== "unknown") {
      return {
        checkId: "T1-79",
        passed: true,
        severity: "info",
        message: `Map embed check not applicable for ${pageType} pages`,
        autoEditable: false,
      };
    }

    // Check for Google Maps iframe
    const hasGoogleMaps = $('iframe[src*="google.com/maps"], iframe[src*="maps.google"]').length > 0;

    // Check for other map providers
    const hasOtherMaps = $('iframe[src*="openstreetmap"], iframe[src*="mapbox"], iframe[src*="bing.com/maps"]').length > 0;

    // Check for map container classes
    const hasMapContainer = $(".map, [class*='map'], #map, [id*='map']").length > 0;

    const passed = hasGoogleMaps || hasOtherMaps || hasMapContainer;

    return {
      checkId: "T1-79",
      passed,
      severity: passed ? "info" : "medium",
      message: passed
        ? "Map embed found"
        : "Missing map embed - add Google Maps or location map for local businesses",
      details: { hasGoogleMaps, hasOtherMaps, hasMapContainer },
      autoEditable: !passed,
    };
  },
});
