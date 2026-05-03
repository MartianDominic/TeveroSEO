/**
 * OAuth Provider Base Interface and Abstract Class
 * Phase 61-01: Platform Integration Excellence
 *
 * Defines the contract for all OAuth provider implementations.
 */

import type {
  OAuthConfig,
  OAuthPlatform,
  TokenSet,
  AuthorizationUrlOptions,
} from "./types";

/**
 * Interface that all OAuth providers must implement.
 */
export interface OAuthProvider {
  /**
   * Human-readable name of the provider.
   */
  readonly name: string;

  /**
   * Platform identifier matching OAUTH_PLATFORM_TYPES.
   */
  readonly platform: OAuthPlatform;

  /**
   * Generate the OAuth authorization URL for user consent.
   *
   * @param state - CSRF protection state parameter
   * @param options - Optional scope overrides and extra parameters
   * @returns Full authorization URL to redirect user to
   */
  getAuthorizationUrl(state: string, options?: AuthorizationUrlOptions): string;

  /**
   * Exchange authorization code for access and refresh tokens.
   *
   * @param code - Authorization code from OAuth callback
   * @returns Token set with access token and optional refresh token
   */
  exchangeCodeForTokens(code: string): Promise<TokenSet>;

  /**
   * Refresh an expired access token using a refresh token.
   *
   * @param refreshToken - The refresh token from initial authorization
   * @returns New token set with fresh access token
   */
  refreshAccessToken(refreshToken: string): Promise<TokenSet>;

  /**
   * Revoke an access or refresh token.
   *
   * @param token - The token to revoke
   */
  revokeToken(token: string): Promise<void>;
}

/**
 * Abstract base class for OAuth providers.
 * Provides common functionality and enforces the OAuthProvider contract.
 */
export abstract class OAuthProviderBase implements OAuthProvider {
  abstract readonly name: string;
  abstract readonly platform: OAuthPlatform;
  protected abstract readonly config: OAuthConfig;

  abstract getAuthorizationUrl(
    state: string,
    options?: AuthorizationUrlOptions
  ): string;

  abstract exchangeCodeForTokens(code: string): Promise<TokenSet>;

  abstract refreshAccessToken(refreshToken: string): Promise<TokenSet>;

  abstract revokeToken(token: string): Promise<void>;

  /**
   * Helper to build URL with query parameters.
   */
  protected buildUrl(base: string, params: Record<string, string>): string {
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  /**
   * Helper to make token requests.
   */
  protected async makeTokenRequest(
    body: Record<string, string>
  ): Promise<TokenSet> {
    const response = await fetch(this.config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token request failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 3600,
      tokenType: data.token_type ?? "Bearer",
      scope: data.scope,
    };
  }
}

// Re-export TokenSet for convenience
export type { TokenSet } from "./types";
