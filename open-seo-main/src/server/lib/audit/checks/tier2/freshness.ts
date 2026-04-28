/**
 * Tier 2 Freshness Signals (T2-15 to T2-17)
 * Phase 32: 107 SEO Checks Implementation
 *
 * Validates freshness signal consistency for triangulation.
 */
import { registerCheck } from "../registry";
import type { CheckContext, CheckResult, ExtendedPageAnalysis } from "../types";

/**
 * Extract JSON-LD schemas from page.
 */
function extractSchemas($: CheckContext["$"]): unknown[] {
  const schemas: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const content = $(el).text();
      const parsed = JSON.parse(content);

      if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
        schemas.push(...parsed["@graph"]);
      } else {
        schemas.push(parsed);
      }
    } catch {
      // Invalid JSON, skip
    }
  });

  return schemas;
}

/**
 * Find Article schema.
 */
function findArticleSchema(schemas: unknown[]): Record<string, unknown> | null {
  const types = ["Article", "BlogPosting", "NewsArticle"];
  for (const schema of schemas) {
    if (typeof schema === "object" && schema !== null) {
      const s = schema as Record<string, unknown>;
      if (types.includes(s["@type"] as string)) {
        return s;
      }
    }
  }
  return null;
}

/**
 * Parse date string to Date object.
 */
function parseDate(dateStr: unknown): Date | null {
  if (typeof dateStr !== "string") return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

/**
 * Extract visible date from page content.
 * Looks for common date patterns in text.
 */
function extractVisibleDate($: CheckContext["$"]): string | null {
  // Common date element patterns
  const dateSelectors = [
    "time[datetime]",
    "[class*='date']",
    "[class*='Date']",
    "[class*='published']",
    "[class*='modified']",
    "[class*='updated']",
    "meta[name='date']",
    "meta[property='article:modified_time']",
    "meta[property='article:published_time']",
  ];

  for (const selector of dateSelectors) {
    const el = $(selector).first();
    if (el.length) {
      // Try datetime attribute first
      const datetime = el.attr("datetime") ?? el.attr("content");
      if (datetime) return datetime;

      // Try text content
      const text = el.text().trim();
      if (text && /\d{4}/.test(text)) return text;
    }
  }

  // Fallback: look for date patterns in body text
  const bodyText = $("body").text();
  const datePatterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/, // ISO format
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/, // MM/DD/YYYY or DD-MM-YYYY
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i, // Month DD, YYYY
  ];

  for (const pattern of datePatterns) {
    const match = bodyText.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Compare two dates, allowing for timezone differences.
 * Returns true if dates are within 24 hours of each other.
 */
function datesMatch(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;

  const diff = Math.abs(date1.getTime() - date2.getTime());
  const oneDay = 24 * 60 * 60 * 1000;

  return diff <= oneDay;
}

/**
 * T2-15: Visible date matches schema date
 * Triangulation check - byline date should match dateModified.
 */
registerCheck({
  id: "T2-15",
  name: "Visible date matches schema date",
  tier: 2,
  category: "freshness",
  severity: "low",
  autoEditable: true,
  editRecipe: "Update visible date on page to match schema dateModified",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const article = findArticleSchema(schemas);

    if (!article) {
      return {
        checkId: "T2-15",
        passed: true,
        severity: "info",
        message: "No Article schema found for date triangulation",
        details: { skipped: true, reason: "no-article-schema" },
        autoEditable: false,
      };
    }

    const schemaDate = article.dateModified ?? article.datePublished;
    const schemaDateParsed = parseDate(schemaDate);

    if (!schemaDateParsed) {
      return {
        checkId: "T2-15",
        passed: true,
        severity: "info",
        message: "No schema date found for triangulation",
        details: { skipped: true, reason: "no-schema-date" },
        autoEditable: false,
      };
    }

    const visibleDate = extractVisibleDate(ctx.$);
    const visibleDateParsed = visibleDate ? parseDate(visibleDate) : null;

    if (!visibleDateParsed) {
      return {
        checkId: "T2-15",
        passed: false,
        severity: "low",
        message: "No visible date found on page for triangulation with schema",
        details: {
          schemaDate: schemaDate as string,
          visibleDate: null,
        },
        autoEditable: true,
        editRecipe: "Add visible date element that matches schema dateModified",
      };
    }

    const matches = datesMatch(schemaDateParsed, visibleDateParsed);

    return {
      checkId: "T2-15",
      passed: matches,
      severity: matches ? "info" : "low",
      message: matches
        ? "Visible date matches schema date (triangulation pass)"
        : "Visible date does not match schema date (triangulation mismatch)",
      details: {
        schemaDate: schemaDate as string,
        visibleDate,
        schemaDateParsed: schemaDateParsed.toISOString(),
        visibleDateParsed: visibleDateParsed.toISOString(),
        matches,
      },
      autoEditable: !matches,
      editRecipe: matches ? undefined : "Update visible date on page to match schema dateModified",
    };
  },
});

/**
 * T2-16: sitemap lastmod matches schema
 * Requires sitemap data in context.
 */
registerCheck({
  id: "T2-16",
  name: "sitemap lastmod matches schema",
  tier: 2,
  category: "freshness",
  severity: "low",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    // This check requires sitemap data which isn't available in page-only context
    const extendedAnalysis = ctx.pageAnalysis as ExtendedPageAnalysis | undefined;
    const sitemapLastmod = extendedAnalysis?.sitemapLastmod;

    if (!sitemapLastmod) {
      return {
        checkId: "T2-16",
        passed: true,
        severity: "info",
        message: "Sitemap lastmod data not available in context",
        details: { skipped: true, reason: "no-sitemap-data" },
        autoEditable: false,
      };
    }

    const schemas = extractSchemas(ctx.$);
    const article = findArticleSchema(schemas);

    if (!article) {
      return {
        checkId: "T2-16",
        passed: true,
        severity: "info",
        message: "No Article schema found for sitemap triangulation",
        details: { skipped: true, reason: "no-article-schema" },
        autoEditable: false,
      };
    }

    const schemaDate = article.dateModified ?? article.datePublished;
    const schemaDateParsed = parseDate(schemaDate);
    const sitemapDateParsed = parseDate(sitemapLastmod);

    if (!schemaDateParsed || !sitemapDateParsed) {
      return {
        checkId: "T2-16",
        passed: true,
        severity: "info",
        message: "Cannot parse dates for sitemap triangulation",
        details: {
          schemaDate: schemaDate as string | null,
          sitemapLastmod,
        },
        autoEditable: false,
      };
    }

    const matches = datesMatch(schemaDateParsed, sitemapDateParsed);

    return {
      checkId: "T2-16",
      passed: matches,
      severity: matches ? "info" : "low",
      message: matches
        ? "Sitemap lastmod matches schema date"
        : "Sitemap lastmod does not match schema date (inconsistent freshness signals)",
      details: {
        schemaDate: schemaDate as string,
        sitemapLastmod,
        matches,
      },
      autoEditable: false,
    };
  },
});

/**
 * T2-17: No date-only updates
 * Flag if dateModified changed but content hash same (requires historical data).
 */
registerCheck({
  id: "T2-17",
  name: "No date-only updates",
  tier: 2,
  category: "freshness",
  severity: "medium",
  autoEditable: false,
  run: (ctx: CheckContext): CheckResult => {
    // This check requires historical data (previous content hash)
    const extendedAnalysis = ctx.pageAnalysis as ExtendedPageAnalysis | undefined;
    const previousContentHash = extendedAnalysis?.previousContentHash;
    const currentContentHash = extendedAnalysis?.contentHash;
    const previousDateModified = extendedAnalysis?.previousDateModified;

    if (!previousContentHash || !currentContentHash || !previousDateModified) {
      return {
        checkId: "T2-17",
        passed: true,
        severity: "info",
        message: "Historical data not available for date-only update detection",
        details: { skipped: true, reason: "no-historical-data" },
        autoEditable: false,
      };
    }

    const schemas = extractSchemas(ctx.$);
    const article = findArticleSchema(schemas);

    if (!article || !article.dateModified) {
      return {
        checkId: "T2-17",
        passed: true,
        severity: "info",
        message: "No dateModified in schema for comparison",
        details: { skipped: true, reason: "no-date-modified" },
        autoEditable: false,
      };
    }

    const currentDate = article.dateModified as string;
    const dateChanged = currentDate !== previousDateModified;
    const contentChanged = currentContentHash !== previousContentHash;

    // Flag if date changed but content didn't (date-only update = gaming)
    const isDateOnlyUpdate = dateChanged && !contentChanged;

    return {
      checkId: "T2-17",
      passed: !isDateOnlyUpdate,
      severity: isDateOnlyUpdate ? "medium" : "info",
      message: isDateOnlyUpdate
        ? "Date updated without content change (potential freshness gaming)"
        : dateChanged
          ? "Date and content both updated (legitimate update)"
          : "No date change detected",
      details: {
        dateChanged,
        contentChanged,
        isDateOnlyUpdate,
        currentDate,
        previousDate: previousDateModified,
      },
      autoEditable: false,
    };
  },
});

// Export check IDs for documentation
export const freshnessCheckIds = ["T2-15", "T2-16", "T2-17"];
