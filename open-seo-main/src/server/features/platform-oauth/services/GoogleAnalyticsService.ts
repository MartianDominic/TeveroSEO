/**
 * Google Analytics Service
 * Phase 61-02: Platform Integration Excellence
 *
 * Fetches data from Google Analytics Data API (GA4):
 * - Overview metrics: sessions, users, pageviews, bounce rate
 * - Top pages with pageviews and time on page
 * - Traffic sources with sessions by source/medium
 *
 * Requires a valid access token from GoogleOAuthProvider.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Overview metrics from GA4.
 */
export interface GAOverview {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
}

/**
 * Page-level analytics data.
 */
export interface GAPageData {
  path: string;
  pageviews: number;
  avgTimeOnPage: number;
}

/**
 * Traffic source data.
 */
export interface GATrafficSource {
  source: string;
  medium: string;
  sessions: number;
}

/**
 * Conversion/goal data (optional).
 */
export interface GAConversion {
  goal: string;
  completions: number;
  conversionRate: number;
}

/**
 * Complete GA data structure.
 */
export interface GAData {
  overview: GAOverview;
  topPages: GAPageData[];
  trafficSources: GATrafficSource[];
  conversions?: GAConversion[];
}

/**
 * Options for fetching GA data.
 */
export interface GAFetchOptions {
  startDate: string;
  endDate: string;
  limit?: number;
}

// ============================================================================
// Service
// ============================================================================

const GA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

/**
 * Google Analytics 4 API service.
 *
 * Fetches analytics data for a GA4 property using OAuth access tokens.
 */
export class GoogleAnalyticsService {
  private readonly accessToken: string;
  private readonly propertyId: string;

  /**
   * Create a new GA4 service instance.
   *
   * @param accessToken - OAuth access token with analytics.readonly scope
   * @param propertyId - GA4 property ID (e.g., "123456789")
   */
  constructor(accessToken: string, propertyId: string) {
    this.accessToken = accessToken;
    this.propertyId = propertyId;
  }

  /**
   * Fetch overview metrics.
   *
   * @param options - Date range options
   * @returns Overview metrics for the date range
   * @throws Error if API call fails
   */
  async getOverview(options: GAFetchOptions): Promise<GAOverview> {
    const response = await fetch(
      `${GA_API_BASE}/properties/${this.propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: options.startDate,
              endDate: options.endDate,
            },
          ],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GA API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const row = data.rows?.[0];

    if (!row) {
      return {
        sessions: 0,
        users: 0,
        pageviews: 0,
        bounceRate: 0,
        avgSessionDuration: 0,
      };
    }

    const values = row.metricValues || [];
    return {
      sessions: parseFloat(values[0]?.value || "0"),
      users: parseFloat(values[1]?.value || "0"),
      pageviews: parseFloat(values[2]?.value || "0"),
      bounceRate: parseFloat(values[3]?.value || "0"),
      avgSessionDuration: parseFloat(values[4]?.value || "0"),
    };
  }

  /**
   * Fetch top pages by pageviews.
   *
   * @param options - Date range and limit options
   * @returns Array of page data sorted by pageviews descending
   * @throws Error if API call fails
   */
  async getTopPages(options: GAFetchOptions): Promise<GAPageData[]> {
    const response = await fetch(
      `${GA_API_BASE}/properties/${this.propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: options.startDate,
              endDate: options.endDate,
            },
          ],
          dimensions: [{ name: "pagePath" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "averageSessionDuration" },
          ],
          limit: options.limit ?? 100,
          orderBys: [
            {
              metric: { metricName: "screenPageViews" },
              desc: true,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GA API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (data.rows ?? []).map((row: Record<string, unknown>) => {
      const dimensionValues = row.dimensionValues as Array<{ value: string }>;
      const metricValues = row.metricValues as Array<{ value: string }>;
      return {
        path: dimensionValues[0]?.value || "",
        pageviews: parseFloat(metricValues[0]?.value || "0"),
        avgTimeOnPage: parseFloat(metricValues[1]?.value || "0"),
      };
    });
  }

  /**
   * Fetch traffic sources.
   *
   * @param options - Date range and limit options
   * @returns Array of traffic sources sorted by sessions descending
   * @throws Error if API call fails
   */
  async getTrafficSources(options: GAFetchOptions): Promise<GATrafficSource[]> {
    const response = await fetch(
      `${GA_API_BASE}/properties/${this.propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: options.startDate,
              endDate: options.endDate,
            },
          ],
          dimensions: [
            { name: "sessionSource" },
            { name: "sessionMedium" },
          ],
          metrics: [{ name: "sessions" }],
          limit: options.limit ?? 50,
          orderBys: [
            {
              metric: { metricName: "sessions" },
              desc: true,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GA API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (data.rows ?? []).map((row: Record<string, unknown>) => {
      const dimensionValues = row.dimensionValues as Array<{ value: string }>;
      const metricValues = row.metricValues as Array<{ value: string }>;
      return {
        source: dimensionValues[0]?.value || "(direct)",
        medium: dimensionValues[1]?.value || "(none)",
        sessions: parseFloat(metricValues[0]?.value || "0"),
      };
    });
  }

  /**
   * Fetch all GA data for the property.
   *
   * @param options - Date range options
   * @returns Complete GA data object
   */
  async getAllData(options: GAFetchOptions): Promise<GAData> {
    const [overview, topPages, trafficSources] = await Promise.all([
      this.getOverview(options),
      this.getTopPages(options),
      this.getTrafficSources(options),
    ]);

    return {
      overview,
      topPages,
      trafficSources,
    };
  }
}
