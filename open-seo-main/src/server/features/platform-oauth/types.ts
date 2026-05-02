/**
 * OAuth Types for Platform Integration
 * Phase 61-01: Platform Integration Excellence
 *
 * Common types for OAuth flows across all supported platforms.
 */

/**
 * Token set returned from OAuth token exchange or refresh.
 */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds until expiry
  tokenType: string;
  scope?: string;
}

/**
 * OAuth configuration for a provider.
 */
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  redirectUri: string;
}

/**
 * Supported OAuth platforms.
 * Must match OAUTH_PLATFORM_TYPES in platform-connection-schema.ts
 */
export type OAuthPlatform =
  | "google_search_console"
  | "google_analytics"
  | "google_business_profile"
  | "wordpress_com"
  | "wordpress_org"
  | "shopify"
  | "wix"
  | "squarespace"
  | "webflow"
  | "hubspot"
  | "bigcommerce"
  | "magento"
  | "drupal"
  | "ghost"
  | "bing_webmaster";

/**
 * Options for getAuthorizationUrl
 */
export interface AuthorizationUrlOptions {
  scopes?: string[];
  extraParams?: Record<string, string>;
}

/**
 * Result of account selection after OAuth
 */
export interface PlatformAccount {
  id: string;
  name: string;
  siteUrl?: string;
}
