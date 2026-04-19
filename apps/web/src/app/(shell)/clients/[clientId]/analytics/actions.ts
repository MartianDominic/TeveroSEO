"use server";

import { getFastApi } from "@/lib/server-fetch";
import type { AnalyticsData } from "@/lib/analytics/types";

export async function fetchAnalyticsData(
  clientId: string,
  days: 30 | 90
): Promise<AnalyticsData | null> {
  try {
    return await getFastApi<AnalyticsData>(
      `/api/analytics/${clientId}/full?days=${days}`
    );
  } catch {
    // Return null to signal failure to caller - error already logged by getFastApi
    return null;
  }
}
