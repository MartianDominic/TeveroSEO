/**
 * Google Analytics 4 API client for analytics sync.
 *
 * Wraps googleapis analyticsdata v1beta with typed interfaces.
 * Uses OAuth2 access token from internal API.
 *
 * IMPORTANT per RESEARCH.md Pitfall 2 (GA4 Property ID Format):
 * - GA4 expects property ID in format `properties/123456789`
 * - Store numeric ID in DB, format at call time
 */
import { google } from "googleapis";

export interface GA4DateMetrics {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversions: number;
  revenue: number;
}

/**
 * Fetch daily GA4 metrics for a property.
 *
 * @param accessToken - Valid OAuth2 access token
 * @param propertyId - GA4 property ID (numeric, e.g., "123456789")
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 */
export async function fetchGA4Metrics(
  accessToken: string,
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<GA4DateMetrics[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const analyticsdata = google.analyticsdata({ version: "v1beta", auth });

  const response = await analyticsdata.properties.runReport({
    // IMPORTANT: Property ID must be prefixed with "properties/"
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "conversions" },
        { name: "totalRevenue" },
      ],
    },
  });

  return (response.data.rows || []).map((row) => ({
    date: row.dimensionValues![0].value!,
    sessions: parseInt(row.metricValues![0].value || "0", 10),
    users: parseInt(row.metricValues![1].value || "0", 10),
    newUsers: parseInt(row.metricValues![2].value || "0", 10),
    bounceRate: parseFloat(row.metricValues![3].value || "0"),
    avgSessionDuration: parseFloat(row.metricValues![4].value || "0"),
    conversions: parseInt(row.metricValues![5].value || "0", 10),
    revenue: parseFloat(row.metricValues![6].value || "0"),
  }));
}

/**
 * Calculate date range for GA4 sync.
 * Uses same logic as GSC (data can be delayed 1-2 days).
 */
export function getGA4DateRange(mode: "incremental" | "backfill"): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  // GA4 data can be delayed 1-2 days, use 3 for safety (match GSC)
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 3);

  const startDate = new Date(endDate);
  if (mode === "backfill") {
    startDate.setDate(startDate.getDate() - 87); // 90 days total
  } else {
    startDate.setDate(startDate.getDate() - 2); // 3 days overlap
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}
