"use server";

import { getFastApi } from "@/lib/server-fetch";
import { requireActionAuth, validateClientOwnership } from "@/lib/auth/action-auth";
import type { AnalyticsData } from "@/lib/analytics/types";

/**
 * Fetch analytics data for a client.
 *
 * SECURITY: Validates client ownership to prevent IDOR vulnerabilities.
 * Users can only access analytics for clients they own.
 */
export async function fetchAnalyticsData(
  clientId: string,
  days: 30 | 90
): Promise<AnalyticsData | null> {
  const auth = await requireActionAuth();

  // SECURITY: Validate ownership before accessing client data (prevents IDOR)
  await validateClientOwnership(clientId, auth);

  try {
    return await getFastApi<AnalyticsData>(
      `/api/analytics/${clientId}/full?days=${days}`
    );
  } catch {
    // Return null to signal failure to caller - error already logged by getFastApi
    return null;
  }
}
