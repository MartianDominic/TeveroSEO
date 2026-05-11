/**
 * Tier 1 Technical Basics Checks (T1-55 to T1-59, T1-67)
 * Category J: Technical SEO fundamentals
 * Phase 100: Added runV2 for JSON-based extraction
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, SEODataContext } from "../types";

// T1-67: No noindex meta tag
// NOTE: This check is used by scoring.ts Gate 1 - if this fails, score is capped at 0
// FIX-13 (HIGH-SEO-04): Now also checks X-Robots-Tag HTTP header
registerCheck({
  id: "T1-67",
  name: "No noindex meta tag",
  tier: 1,
  category: "technical-basics",
  severity: "critical",
  autoEditable: true,
  editRecipe: "Remove noindex meta tag or X-Robots-Tag header to allow indexing",
  run: (ctx: CheckContext): CheckResult => {
    const $ = ctx.$;

    // Check for noindex in robots meta tag
    const robotsMeta = $('meta[name="robots"]').attr("content") ?? "";
    const googlebotMeta = $('meta[name="googlebot"]').attr("content") ?? "";

    // Check for noindex directive in meta tags
    const hasMetaNoindex =
      /noindex/i.test(robotsMeta) ||
      /noindex/i.test(googlebotMeta);

    // FIX-13 (HIGH-SEO-04): Check X-Robots-Tag HTTP header
    // The header can be "X-Robots-Tag" or lowercase "x-robots-tag"
    let xRobotsTag: string | null = null;
    let hasHeaderNoindex = false;

    if (ctx.responseHeaders) {
      // Headers may be case-insensitive, check both variations
      xRobotsTag =
        ctx.responseHeaders["X-Robots-Tag"] ||
        ctx.responseHeaders["x-robots-tag"] ||
        ctx.responseHeaders["X-ROBOTS-TAG"] ||
        null;

      if (xRobotsTag) {
        // X-Robots-Tag can have multiple values separated by commas
        // or can specify user-agents like "googlebot: noindex"
        hasHeaderNoindex = /noindex/i.test(xRobotsTag);
      }
    }

    const hasNoindex = hasMetaNoindex || hasHeaderNoindex;
    const passed = !hasNoindex;

    return {
      checkId: "T1-67",
      passed,
      severity: passed ? "info" : "critical",
      message: passed
        ? "Page is indexable (no noindex directive)"
        : hasHeaderNoindex
          ? "Page has noindex in X-Robots-Tag header - will NOT be indexed"
          : "Page has noindex meta tag - will NOT be indexed by search engines",
      details: {
        robotsMeta: robotsMeta || null,
        googlebotMeta: googlebotMeta || null,
        xRobotsTag, // FIX-13: Include header value in details
        hasMetaNoindex,
        hasHeaderNoindex, // FIX-13: Separate flag for header-based noindex
        hasNoindex,
      },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Remove noindex meta tag or X-Robots-Tag header to allow indexing",
    };
  },
  runV2: (ctx: SEODataContext): CheckResult => {
    const hasMetaNoindex = ctx.data.is_noindex;
    const metaRobots = ctx.data.meta_robots;

    // Check X-Robots-Tag HTTP header
    let xRobotsTag: string | null = null;
    let hasHeaderNoindex = false;

    if (ctx.responseHeaders) {
      xRobotsTag =
        ctx.responseHeaders["X-Robots-Tag"] ||
        ctx.responseHeaders["x-robots-tag"] ||
        ctx.responseHeaders["X-ROBOTS-TAG"] ||
        null;

      if (xRobotsTag) {
        hasHeaderNoindex = /noindex/i.test(xRobotsTag);
      }
    }

    const hasNoindex = hasMetaNoindex || hasHeaderNoindex;
    const passed = !hasNoindex;

    return {
      checkId: "T1-67",
      passed,
      severity: passed ? "info" : "critical",
      message: passed
        ? "Page is indexable (no noindex directive)"
        : hasHeaderNoindex
          ? "Page has noindex in X-Robots-Tag header - will NOT be indexed"
          : "Page has noindex meta tag - will NOT be indexed by search engines",
      details: {
        metaRobots,
        xRobotsTag,
        hasMetaNoindex,
        hasHeaderNoindex,
        hasNoindex,
      },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Remove noindex meta tag or X-Robots-Tag header to allow indexing",
    };
  },
});

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
  runV2: (ctx: SEODataContext): CheckResult => {
    const hasCanonical = ctx.data.has_canonical;
    const canonicalUrl = ctx.data.canonical?.url;

    if (!hasCanonical || !canonicalUrl) {
      return {
        checkId: "T1-55",
        passed: false,
        severity: "critical",
        message: "No canonical tag found",
        autoEditable: true,
        editRecipe: "Add self-referencing canonical tag",
      };
    }

    // Use pre-computed is_self_referencing from Scrapling
    const passed = ctx.data.canonical?.is_self_referencing ?? false;

    return {
      checkId: "T1-55",
      passed,
      severity: passed ? "info" : "critical",
      message: passed ? "Canonical is self-referencing" : "Canonical does not match current URL",
      details: { canonical: canonicalUrl, pageUrl: ctx.url },
      autoEditable: !passed,
      editRecipe: passed ? undefined : "Set canonical to match the current page URL",
    };
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
  runV2: (ctx: SEODataContext): CheckResult => {
    const canonicalUrl = ctx.data.canonical?.url;
    if (!canonicalUrl) {
      return { checkId: "T1-56", passed: true, severity: "info", message: "No canonical tag found", autoEditable: false };
    }
    const passed = /^https?:\/\//i.test(canonicalUrl);
    return {
      checkId: "T1-56",
      passed,
      severity: passed ? "info" : "high",
      message: passed ? "Canonical is absolute URL" : "Canonical is relative (should be absolute)",
      details: { canonical: canonicalUrl },
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
  runV2: (ctx: SEODataContext): CheckResult => {
    try {
      // Use final_url if available (after redirects), otherwise use url
      const urlToCheck = ctx.data.final_url || ctx.url;
      const urlObj = new URL(urlToCheck);
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
  runV2: (ctx: SEODataContext): CheckResult => {
    // Count http:// resources in images, internal links, and external links
    let httpResources = 0;

    // Check images
    for (const img of ctx.data.images) {
      if (img.src.startsWith("http://") && !img.src.includes("localhost")) {
        httpResources++;
      }
    }

    // Check internal links
    for (const link of ctx.data.internal_links) {
      if (link.href.startsWith("http://") && !link.href.includes("localhost")) {
        httpResources++;
      }
    }

    // Check external links
    for (const link of ctx.data.external_links) {
      if (link.href.startsWith("http://") && !link.href.includes("localhost")) {
        httpResources++;
      }
    }

    // Check resource hints (preload, preconnect)
    for (const hint of ctx.data.resource_hints) {
      if (hint.href.startsWith("http://") && !hint.href.includes("localhost")) {
        httpResources++;
      }
    }

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
  runV2: (ctx: SEODataContext): CheckResult => {
    const passed = ctx.data.has_viewport;
    const content = ctx.data.viewport;
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
