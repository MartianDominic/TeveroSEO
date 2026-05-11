/**
 * ScraplingClient - TypeScript client for Scrapling SEO Engine
 * Phase 100: 3-Tier Residential-First Architecture
 *
 * Connects to the Python FastAPI service for SEO data extraction.
 * Server IP NEVER touches target sites - all traffic via Geonode residential proxy.
 *
 * Tiers:
 * - T0: Scrapling Fetcher + Geonode residential (98% success, $0.77/GB)
 * - T1: Camoufox + Geonode residential (88% Cloudflare bypass)
 * - T2: DataForSEO (handled locally in TypeScript - 100% nuclear)
 */

// =============================================================================
// Types (mirror Python Pydantic models)
// =============================================================================

export interface LinkData {
  href: string;
  text: string;
  rel: string | null;
  is_nofollow: boolean;
  is_sponsored: boolean;
  is_ugc: boolean;
  is_external: boolean;
}

export interface ImageData {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  is_lazy: boolean;
  has_alt: boolean;
  file_size_kb: number | null;
}

export interface HeadingData {
  level: number;
  text: string;
  word_count: number;
}

export interface SchemaOrgData {
  type: string;
  raw: Record<string, unknown>;
  is_valid: boolean;
  errors: string[];
}

export interface MetaTagData {
  name: string | null;
  property: string | null;
  content: string;
}

export interface OpenGraphData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
  site_name: string | null;
}

export interface TwitterCardData {
  card: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  site: string | null;
  creator: string | null;
}

export interface CanonicalData {
  url: string | null;
  is_self_referencing: boolean;
  has_trailing_slash_mismatch: boolean;
}

export interface HreflangData {
  lang: string;
  url: string;
  is_valid: boolean;
}

export interface ResourceHint {
  rel: string;
  href: string;
  as_type: string | null;
}

/**
 * Comprehensive SEO data extracted from a page.
 * TypeScript runs 109 checks against this JSON - no HTML parsing needed.
 */
export interface SEOExtractionResult {
  // Request metadata
  url: string;
  final_url: string;
  status_code: number;
  tier_used: "residential" | "camoufox" | "dataforseo" | "test";
  extracted_at: string;
  extraction_ms: number;

  // Title
  title: string | null;
  title_length: number;
  title_word_count: number;

  // Meta description
  meta_description: string | null;
  meta_description_length: number;
  meta_description_word_count: number;

  // Headings
  h1_text: string | null;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  h4_count: number;
  h5_count: number;
  h6_count: number;
  headings: HeadingData[];

  // Content
  intro_text: string | null;
  body_text: string;
  word_count: number;
  sentence_count: number;
  paragraph_count: number;
  reading_time_minutes: number;

  // Links
  internal_links: LinkData[];
  external_links: LinkData[];
  internal_link_count: number;
  external_link_count: number;
  nofollow_link_count: number;
  broken_link_count: number;

  // Images
  images: ImageData[];
  image_count: number;
  images_without_alt: number;
  images_with_lazy_loading: number;

  // Structured data
  schemas: SchemaOrgData[];
  schema_types: string[];
  has_schema: boolean;

  // Meta tags
  meta_tags: MetaTagData[];
  meta_robots: string | null;
  is_noindex: boolean;
  is_nofollow: boolean;

  // Social
  og_data: OpenGraphData | null;
  twitter_data: TwitterCardData | null;
  has_og_tags: boolean;
  has_twitter_cards: boolean;

  // Canonical & hreflang
  canonical: CanonicalData | null;
  has_canonical: boolean;
  hreflang_tags: HreflangData[];
  has_hreflang: boolean;

  // Technical
  doctype: string | null;
  html_lang: string | null;
  charset: string | null;
  viewport: string | null;
  has_viewport: boolean;

  // Performance hints
  resource_hints: ResourceHint[];
  preload_count: number;
  preconnect_count: number;

  // Content quality signals
  has_table_of_contents: boolean;
  has_faq_section: boolean;
  has_author: boolean;
  has_publish_date: boolean;
  has_update_date: boolean;

  // Keyword analysis
  keyword: string | null;
  keyword_in_title: boolean;
  keyword_in_h1: boolean;
  keyword_in_meta_description: boolean;
  keyword_in_first_100_words: boolean;
  keyword_density: number;
  keyword_occurrences: number;

  // HTML element signals (Phase 100 Week 2)
  keyword_in_strong: boolean;
  keyword_in_emphasis: boolean;
  keyword_in_noscript: boolean;

  // Structural element counts
  strong_count: number;
  has_noscript: boolean;
  list_count: number;
  table_count: number;
  blockquote_count: number;

  // CTA detection
  has_cta: boolean;
  cta_count: number;
  has_comparison_table: boolean;

  // Paragraph list for content analysis
  paragraphs: string[];
}

export interface ExtractOptions {
  /** Target keyword for relevance analysis */
  keyword?: string;
  /** Request timeout in ms */
  timeoutMs?: number;
  /** Force a specific tier */
  tier?: "residential" | "camoufox";
}

export interface BatchExtractOptions extends ExtractOptions {
  /** Max concurrent requests */
  concurrency?: number;
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  version: string;
  proxy_configured: boolean;
}

// =============================================================================
// Errors
// =============================================================================

export class ScraplingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public tier: string
  ) {
    super(message);
    this.name = "ScraplingError";
  }
}

export class CloudflareBlockError extends ScraplingError {
  constructor(url: string) {
    super(`Cloudflare protection detected for ${url}`, 403, "residential");
    this.name = "CloudflareBlockError";
  }
}

export class AllTiersExhaustedError extends ScraplingError {
  constructor(url: string) {
    super(`All tiers exhausted for ${url}`, 503, "all");
    this.name = "AllTiersExhaustedError";
  }
}

// =============================================================================
// Client
// =============================================================================

export class ScraplingClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(options?: { baseUrl?: string; defaultTimeoutMs?: number }) {
    this.baseUrl =
      options?.baseUrl ??
      process.env.SCRAPLING_SERVICE_URL ??
      "http://localhost:8001";
    this.defaultTimeout = options?.defaultTimeoutMs ?? 30000;
  }

  /**
   * Check service health.
   */
  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new ScraplingError(
        `Health check failed: ${response.status}`,
        response.status,
        "health"
      );
    }

    return response.json();
  }

  /**
   * Extract SEO data from a URL with automatic tier escalation.
   *
   * T0 (residential) → T1 (camoufox) → throws for T2 (DataForSEO handled locally)
   */
  async extract(
    url: string,
    options: ExtractOptions = {}
  ): Promise<SEOExtractionResult> {
    const timeout = options.timeoutMs ?? this.defaultTimeout;

    // T0: Residential (default)
    try {
      return await this.fetchTier(url, options.tier ?? "residential", {
        keyword: options.keyword,
        timeout,
      });
    } catch (error) {
      if (this.isCloudflareBlock(error)) {
        // T1: Camoufox (88% Cloudflare bypass)
        try {
          return await this.fetchTier(url, "camoufox", {
            keyword: options.keyword,
            timeout,
          });
        } catch (camoufoxError) {
          // Escalate to DataForSEO (handled by caller)
          throw new AllTiersExhaustedError(url);
        }
      }
      throw error;
    }
  }

  /**
   * Extract SEO data from multiple URLs with concurrency control.
   */
  async batchExtract(
    urls: string[],
    options: BatchExtractOptions = {}
  ): Promise<Map<string, SEOExtractionResult | ScraplingError>> {
    const concurrency = options.concurrency ?? 10;
    const timeout = options.timeoutMs ?? this.defaultTimeout;

    const results = new Map<string, SEOExtractionResult | ScraplingError>();
    const queue = [...urls];

    // Process in batches
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await this.extract(url, {
            keyword: options.keyword,
            timeoutMs: timeout,
            tier: options.tier,
          });
          return { url, result, error: null };
        } catch (error) {
          return {
            url,
            result: null,
            error:
              error instanceof ScraplingError
                ? error
                : new ScraplingError(
                    error instanceof Error ? error.message : String(error),
                    500,
                    "unknown"
                  ),
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      for (const { url, result, error } of batchResults) {
        if (result) {
          results.set(url, result);
        } else if (error) {
          results.set(url, error);
        }
      }
    }

    return results;
  }

  /**
   * Fetch from a specific tier.
   */
  private async fetchTier(
    url: string,
    tier: "residential" | "camoufox",
    options: { keyword?: string; timeout: number }
  ): Promise<SEOExtractionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          tier,
          keyword: options.keyword,
          timeout_ms: options.timeout,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check for Cloudflare-specific errors
        if (response.status === 403) {
          throw new CloudflareBlockError(url);
        }

        throw new ScraplingError(
          `Tier ${tier} failed: ${response.status} - ${errorText}`,
          response.status,
          tier
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if error indicates Cloudflare/bot protection.
   */
  private isCloudflareBlock(error: unknown): boolean {
    if (error instanceof CloudflareBlockError) {
      return true;
    }

    if (error instanceof ScraplingError) {
      return (
        error.statusCode === 403 ||
        error.message.toLowerCase().includes("cloudflare") ||
        error.message.toLowerCase().includes("challenge")
      );
    }

    return false;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

let _client: ScraplingClient | null = null;

export function getScraplingClient(): ScraplingClient {
  if (!_client) {
    _client = new ScraplingClient();
  }
  return _client;
}

/**
 * Create a new ScraplingClient instance (for testing or custom config).
 */
export function createScraplingClient(options?: {
  baseUrl?: string;
  defaultTimeoutMs?: number;
}): ScraplingClient {
  return new ScraplingClient(options);
}
