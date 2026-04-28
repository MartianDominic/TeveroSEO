/**
 * Tier 1 Technical Basics Checks (T1-55 to T1-59)
 * Category J: Technical SEO fundamentals
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult } from "../types";

// T1-55: Self-referencing canonical
registerCheck({
  id: "T1-55",
  name: "Self-referencing canonical",
  tier: 1,
  category: "technical-basics",
  severity: "critical",
  autoEditable: true,
  editRecipe: "Set canonical to match the current page URL",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const canonical = $('link[rel="canonical"]').attr("href");
    if (!canonical) {
      return {
        checkId: "T1-55",
        passed: false,
        severity: "critical",
        message: "No canonical tag found",
        autoEditable: true,
        editRecipe: "Add self-referencing canonical tag",
      };
    }
    try {
      const canonicalUrl = new URL(canonical, ctx.url);
      const pageUrl = new URL(ctx.url);
      // Compare without trailing slash and query params for basic match
      const canonicalPath = canonicalUrl.origin + canonicalUrl.pathname.replace(/\/$/, "");
      const pagePath = pageUrl.origin + pageUrl.pathname.replace(/\/$/, "");
      const passed = canonicalPath === pagePath;
      return {
        checkId: "T1-55",
        passed,
        severity: passed ? "info" : "critical",
        message: passed ? "Canonical is self-referencing" : "Canonical does not match current URL",
        details: { canonical, pageUrl: ctx.url },
        autoEditable: !passed,
        editRecipe: passed ? undefined : "Set canonical to match the current page URL",
      };
    } catch {
      return { checkId: "T1-55", passed: false, severity: "critical", message: "Invalid canonical URL", autoEditable: true, editRecipe: "Fix canonical URL format" };
    }
  },
});

// T1-56: Canonical is absolute URL
registerCheck({
  id: "T1-56",
  name: "Canonical is absolute URL",
  tier: 1,
  category: "technical-basics",
  severity: "high",
  autoEditable: true,
  editRecipe: "Change canonical to absolute URL with protocol and domain",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const canonical = $('link[rel="canonical"]').attr("href");
    if (!canonical) {
      return { checkId: "T1-56", passed: true, severity: "info", message: "No canonical tag found", autoEditable: false };
    }
    const passed = /^https?:\/\//i.test(canonical);
    return {
      checkId: "T1-56",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "Canonical is absolute URL" : "Canonical is relative (should be absolute)",
      details: { canonical },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Change canonical to absolute URL with protocol and domain",
    };
  },
});

// T1-57: HTTPS protocol
registerCheck({
  id: "T1-57",
  name: "HTTPS protocol",
  tier: 1,
  category: "technical-basics",
  severity: "critical",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    try {
      const urlObj = new URL(ctx.url);
      const passed = urlObj.protocol === "https:";
      return {
        checkId: "T1-57",
        passed,
        severity: passed ? "info" : "critical",
        message: passed ? "Page uses HTTPS" : "Page not using HTTPS (ranking factor)",
        autoEditable: false,
      };
    } catch {
      return { checkId: "T1-57", passed: false, severity: "critical", message: "Invalid URL", autoEditable: false };
    }
  },
});

// T1-58: No mixed content
registerCheck({
  id: "T1-58",
  name: "No mixed content",
  tier: 1,
  category: "technical-basics",
  severity: "high",
  autoEditable: true,
  editRecipe: "Change http:// resources to https://",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    // Check for http:// in src and href
    let httpResources = 0;
    $("[src], [href]").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      const href = $(el).attr("href") ?? "";
      if (src.startsWith("http://") && !src.includes("localhost")) httpResources++;
      // Only check href for stylesheets/scripts
      if (href.startsWith("http://") && $(el).is("link[rel='stylesheet'], script")) httpResources++;
    });
    const passed = httpResources === 0;
    return {
      checkId: "T1-58",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "No mixed content detected" : `${httpResources} mixed content resource(s) found`,
      details: { httpResources },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Change http:// resources to https://",
    };
  },
});

// T1-59: Viewport meta present
registerCheck({
  id: "T1-59",
  name: "Viewport meta present",
  tier: 1,
  category: "technical-basics",
  severity: "critical",
  autoEditable: true,
  editRecipe: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;
    const viewport = $('meta[name="viewport"]');
    const passed = viewport.length > 0;
    const content = viewport.attr("content") ?? "";
    return {
      checkId: "T1-59",
      passed,
      severity: passed ? "info" : "critical",
      message: passed ? "Viewport meta present" : "Viewport meta missing (mobile-first indexing)",
      details: passed ? { content } : undefined,
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    };
  },
});
