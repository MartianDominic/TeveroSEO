import { NextRequest, NextResponse } from "next/server";
import { getFastApi, FastApiError } from "@/lib/server-fetch";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import type { AnalyticsData } from "@/lib/analytics/types";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ clientId: string; metric: string }> };

/**
 * Sparkline API endpoint - returns time-series data for mini charts.
 * Metrics: traffic (clicks), keywords (impressions proxy), ctr
 *
 * Response format: { data: number[], labels?: string[] }
 */
export async function GET(req: NextRequest, { params }: Params) {
  // Rate limit: 100 requests per minute
  const ip = getClientIpFromRequest(req);
  const rateLimitResult = await checkRateLimit(`${ip}:${req.nextUrl.pathname}`, RATE_LIMITS.API.limit, RATE_LIMITS.API.windowMs);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

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
    await requireClientAccess(clientId);
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
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
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
