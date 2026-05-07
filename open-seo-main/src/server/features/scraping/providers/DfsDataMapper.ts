/**
 * DataForSEO Data Mapper
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Maps DataForSEO OnPage API responses to our internal SEO data structures.
 * Enables pre-parsed data usage for ~60% of SEO checks, avoiding HTML parsing.
 */

import type {
  DataForSEOParsedData,
  DfsOnPageResultItem,
  DfsLinkData,
  DfsImageData,
  DfsResourceData,
} from "./DataForSEOFetcher.types";

// =============================================================================
// Response Mapper
// =============================================================================

/**
 * Map a DataForSEO OnPage result item to our internal parsed data structure.
 *
 * @param item - Raw DFS OnPage result item
 * @returns Mapped parsed data
 */
export function mapDfsResultToParsedData(
  item: DfsOnPageResultItem
): DataForSEOParsedData {
  const meta = item.meta ?? {};
  const links = item.links ?? {};
  const resources = item.resources ?? {};
  const pageTiming = item.page_timing ?? {};

  return {
    // Meta Information
    title: meta.title ?? "",
    titleLength: (meta.title ?? "").length,
    metaDescription: meta.description ?? "",
    metaDescriptionLength: (meta.description ?? "").length,
    canonical: meta.canonical ?? null,
    language: meta.language ?? null,
    charset: meta.charset ?? null,

    // Headings
    h1: meta.htags?.h1 ?? [],
    h2: meta.htags?.h2 ?? [],
    h3: meta.htags?.h3 ?? [],
    h4: meta.htags?.h4 ?? [],
    h5: meta.htags?.h5 ?? [],
    h6: meta.htags?.h6 ?? [],

    // Content Metrics
    wordCount: meta.content?.plain_text_word_count ?? 0,
    plainTextSize: meta.content?.plain_text_size ?? 0,
    plainTextRate: meta.content?.plain_text_rate ?? 0,

    // Links
    internalLinks: mapLinks(links.internal ?? []),
    externalLinks: mapLinks(links.external ?? []),

    // Media (optional, requires loadResources)
    images: resources.images ? mapImages(resources.images) : undefined,
    scripts: resources.scripts ? mapResources(resources.scripts) : undefined,
    stylesheets: resources.stylesheets
      ? mapResources(resources.stylesheets)
      : undefined,

    // Social Meta
    openGraph: {
      title: meta.open_graph?.title,
      description: meta.open_graph?.description,
      image: meta.open_graph?.image,
      type: meta.open_graph?.type,
      url: meta.open_graph?.url,
      siteName: meta.open_graph?.site_name,
    },
    twitterCard: {
      card: meta.twitter_card?.card,
      title: meta.twitter_card?.title,
      description: meta.twitter_card?.description,
      image: meta.twitter_card?.image,
      site: meta.twitter_card?.site,
      creator: meta.twitter_card?.creator,
    },

    // Technical SEO
    robotsDirectives: parseRobotsDirectives(
      meta.robots_txt ?? "",
      meta.x_robots_tag ?? null
    ),
    xRobotsTag: meta.x_robots_tag ?? null,

    // Performance
    pageTiming: {
      timeToInteractive: pageTiming.time_to_interactive ?? null,
      domComplete: pageTiming.dom_complete ?? null,
      lcp: pageTiming.largest_contentful_paint ?? null,
      connectionTime: pageTiming.connection_time ?? null,
      timeToSecureConnection: pageTiming.time_to_secure_connection ?? null,
    },
  };
}

// =============================================================================
// Helper Mappers
// =============================================================================

/**
 * Map DFS link array to our link data structure.
 */
function mapLinks(
  links: Array<{ url: string; anchor?: string; nofollow?: boolean }>
): DfsLinkData[] {
  return links.map((link) => ({
    url: link.url,
    anchor: link.anchor ?? "",
    nofollow: link.nofollow ?? false,
    sponsored: false, // DFS doesn't provide this directly
    ugc: false, // DFS doesn't provide this directly
  }));
}

/**
 * Map DFS image array to our image data structure.
 */
function mapImages(
  images: Array<{ src: string; alt?: string; size?: number }>
): DfsImageData[] {
  return images.map((img) => ({
    src: img.src,
    alt: img.alt ?? "",
    size: img.size,
    width: undefined, // DFS doesn't always provide dimensions
    height: undefined,
  }));
}

/**
 * Map DFS resource array to our resource data structure.
 */
function mapResources(
  resources: Array<{ src: string; size?: number }>
): DfsResourceData[] {
  return resources.map((res) => ({
    src: res.src,
    size: res.size,
  }));
}

/**
 * Parse robots directives from meta robots and X-Robots-Tag.
 */
function parseRobotsDirectives(
  metaRobots: string,
  xRobotsTag: string | null
): string[] {
  const directives: Set<string> = new Set();

  // Parse meta robots
  if (metaRobots) {
    const parts = metaRobots
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    parts.forEach((d) => directives.add(d));
  }

  // Parse X-Robots-Tag
  if (xRobotsTag) {
    const parts = xRobotsTag
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    parts.forEach((d) => directives.add(d));
  }

  return Array.from(directives);
}

// =============================================================================
// SEO Check Dependency Mapping
// =============================================================================

/**
 * Defines which data source each SEO check requires.
 * - usesPreparsed: Can use DataForSEO pre-parsed data
 * - usesRawHtml: Requires HTML parsing (Cheerio)
 * - preparsedFields: Which parsed data fields are needed
 */
export interface SeoCheckDependencies {
  /** Check can use pre-parsed data from DFS */
  usesPreparsed: boolean;

  /** Check requires raw HTML parsing */
  usesRawHtml: boolean;

  /** Which pre-parsed fields are needed */
  preparsedFields: string[];
}

/**
 * Maps SEO check IDs to their data dependencies.
 * Used to determine if HTML parsing can be skipped.
 *
 * Categories:
 * - T1-xx: Page Structure checks
 * - T2-xx: Site-wide checks
 * - T3-xx: Performance checks
 * - T4-xx: Security checks
 * - T5-xx: Content Quality checks
 */
export const CHECK_DEPENDENCIES: Record<string, SeoCheckDependencies> = {
  // =========================================================================
  // T1: Page Structure - Title & Meta
  // =========================================================================
  "T1-01": {
    // title-exists
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["title"],
  },
  "T1-02": {
    // title-length
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["title", "titleLength"],
  },
  "T1-03": {
    // title-keyword
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["title"],
  },
  "T1-04": {
    // meta-description-exists
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["metaDescription"],
  },
  "T1-05": {
    // meta-description-length
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["metaDescription", "metaDescriptionLength"],
  },
  "T1-06": {
    // meta-description-keyword
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["metaDescription"],
  },

  // =========================================================================
  // T1: Page Structure - Headings
  // =========================================================================
  "T1-10": {
    // h1-exists
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["h1"],
  },
  "T1-11": {
    // h1-count
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["h1"],
  },
  "T1-12": {
    // h1-keyword
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["h1"],
  },
  "T1-13": {
    // heading-hierarchy
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["h1", "h2", "h3", "h4", "h5", "h6"],
  },
  "T1-14": {
    // h2-exists
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["h2"],
  },

  // =========================================================================
  // T1: Page Structure - URLs & Canonicals
  // =========================================================================
  "T1-20": {
    // canonical-exists
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["canonical"],
  },
  "T1-21": {
    // canonical-self-referencing
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["canonical"],
  },
  "T1-22": {
    // url-length
    usesPreparsed: false,
    usesRawHtml: false, // Uses URL directly
    preparsedFields: [],
  },
  "T1-23": {
    // url-readable
    usesPreparsed: false,
    usesRawHtml: false,
    preparsedFields: [],
  },

  // =========================================================================
  // T1: Page Structure - Content
  // =========================================================================
  "T1-30": {
    // word-count
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["wordCount"],
  },
  "T1-31": {
    // thin-content
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["wordCount"],
  },
  "T1-32": {
    // text-html-ratio
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["plainTextRate"],
  },

  // =========================================================================
  // T1: Page Structure - Links
  // =========================================================================
  "T1-40": {
    // internal-links-count
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["internalLinks"],
  },
  "T1-41": {
    // external-links-count
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["externalLinks"],
  },
  "T1-42": {
    // nofollow-ratio
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["internalLinks", "externalLinks"],
  },
  "T1-43": {
    // orphan-page (needs site-wide data)
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["internalLinks"],
  },

  // =========================================================================
  // T1: Page Structure - Images
  // =========================================================================
  "T1-50": {
    // images-alt-exists
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["images"],
  },
  "T1-51": {
    // images-alt-keyword (needs semantic analysis)
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T1-52": {
    // images-count
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["images"],
  },

  // =========================================================================
  // T1: Page Structure - Social/Open Graph
  // =========================================================================
  "T1-60": {
    // og-title
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["openGraph"],
  },
  "T1-61": {
    // og-description
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["openGraph"],
  },
  "T1-62": {
    // og-image
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["openGraph"],
  },
  "T1-63": {
    // twitter-card
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["twitterCard"],
  },

  // =========================================================================
  // T1: Page Structure - Robots
  // =========================================================================
  "T1-70": {
    // robots-index
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["robotsDirectives"],
  },
  "T1-71": {
    // robots-follow
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["robotsDirectives"],
  },
  "T1-72": {
    // x-robots-tag
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["xRobotsTag"],
  },

  // =========================================================================
  // T3: Performance
  // =========================================================================
  "T3-01": {
    // lcp
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["pageTiming"],
  },
  "T3-02": {
    // tti
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["pageTiming"],
  },
  "T3-03": {
    // dom-complete
    usesPreparsed: true,
    usesRawHtml: false,
    preparsedFields: ["pageTiming"],
  },

  // =========================================================================
  // Checks Requiring Raw HTML (40% of checks)
  // =========================================================================
  "T1-33": {
    // keyword-in-strong
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T1-34": {
    // keyword-position (first 100 words)
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-01": {
    // e-e-a-t-signals
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-02": {
    // author-bio
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-03": {
    // schema-validation
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-04": {
    // content-uniqueness
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-05": {
    // boilerplate-ratio
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-06": {
    // above-the-fold
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-07": {
    // cta-detection
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-08": {
    // anchor-context
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-09": {
    // internal-link-patterns
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-10": {
    // structured-data-completeness
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-11": {
    // ai-slop-detection
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-12": {
    // information-gain
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
  "T5-13": {
    // prove-it-details
    usesPreparsed: false,
    usesRawHtml: true,
    preparsedFields: [],
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a set of checks can be run entirely from pre-parsed data.
 *
 * @param checkIds - Array of check IDs to run
 * @returns True if all checks can use pre-parsed data
 */
export function canUsePreparsedOnly(checkIds: string[]): boolean {
  return checkIds.every((id) => {
    const deps = CHECK_DEPENDENCIES[id];
    return deps?.usesPreparsed === true && deps?.usesRawHtml === false;
  });
}

/**
 * Get the list of checks that require raw HTML.
 *
 * @param checkIds - Array of check IDs to run
 * @returns Array of check IDs that need HTML parsing
 */
export function getHtmlRequiredChecks(checkIds: string[]): string[] {
  return checkIds.filter((id) => {
    const deps = CHECK_DEPENDENCIES[id];
    return deps?.usesRawHtml === true;
  });
}

/**
 * Get the list of pre-parsed fields needed for a set of checks.
 *
 * @param checkIds - Array of check IDs to run
 * @returns Set of pre-parsed field names needed
 */
export function getRequiredPreparsedFields(checkIds: string[]): Set<string> {
  const fields = new Set<string>();

  for (const id of checkIds) {
    const deps = CHECK_DEPENDENCIES[id];
    if (deps?.usesPreparsed) {
      deps.preparsedFields.forEach((f) => fields.add(f));
    }
  }

  return fields;
}

/**
 * Calculate the percentage of checks that can use pre-parsed data.
 *
 * @param checkIds - Array of check IDs to run
 * @returns Percentage (0-100) of checks using pre-parsed data
 */
export function calculatePreparsedCoverage(checkIds: string[]): number {
  if (checkIds.length === 0) return 100;

  const preparsedCount = checkIds.filter((id) => {
    const deps = CHECK_DEPENDENCIES[id];
    return deps?.usesPreparsed === true;
  }).length;

  return Math.round((preparsedCount / checkIds.length) * 100);
}

/**
 * Validate that parsed data has all required fields for given checks.
 *
 * @param parsedData - Pre-parsed data from DFS
 * @param checkIds - Array of check IDs to run
 * @returns Object with validation result and missing fields
 */
export function validateParsedDataForChecks(
  parsedData: DataForSEOParsedData,
  checkIds: string[]
): { valid: boolean; missingFields: string[] } {
  const requiredFields = getRequiredPreparsedFields(checkIds);
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = getNestedValue(parsedData, field);
    if (value === undefined || value === null) {
      // Allow empty arrays and empty strings
      if (!Array.isArray(value) && value !== "") {
        missingFields.push(field);
      }
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
