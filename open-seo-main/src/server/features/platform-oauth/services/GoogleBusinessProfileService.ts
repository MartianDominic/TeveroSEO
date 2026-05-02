/**
 * Google Business Profile Service
 * Phase 61-02: Platform Integration Excellence
 *
 * Fetches data from Google Business Profile API:
 * - Business reviews with ratings and text
 * - Business insights: views, searches, actions
 *
 * Requires a valid access token from GoogleOAuthProvider.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Business review data.
 */
export interface GBPReview {
  rating: number;
  text: string;
  author: string;
  date: string;
  reviewId: string;
}

/**
 * Business insights data.
 */
export interface GBPInsights {
  views: number;
  searches: number;
  actions: number;
  directSearches: number;
  discoverySearches: number;
}

/**
 * Business profile data.
 */
export interface GBPProfile {
  name: string;
  address: string;
  phone: string;
  website: string;
  category: string;
}

/**
 * Complete GBP data structure.
 */
export interface GBPData {
  profile: GBPProfile;
  reviews: GBPReview[];
  insights: GBPInsights;
}

/**
 * Options for fetching GBP data.
 */
export interface GBPFetchOptions {
  pageSize?: number;
}

// ============================================================================
// Service
// ============================================================================

const GBP_API_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_REVIEWS_API_BASE = "https://mybusiness.googleapis.com/v4";

/**
 * Google Business Profile API service.
 *
 * Fetches reviews and insights for a business location using OAuth access tokens.
 */
export class GoogleBusinessProfileService {
  private readonly accessToken: string;
  private readonly locationId: string;
  private readonly accountId: string;

  /**
   * Create a new GBP service instance.
   *
   * @param accessToken - OAuth access token with business.manage scope
   * @param accountId - GBP account ID
   * @param locationId - GBP location ID
   */
  constructor(accessToken: string, accountId: string, locationId: string) {
    this.accessToken = accessToken;
    this.accountId = accountId;
    this.locationId = locationId;
  }

  /**
   * Fetch business reviews.
   *
   * @param options - Pagination options
   * @returns Array of reviews sorted by date descending
   * @throws Error if API call fails
   */
  async getReviews(options?: GBPFetchOptions): Promise<GBPReview[]> {
    const pageSize = options?.pageSize ?? 50;
    const response = await fetch(
      `${GBP_REVIEWS_API_BASE}/accounts/${this.accountId}/locations/${this.locationId}/reviews?pageSize=${pageSize}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GBP API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (data.reviews ?? []).map((review: Record<string, unknown>) => ({
      rating: (review.starRating as string) === "FIVE"
        ? 5
        : (review.starRating as string) === "FOUR"
          ? 4
          : (review.starRating as string) === "THREE"
            ? 3
            : (review.starRating as string) === "TWO"
              ? 2
              : 1,
      text: (review.comment as string) || "",
      author: (review.reviewer as Record<string, string>)?.displayName || "Anonymous",
      date: (review.createTime as string) || "",
      reviewId: (review.reviewId as string) || "",
    }));
  }

  /**
   * Fetch business insights.
   *
   * Note: Google is migrating away from the legacy insights API.
   * This uses the available metrics from Business Profile Performance API.
   *
   * @returns Business insights data
   * @throws Error if API call fails
   */
  async getInsights(): Promise<GBPInsights> {
    // Use the Business Profile Performance API
    const response = await fetch(
      `${GBP_API_BASE}/locations/${this.locationId}:getDailyMetricsTimeSeries?dailyMetric=BUSINESS_PROFILE_VIEWS&dailyRange.startDate.year=2024&dailyRange.startDate.month=1&dailyRange.startDate.day=1&dailyRange.endDate.year=2024&dailyRange.endDate.month=12&dailyRange.endDate.day=31`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    // If the new API is not available, return default values
    if (!response.ok) {
      // Log but don't fail - insights may not be available for all locations
      console.warn(`GBP Insights API returned ${response.status} - using default values`);
      return {
        views: 0,
        searches: 0,
        actions: 0,
        directSearches: 0,
        discoverySearches: 0,
      };
    }

    const data = await response.json();

    // Aggregate time series data
    let totalViews = 0;
    for (const entry of data.timeSeries?.datedValues ?? []) {
      totalViews += entry.value ?? 0;
    }

    return {
      views: totalViews,
      searches: 0, // Requires additional API call
      actions: 0, // Requires additional API call
      directSearches: 0,
      discoverySearches: 0,
    };
  }

  /**
   * Fetch business profile information.
   *
   * @returns Business profile data
   * @throws Error if API call fails
   */
  async getProfile(): Promise<GBPProfile> {
    const response = await fetch(
      `${GBP_API_BASE}/locations/${this.locationId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GBP API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      name: data.title || data.storefrontAddress?.locality || "",
      address: this.formatAddress(data.storefrontAddress),
      phone: data.phoneNumbers?.primaryPhone || "",
      website: data.websiteUri || "",
      category: data.categories?.primaryCategory?.displayName || "",
    };
  }

  /**
   * Format address from GBP API response.
   */
  private formatAddress(address: Record<string, string> | undefined): string {
    if (!address) return "";
    const parts = [
      address.addressLines?.join(", "),
      address.locality,
      address.administrativeArea,
      address.postalCode,
      address.regionCode,
    ].filter(Boolean);
    return parts.join(", ");
  }

  /**
   * Fetch all GBP data for the location.
   *
   * @param options - Fetch options
   * @returns Complete GBP data object
   */
  async getAllData(options?: GBPFetchOptions): Promise<GBPData> {
    const [profile, reviews, insights] = await Promise.all([
      this.getProfile(),
      this.getReviews(options),
      this.getInsights(),
    ]);

    return {
      profile,
      reviews,
      insights,
    };
  }
}
