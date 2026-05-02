/**
 * Google Search Console Service
 * Phase 61-02: Platform Integration Excellence
 *
 * Fetches data from Google Search Console API:
 * - Search queries with clicks, impressions, CTR, position
 * - Page performance data
 * - Index status (via URL Inspection API)
 *
 * Requires a valid access token from GoogleOAuthProvider.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Search query data from GSC Search Analytics API.
 */
export interface GSCQueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Page performance data from GSC Search Analytics API.
 */
export interface GSCPageData {
  page: string;
  clicks: number;
  impressions: number;
}

/**
 * Index status summary.
 */
export interface GSCIndexStatus {
  indexed: number;
  notIndexed: number;
  errors: string[];
}

/**
 * Core Web Vitals data.
 */
export interface GSCCoreWebVitals {
  lcp: number;
  fid: number;
  cls: number;
  status: "good" | "needs_improvement" | "poor";
}

/**
 * Complete GSC data structure.
 */
export interface GSCData {
  queries: GSCQueryData[];
  pages: GSCPageData[];
  indexStatus: GSCIndexStatus;
  coreWebVitals?: GSCCoreWebVitals;
}

/**
 * Options for fetching search queries.
 */
export interface GetSearchQueriesOptions {
  startDate: string;
  endDate: string;
  rowLimit?: number;
}

/**
 * Options for fetching page performance.
 */
export interface GetPagePerformanceOptions {
  startDate: string;
  endDate: string;
  rowLimit?: number;
}

// ============================================================================
// Service
// ============================================================================

const GSC_API_BASE = "https://www.googleapis.com/webmasters/v3";

/**
 * Google Search Console API service.
 *
 * Fetches search analytics data, page performance, and index status
 * for a specific site using OAuth access tokens.
 */
export class GoogleSearchConsoleService {
  private readonly accessToken: string;
  private readonly siteUrl: string;

  /**
   * Create a new GSC service instance.
   *
   * @param accessToken - OAuth access token with webmasters.readonly scope
   * @param siteUrl - The site URL as registered in GSC (e.g., "https://example.com" or "sc-domain:example.com")
   */
  constructor(accessToken: string, siteUrl: string) {
    this.accessToken = accessToken;
    this.siteUrl = siteUrl;
  }

  /**
   * Fetch search query analytics data.
   *
   * @param options - Query parameters including date range and row limit
   * @returns Array of search query data sorted by clicks descending
   * @throws Error if API call fails
   */
  async getSearchQueries(options: GetSearchQueriesOptions): Promise<GSCQueryData[]> {
    const response = await fetch(
      `${GSC_API_BASE}/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: options.startDate,
          endDate: options.endDate,
          dimensions: ["query"],
          rowLimit: options.rowLimit ?? 1000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GSC API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (data.rows ?? []).map((row: Record<string, unknown>) => ({
      query: (row.keys as string[])[0],
      clicks: row.clicks as number,
      impressions: row.impressions as number,
      ctr: row.ctr as number,
      position: row.position as number,
    }));
  }

  /**
   * Fetch page-level performance data.
   *
   * @param options - Query parameters including date range and row limit
   * @returns Array of page performance data sorted by clicks descending
   * @throws Error if API call fails
   */
  async getPagePerformance(options: GetPagePerformanceOptions): Promise<GSCPageData[]> {
    const response = await fetch(
      `${GSC_API_BASE}/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: options.startDate,
          endDate: options.endDate,
          dimensions: ["page"],
          rowLimit: options.rowLimit ?? 1000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GSC API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (data.rows ?? []).map((row: Record<string, unknown>) => ({
      page: (row.keys as string[])[0],
      clicks: row.clicks as number,
      impressions: row.impressions as number,
    }));
  }

  /**
   * Get index status for the site.
   *
   * Note: This uses the URL Inspection API which has rate limits.
   * For bulk operations, consider using the sitemap data instead.
   *
   * @returns Index status summary with counts and error messages
   * @throws Error if API call fails
   */
  async getIndexStatus(): Promise<GSCIndexStatus> {
    // Use the sitemaps API to get an overview of indexed URLs
    const response = await fetch(
      `${GSC_API_BASE}/sites/${encodeURIComponent(this.siteUrl)}/sitemaps`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GSC API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const sitemaps = data.sitemap ?? [];

    // Aggregate counts from all sitemaps
    let indexed = 0;
    let notIndexed = 0;
    const errors: string[] = [];

    for (const sitemap of sitemaps) {
      if (sitemap.contents) {
        for (const content of sitemap.contents) {
          indexed += content.indexed ?? 0;
          const submitted = content.submitted ?? 0;
          notIndexed += Math.max(0, submitted - (content.indexed ?? 0));
        }
      }
      if (sitemap.errors && sitemap.errors > 0) {
        errors.push(`Sitemap ${sitemap.path}: ${sitemap.errors} errors`);
      }
    }

    return {
      indexed,
      notIndexed,
      errors,
    };
  }

  /**
   * Fetch all GSC data for the site.
   *
   * @param options - Date range options
   * @returns Complete GSC data object
   */
  async getAllData(options: {
    startDate: string;
    endDate: string;
    queryLimit?: number;
    pageLimit?: number;
  }): Promise<GSCData> {
    const [queries, pages, indexStatus] = await Promise.all([
      this.getSearchQueries({
        startDate: options.startDate,
        endDate: options.endDate,
        rowLimit: options.queryLimit,
      }),
      this.getPagePerformance({
        startDate: options.startDate,
        endDate: options.endDate,
        rowLimit: options.pageLimit,
      }),
      this.getIndexStatus(),
    ]);

    return {
      queries,
      pages,
      indexStatus,
    };
  }
}
