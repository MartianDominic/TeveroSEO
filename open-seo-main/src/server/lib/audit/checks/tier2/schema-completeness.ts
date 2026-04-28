/**
 * Tier 2 Schema Completeness (T2-09 to T2-14)
 * Phase 32: 107 SEO Checks Implementation
 *
 * Validates structured data completeness for E-E-A-T signals.
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

      // Handle @graph arrays
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
 * Find schema by type.
 */
function findSchemaByType(schemas: unknown[], type: string): Record<string, unknown> | null {
  for (const schema of schemas) {
    if (typeof schema === "object" && schema !== null) {
      const s = schema as Record<string, unknown>;
      if (s["@type"] === type) {
        return s;
      }
    }
  }
  return null;
}

/**
 * Validate URL format.
 */
function isValidUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * T2-09: author.url to author page
 * Validates author URL exists and is properly formatted.
 */
registerCheck({
  id: "T2-09",
  name: "author.url to author page",
  tier: 2,
  category: "schema-completeness",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add author.url property to Article schema pointing to author bio page",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const article = findSchemaByType(schemas, "Article") ??
      findSchemaByType(schemas, "BlogPosting") ??
      findSchemaByType(schemas, "NewsArticle");

    if (!article) {
      return {
        checkId: "T2-09",
        passed: true,
        severity: "info",
        message: "No Article schema found for author.url check",
        details: { skipped: true, reason: "no-article-schema" },
        autoEditable: false,
      };
    }

    const author = article.author as Record<string, unknown> | undefined;
    if (!author) {
      return {
        checkId: "T2-09",
        passed: false,
        severity: "medium",
        message: "Article schema has no author property",
        details: { hasAuthor: false },
        autoEditable: true,
        editRecipe: "Add author object with url property to Article schema",
      };
    }

    const authorUrl = author.url;
    const hasValidUrl = isValidUrl(authorUrl);

    return {
      checkId: "T2-09",
      passed: hasValidUrl,
      severity: hasValidUrl ? "info" : "medium",
      message: hasValidUrl
        ? `Author has valid URL: ${authorUrl}`
        : "Author missing valid URL property",
      details: {
        hasAuthor: true,
        authorUrl: authorUrl ?? null,
        isValidUrl: hasValidUrl,
      },
      autoEditable: !hasValidUrl,
      editRecipe: hasValidUrl ? undefined : "Add author.url property pointing to author bio page",
    };
  },
});

/**
 * T2-10: author.sameAs has 3+ links
 * Cross-platform verification for E-E-A-T.
 */
registerCheck({
  id: "T2-10",
  name: "author.sameAs has 3+ links",
  tier: 2,
  category: "schema-completeness",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add author.sameAs array with 3+ social/professional profile links",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const article = findSchemaByType(schemas, "Article") ??
      findSchemaByType(schemas, "BlogPosting") ??
      findSchemaByType(schemas, "NewsArticle");

    if (!article) {
      return {
        checkId: "T2-10",
        passed: true,
        severity: "info",
        message: "No Article schema found for author.sameAs check",
        details: { skipped: true, reason: "no-article-schema" },
        autoEditable: false,
      };
    }

    const author = article.author as Record<string, unknown> | undefined;
    if (!author) {
      return {
        checkId: "T2-10",
        passed: false,
        severity: "low",
        message: "Article schema has no author property",
        details: { hasAuthor: false },
        autoEditable: true,
        editRecipe: "Add author object with sameAs array to Article schema",
      };
    }

    const sameAs = author.sameAs;
    const sameAsArray = Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : [];
    const validUrls = sameAsArray.filter(isValidUrl);
    const count = validUrls.length;
    const passed = count >= 3;

    return {
      checkId: "T2-10",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? `Author has ${count} sameAs links (target: 3+)`
        : `Author has only ${count} sameAs links, should have 3+ for cross-platform verification`,
      details: {
        hasAuthor: true,
        sameAsCount: count,
        sameAsLinks: validUrls.slice(0, 5),
        target: 3,
      },
      autoEditable: !passed,
      editRecipe: passed
        ? undefined
        : `Add ${3 - count} more social/professional profile links to author.sameAs`,
    };
  },
});

/**
 * T2-11: author.sameAs includes LinkedIn
 * Required per E-E-A-T documentation.
 */
registerCheck({
  id: "T2-11",
  name: "author.sameAs includes LinkedIn",
  tier: 2,
  category: "schema-completeness",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add LinkedIn profile URL to author.sameAs array",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const article = findSchemaByType(schemas, "Article") ??
      findSchemaByType(schemas, "BlogPosting") ??
      findSchemaByType(schemas, "NewsArticle");

    if (!article) {
      return {
        checkId: "T2-11",
        passed: true,
        severity: "info",
        message: "No Article schema found for LinkedIn check",
        details: { skipped: true, reason: "no-article-schema" },
        autoEditable: false,
      };
    }

    const author = article.author as Record<string, unknown> | undefined;
    if (!author) {
      return {
        checkId: "T2-11",
        passed: false,
        severity: "low",
        message: "Article schema has no author property",
        details: { hasAuthor: false },
        autoEditable: true,
        editRecipe: "Add author object with sameAs including LinkedIn profile",
      };
    }

    const sameAs = author.sameAs;
    const sameAsArray = Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : [];
    const hasLinkedIn = sameAsArray.some(
      (url) => typeof url === "string" && url.toLowerCase().includes("linkedin.com")
    );

    return {
      checkId: "T2-11",
      passed: hasLinkedIn,
      severity: hasLinkedIn ? "info" : "low",
      message: hasLinkedIn
        ? "Author sameAs includes LinkedIn profile"
        : "Author sameAs missing LinkedIn profile (required for E-E-A-T)",
      details: {
        hasAuthor: true,
        hasLinkedIn,
        sameAsLinks: sameAsArray.filter((url) => typeof url === "string").slice(0, 5),
      },
      autoEditable: !hasLinkedIn,
      editRecipe: hasLinkedIn ? undefined : "Add LinkedIn profile URL to author.sameAs array",
    };
  },
});

/**
 * T2-12: Organization sameAs array
 * Check for Wikipedia, LinkedIn, Twitter presence.
 */
registerCheck({
  id: "T2-12",
  name: "Organization sameAs array",
  tier: 2,
  category: "schema-completeness",
  severity: "low",
  autoEditable: true,
  editRecipe: "Add Organization.sameAs array with Wikipedia, LinkedIn, and Twitter links",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const org = findSchemaByType(schemas, "Organization") as Record<string, unknown> | null;

    if (!org) {
      return {
        checkId: "T2-12",
        passed: true,
        severity: "info",
        message: "No Organization schema found for sameAs check",
        details: { skipped: true, reason: "no-organization-schema" },
        autoEditable: false,
      };
    }

    const sameAs = org.sameAs;
    const sameAsArray = Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : [];
    const sameAsLower = sameAsArray
      .filter((url) => typeof url === "string")
      .map((url) => (url as string).toLowerCase());

    const hasWikipedia = sameAsLower.some((url) => url.includes("wikipedia.org"));
    const hasLinkedIn = sameAsLower.some((url) => url.includes("linkedin.com"));
    const hasTwitter = sameAsLower.some((url) => url.includes("twitter.com") || url.includes("x.com"));

    const present = [hasWikipedia && "Wikipedia", hasLinkedIn && "LinkedIn", hasTwitter && "Twitter"]
      .filter(Boolean);
    const missing = [!hasWikipedia && "Wikipedia", !hasLinkedIn && "LinkedIn", !hasTwitter && "Twitter"]
      .filter(Boolean);

    const passed = hasWikipedia && hasLinkedIn && hasTwitter;

    return {
      checkId: "T2-12",
      passed,
      severity: passed ? "info" : "low",
      message: passed
        ? "Organization sameAs has Wikipedia, LinkedIn, and Twitter"
        : `Organization sameAs missing: ${missing.join(", ")}`,
      details: {
        hasOrganization: true,
        sameAsCount: sameAsArray.length,
        hasWikipedia,
        hasLinkedIn,
        hasTwitter,
        present,
        missing,
      },
      autoEditable: !passed,
      editRecipe: passed ? undefined : `Add ${missing.join(", ")} to Organization.sameAs`,
    };
  },
});

/**
 * T2-13: publisher.logo >= 112x112px
 * Google requirement for Article schema.
 */
registerCheck({
  id: "T2-13",
  name: "publisher.logo >= 112x112px",
  tier: 2,
  category: "schema-completeness",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Update publisher.logo to use image at least 112x112 pixels",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const article = findSchemaByType(schemas, "Article") ??
      findSchemaByType(schemas, "BlogPosting") ??
      findSchemaByType(schemas, "NewsArticle");

    if (!article) {
      return {
        checkId: "T2-13",
        passed: true,
        severity: "info",
        message: "No Article schema found for publisher.logo check",
        details: { skipped: true, reason: "no-article-schema" },
        autoEditable: false,
      };
    }

    const publisher = article.publisher as Record<string, unknown> | undefined;
    if (!publisher) {
      return {
        checkId: "T2-13",
        passed: false,
        severity: "medium",
        message: "Article schema has no publisher property",
        details: { hasPublisher: false },
        autoEditable: true,
        editRecipe: "Add publisher object with logo to Article schema",
      };
    }

    const logo = publisher.logo as Record<string, unknown> | string | undefined;
    if (!logo) {
      return {
        checkId: "T2-13",
        passed: false,
        severity: "medium",
        message: "Publisher has no logo property",
        details: { hasPublisher: true, hasLogo: false },
        autoEditable: true,
        editRecipe: "Add logo property to publisher with dimensions >= 112x112px",
      };
    }

    // Logo can be a string URL or an ImageObject
    let width: number | undefined;
    let height: number | undefined;
    let logoUrl: string | undefined;

    if (typeof logo === "string") {
      logoUrl = logo;
      // Can't verify dimensions without fetching - assume passed if URL present
      return {
        checkId: "T2-13",
        passed: true,
        severity: "info",
        message: "Publisher logo URL present (dimensions not verifiable from schema)",
        details: {
          hasPublisher: true,
          hasLogo: true,
          logoUrl,
          dimensionsInSchema: false,
        },
        autoEditable: false,
      };
    } else if (typeof logo === "object") {
      logoUrl = logo.url as string | undefined;
      width = typeof logo.width === "number" ? logo.width : parseInt(String(logo.width), 10);
      height = typeof logo.height === "number" ? logo.height : parseInt(String(logo.height), 10);
    }

    const hasDimensions = !isNaN(width ?? NaN) && !isNaN(height ?? NaN);
    const meetsRequirement = hasDimensions && (width ?? 0) >= 112 && (height ?? 0) >= 112;

    return {
      checkId: "T2-13",
      passed: meetsRequirement || !hasDimensions, // Pass if no dimensions (can't verify)
      severity: meetsRequirement ? "info" : hasDimensions ? "medium" : "info",
      message: meetsRequirement
        ? `Publisher logo is ${width}x${height}px (meets 112x112 requirement)`
        : hasDimensions
          ? `Publisher logo is ${width}x${height}px, should be at least 112x112px`
          : "Publisher logo dimensions not specified in schema",
      details: {
        hasPublisher: true,
        hasLogo: true,
        logoUrl,
        width: width ?? null,
        height: height ?? null,
        meetsRequirement,
        required: "112x112px",
      },
      autoEditable: hasDimensions && !meetsRequirement,
      editRecipe: meetsRequirement ? undefined : "Update publisher.logo to use image at least 112x112 pixels",
    };
  },
});

/**
 * T2-14: citation array on YMYL
 * Check for citation property on health/finance content.
 */
registerCheck({
  id: "T2-14",
  name: "citation array on YMYL",
  tier: 2,
  category: "schema-completeness",
  severity: "medium",
  autoEditable: true,
  editRecipe: "Add citation array with source references for YMYL content",
  run: (ctx: CheckContext): CheckResult => {
    const schemas = extractSchemas(ctx.$);
    const article = findSchemaByType(schemas, "Article") ??
      findSchemaByType(schemas, "BlogPosting") ??
      findSchemaByType(schemas, "NewsArticle") ??
      findSchemaByType(schemas, "MedicalWebPage") ??
      findSchemaByType(schemas, "FinancialProduct");

    // Detect YMYL content from page analysis or URL patterns
    const extendedAnalysis = ctx.pageAnalysis as ExtendedPageAnalysis | undefined;
    const isYmyl =
      extendedAnalysis?.isYmyl ??
      /health|medical|finance|money|legal|safety|news/i.test(ctx.url);

    if (!isYmyl) {
      return {
        checkId: "T2-14",
        passed: true,
        severity: "info",
        message: "Page is not YMYL content, citation check not required",
        details: { isYmyl: false, skipped: true },
        autoEditable: false,
      };
    }

    if (!article) {
      return {
        checkId: "T2-14",
        passed: false,
        severity: "medium",
        message: "YMYL page has no Article schema for citation check",
        details: { isYmyl: true, hasSchema: false },
        autoEditable: true,
        editRecipe: "Add Article schema with citation array for YMYL content",
      };
    }

    const citation = article.citation;
    const citations = Array.isArray(citation) ? citation : citation ? [citation] : [];
    const hasCitations = citations.length > 0;

    return {
      checkId: "T2-14",
      passed: hasCitations,
      severity: hasCitations ? "info" : "medium",
      message: hasCitations
        ? `YMYL content has ${citations.length} citation(s)`
        : "YMYL content missing citation property (required for trust)",
      details: {
        isYmyl: true,
        hasCitations,
        citationCount: citations.length,
      },
      autoEditable: !hasCitations,
      editRecipe: hasCitations ? undefined : "Add citation array with source references for YMYL content",
    };
  },
});

// Export check IDs for documentation
export const schemaCompletenessCheckIds = ["T2-09", "T2-10", "T2-11", "T2-12", "T2-13", "T2-14"];
