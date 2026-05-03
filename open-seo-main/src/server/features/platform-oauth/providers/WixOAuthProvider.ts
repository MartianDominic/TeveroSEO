/**
 * Wix OAuth Provider
 * Phase 61-03: Platform Integration Excellence
 *
 * Implements standard OAuth 2.0 for Wix sites (2.6% market share).
 * Supports token refresh unlike Shopify.
 */
import { getRequiredEnvValueSync } from "@/server/lib/runtime-env";
import type { OAuthProvider, TokenSet } from "./GoogleOAuthProvider";

/**
 * Wix API scopes for SEO data access.
 * Per DESIGN.md Tier 2 requirements.
 */
export const WIX_SCOPES = [
  "WIX.SITE.READ",
  "WIX.CONTACTS.READ",
  "WIX.BLOG.READ",
] as const;

/**
 * Wix OAuth configuration constants.
 */
const WIX_CONFIG = {
  authorizationUrl: "https://www.wix.com/installer/install",
  tokenUrl: "https://www.wixapis.com/oauth/access",
  refreshUrl: "https://www.wixapis.com/oauth/access",
};

/**
 * Wix OAuth Provider implementation.
 *
 * Standard OAuth 2.0 flow with refresh token support.
 */
export class WixOAuthProvider implements OAuthProvider {
  readonly name = "Wix";
  readonly platform = "wix" as const;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(redirectUri: string) {
    this.clientId = getRequiredEnvValueSync("WIX_CLIENT_ID");
    this.clientSecret = getRequiredEnvValueSync("WIX_CLIENT_SECRET");
    this.redirectUri = redirectUri;
  }

  /**
   * Generate Wix OAuth authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      appId: this.clientId,
      redirectUrl: this.redirectUri,
      state,
    });

    return `${WIX_CONFIG.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   */
  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const response = await fetch(WIX_CONFIG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Wix token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 3600,
      tokenType: "Bearer",
    };
  }

  /**
   * Refresh an expired access token.
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    const response = await fetch(WIX_CONFIG.refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Wix token refresh failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in ?? 3600,
      tokenType: "Bearer",
    };
  }

  /**
   * Revoke token - Wix doesn't have a revoke endpoint.
   */
  async revokeToken(_token: string): Promise<void> {
    // Wix doesn't have a revoke endpoint; delete from database instead
  }
}
