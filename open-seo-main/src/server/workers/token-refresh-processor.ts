/**
 * Token Refresh Processor
 * Phase 61-06: Platform Integration Excellence
 *
 * Sandboxed processor for BullMQ token refresh jobs.
 * Implements D-11 (15-minute refresh) and D-12 (error status on failure).
 *
 * Targets tokens expiring within 30 minutes and refreshes them.
 */
import { Job } from "bullmq";
import { db } from "@/db";
import { platformConnections } from "@/db/platform-connection-schema";
import { and, eq, lt, isNotNull, inArray } from "drizzle-orm";
import { platformConnectionService } from "@/server/features/platform-oauth/PlatformConnectionService";
import { GoogleOAuthProvider } from "@/server/features/platform-oauth/providers/GoogleOAuthProvider";
import { WixOAuthProvider } from "@/server/features/platform-oauth/providers/WixOAuthProvider";
import { createLogger } from "@/server/lib/logger";
import type { CheckExpiringTokensJobData } from "@/server/queues/tokenRefreshQueue";

const logger = createLogger({ module: "token-refresh-processor" });

// Platforms that support token refresh
// Shopify tokens don't expire, WordPress uses app passwords
const REFRESHABLE_PLATFORMS = [
  "google_search_console",
  "google_analytics",
  "google_business_profile",
  "wix",
] as const;

/**
 * Get OAuth provider instance for token refresh.
 *
 * @param platform - Platform identifier
 * @param _siteUrl - Platform site URL (unused but available for future providers)
 * @returns OAuth provider with refreshAccessToken capability
 */
function getProvider(
  platform: string,
  _siteUrl: string | null
): GoogleOAuthProvider | WixOAuthProvider {
  // Redirect URI is not used for refresh, but providers require it
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  switch (platform) {
    case "google_search_console":
    case "google_analytics":
    case "google_business_profile":
      return new GoogleOAuthProvider(`${appUrl}/api/oauth/google/callback`);
    case "wix":
      return new WixOAuthProvider(`${appUrl}/api/oauth/wix/callback`);
    default:
      throw new Error(`No refresh support for platform: ${platform}`);
  }
}

/**
 * Process token refresh job.
 * Finds all active connections with tokens expiring within 30 minutes
 * and refreshes them proactively.
 *
 * @param job - BullMQ job with check-expiring-tokens data
 */
export default async function process(
  job: Job<CheckExpiringTokensJobData>
): Promise<void> {
  logger.info("Starting token refresh check", { jobId: job.id });

  // Find tokens expiring within 30 minutes per D-11
  const expiryThreshold = new Date(Date.now() + 30 * 60 * 1000);

  const expiring = await db.query.platformConnections.findMany({
    where: and(
      eq(platformConnections.status, "active"),
      lt(platformConnections.tokenExpiresAt, expiryThreshold),
      isNotNull(platformConnections.refreshTokenEncrypted),
      inArray(platformConnections.platform, [...REFRESHABLE_PLATFORMS])
    ),
  });

  logger.info("Found expiring connections", { count: expiring.length });

  let refreshed = 0;
  let failed = 0;

  for (const connection of expiring) {
    const connLogger = logger.child({
      connectionId: connection.id,
      platform: connection.platform,
    });

    try {
      // Get current tokens (decrypted)
      const tokens = await platformConnectionService.getOAuthTokens(
        connection.id
      );
      if (!tokens?.refreshToken) {
        connLogger.warn("No refresh token available, skipping");
        continue;
      }

      // Get provider and refresh
      const provider = getProvider(
        connection.platform,
        connection.platformSiteUrl
      );
      const newTokens = await provider.refreshAccessToken(tokens.refreshToken);

      // Update stored tokens
      await platformConnectionService.updateTokens(
        connection.id,
        newTokens.accessToken,
        newTokens.refreshToken,
        newTokens.expiresIn
      );

      connLogger.info("Token refreshed successfully");
      refreshed++;
    } catch (error) {
      // Mark as error per D-12
      const errorMessage =
        error instanceof Error ? error.message : "Token refresh failed";

      await platformConnectionService.updateStatus(
        connection.id,
        "error",
        errorMessage
      );

      connLogger.error("Token refresh failed", error as Error);
      failed++;
    }
  }

  logger.info("Token refresh check complete", {
    jobId: job.id,
    refreshed,
    failed,
    total: expiring.length,
  });
}
