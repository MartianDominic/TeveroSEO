/**
 * Google OAuth 2.0 Provider
 * Phase 61-02: Platform Integration Excellence
 *
 * Implements OAuth 2.0 for Google services:
 * - Google Search Console (GSC)
 * - Google Analytics (GA)
 * - Google Business Profile (GBP)
 *
 * Follows D-06, D-08 from DESIGN.md for unified consent flow with refresh tokens.
 */
import { getRequiredEnvValueSync } from "@/server/lib/runtime-env";

/**
 * OAuthPlatform enum representing supported platforms.
 */
export type OAuthPlatform =
  | "google_search_console"
  | "google_analytics"
  | "google_business_profile"
  | "shopify"
  | "wordpress"
  | "wix";

/**
 * TokenSet returned from OAuth token exchanges.
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

/**
 * OAuthProvider interface for all OAuth providers.
 */
export interface OAuthProvider {
  readonly name: string;
  readonly platform: OAuthPlatform;
  getAuthorizationUrl(state: string, options?: { scopes?: string[] }): string;
  exchangeCodeForTokens(code: string): Promise<TokenSet>;
  refreshAccessToken(refreshToken: string): Promise<TokenSet>;
  revokeToken(token: string): Promise<void>;
}

/**
 * Google API scopes for different services.
 * Per DESIGN.md specification.
 */
export const GOOGLE_SCOPES = {
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
  businessProfile: "https://www.googleapis.com/auth/business.manage",
} as const;

export type GoogleService = keyof typeof GOOGLE_SCOPES;

/**
 * Google OAuth configuration constants.
 */
const GOOGLE_CONFIG = {
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  revokeUrl: "https://oauth2.googleapis.com/revoke",
};

/**
 * Google OAuth Provider implementation.
 *
 * Implements unified OAuth 2.0 flow for GSC, GA, and GBP.
 * Always requests refresh tokens (access_type=offline, prompt=consent) per D-08.
 */
export class GoogleOAuthProvider implements OAuthProvider {
  readonly name = "Google";
  readonly platform: OAuthPlatform = "google_search_console";

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(redirectUri: string) {
    this.clientId = getRequiredEnvValueSync("GOOGLE_CLIENT_ID");
    this.clientSecret = getRequiredEnvValueSync("GOOGLE_CLIENT_SECRET");
    this.redirectUri = redirectUri;
  }

  /**
   * Generate Google OAuth authorization URL.
   *
   * @param state - CSRF protection state parameter
   * @param options - Optional configuration
   * @param options.services - Array of Google services to request access for (default: all)
   * @returns Complete authorization URL
   */
  getAuthorizationUrl(
    state: string,
    options?: { services?: GoogleService[] }
  ): string {
    // Default to all services if not specified
    const services: GoogleService[] =
      options?.services ?? ["searchConsole", "analytics", "businessProfile"];
    const scopes = services.map((s) => GOOGLE_SCOPES[s]).join(" ");

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: scopes,
      state,
      // D-08: Always request refresh token for background access
      access_type: "offline",
      // D-08: Force consent to ensure refresh token is returned
      prompt: "consent",
    });

    return `${GOOGLE_CONFIG.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   *
   * @param code - Authorization code from OAuth callback
   * @returns TokenSet with access and refresh tokens
   * @throws Error if token exchange fails
   */
  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Refresh an expired access token.
   *
   * @param refreshToken - The refresh token from initial authorization
   * @returns New TokenSet (may not include new refresh token)
   * @throws Error if refresh fails
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenSet> {
    const response = await fetch(GOOGLE_CONFIG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      // Google may not return a new refresh token; preserve original if missing
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  /**
   * Revoke a token (access or refresh).
   *
   * @param token - The token to revoke
   * @throws Error if revocation fails
   */
  async revokeToken(token: string): Promise<void> {
    const response = await fetch(`${GOOGLE_CONFIG.revokeUrl}?token=${token}`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token revocation failed: ${error}`);
    }
  }
}
