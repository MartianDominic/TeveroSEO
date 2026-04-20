import { NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";
import type { AnalyticsData } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ clientId: string; metric: string }> };

/**
 * Sparkline API endpoint - returns time-series data for mini charts.
 * Metrics: traffic (clicks), keywords (impressions proxy), ctr
 *
 * Response format: { data: number[], labels?: string[] }
 */
export async function GET(_: Request, { params }: Params) {
  const { clientId, metric } = await params;

  // Validate metric
  const validMetrics = ["traffic", "keywords", "ctr"];
  if (!validMetrics.includes(metric)) {
    return NextResponse.json(
      { error: `Invalid metric. Must be one of: ${validMetrics.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Fetch analytics data for last 30 days
    const analytics = await getFastApi<AnalyticsData>(
      `/api/analytics/${clientId}/full?days=30`
    );

    // Extract the relevant metric from GSC daily data
    const gscData = analytics.gsc_daily || [];

    let data: number[] = [];
    let labels: string[] = [];

    switch (metric) {
      case "traffic":
        data = gscData.map((d) => d.clicks);
        labels = gscData.map((d) => d.date);
        break;

      case "keywords":
        // Use impressions as proxy for keyword visibility
        data = gscData.map((d) => d.impressions);
        labels = gscData.map((d) => d.date);
        break;

      case "ctr":
        // CTR as percentage (0-100)
        data = gscData.map((d) => d.ctr * 100);
        labels = gscData.map((d) => d.date);
        break;
    }

    return NextResponse.json({ data, labels });
  } catch (err) {
    if (err instanceof FastApiError) {
      // Return empty data on 404 (client not found or no data)
      if (err.status === 404) {
        return NextResponse.json({ data: [], labels: [] });
      }
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
