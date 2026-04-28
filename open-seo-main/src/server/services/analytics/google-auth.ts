/**
 * Google OAuth token management for analytics sync.
 *
 * Handles proactive token refresh before expiry.
 *
 * Per CONTEXT.md locked decisions:
 * - Check token_expiry before sync
 * - If expiry within 1 hour: refresh via Google OAuth refresh token
 * - If refresh fails: set is_active = false, log error, skip sync
 *
 * Per RESEARCH.md Pitfall 3 (Token Refresh Race Condition):
 * - Use job deduplication (jobId: sync-${clientId}-...) so only one job per client runs at a time
 * - This is already handled in queueBackfillJob - no Redis lock needed
 */
import { OAuth2Client } from "google-auth-library";
import {
  getClientToken,
  updateClientToken,
  markTokenInactive,
  type TokenResponse,
} from "@/server/lib/aiwriter-api";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "google-auth" });

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export interface ValidatedCredentials {
  accessToken: string;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
}

/**
 * Get valid credentials for a client, refreshing if needed.
 *
 * Per CONTEXT.md: Check expiry before sync, refresh if within 1 hour.
 * If refresh fails: set is_active=false and throw.
 *
 * @param clientId - Client UUID
 * @returns Valid access token and property IDs
 * @throws Error if token not found, refresh fails, or client deactivated
 */
export async function getValidCredentials(
  clientId: string,
): Promise<ValidatedCredentials> {
  // Fetch current token from AI-Writer internal API
  let token: TokenResponse;
  try {
    token = await getClientToken(clientId, "google");
  } catch (err) {
    throw new Error(`Failed to get token for client ${clientId}: ${err}`);
  }

  const now = new Date();
  const tokenExpiry = token.token_expiry ? new Date(token.token_expiry) : null;
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  // Check if refresh needed (token expires within 1 hour)
  if (tokenExpiry && tokenExpiry <= oneHourFromNow) {
    log.info("Token expiring soon, refreshing", { clientId });

    if (!token.refresh_token) {
      // No refresh token - mark inactive and throw
      log.error("No refresh token, marking inactive", undefined, { clientId });
      await markTokenInactive(clientId, "google");
      throw new Error(`No refresh token for client ${clientId}`);
    }

    try {
      const refreshedToken = await refreshAccessToken(
        token.access_token,
        token.refresh_token,
      );

      // Update token in AI-Writer DB
      await updateClientToken(clientId, "google", {
        access_token: refreshedToken.accessToken,
        refresh_token: refreshedToken.refreshToken || undefined,
        token_expiry: refreshedToken.expiryDate?.toISOString(),
      });

      log.info("Token refreshed", { clientId });

      return {
        accessToken: refreshedToken.accessToken,
        gscSiteUrl: token.gsc_site_url,
        ga4PropertyId: token.ga4_property_id,
      };
    } catch (err) {
      // Refresh failed - mark inactive and throw
      log.error("Token refresh failed", err instanceof Error ? err : new Error(String(err)), { clientId });
      await markTokenInactive(clientId, "google");
      throw new Error(`Token refresh failed for client ${clientId}: ${err}`);
    }
  }

  // Token still valid
  return {
    accessToken: token.access_token,
    gscSiteUrl: token.gsc_site_url,
    ga4PropertyId: token.ga4_property_id,
  };
}

interface RefreshedToken {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: Date | null;
}

async function refreshAccessToken(
  currentAccessToken: string,
  refreshToken: string,
): Promise<RefreshedToken> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
  }

  const oauth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

  oauth2Client.setCredentials({
    access_token: currentAccessToken,
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Refresh response missing access_token");
  }

  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token || null,
    expiryDate: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null,
  };
}
