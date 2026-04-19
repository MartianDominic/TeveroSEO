/**
 * OAuth types for per-client credentials system.
 *
 * Phase 12: Per-Client Credentials System
 *
 * These types support the magic link invite flow and OAuth connections
 * for Google (GSC + GA4 + GBP), Bing, WordPress, Shopify, and Wix.
 */

/**
 * OAuth provider types supported by the platform.
 */
export type OAuthProvider = "google" | "bing" | "wordpress" | "shopify" | "wix";

/**
 * Represents an active OAuth connection for a client.
 *
 * SECURITY NOTE: access_token and refresh_token are write-only on the backend.
 * They are never returned to the frontend.
 */
export interface OAuthConnection {
  id: string;
  provider: OAuthProvider;
  is_active: boolean;
  connected_by: string;
  connected_at: string;
  token_expiry: string | null;
  scopes: string[] | null;
  properties: Array<{ key: string; value: string }>;
}

/**
 * Response when creating a new magic link invite.
 */
export interface InviteResponse {
  token: string;
  url: string;
  expires_at: string;
}

/**
 * Response when validating a magic link invite token.
 * Used by the /connect/[token] page to display invite details.
 */
export interface InviteValidation {
  valid: boolean;
  client_name: string;
  scopes_requested: string[] | null;
  expires_at: string;
}

/**
 * Request payload for creating a new invite.
 */
export interface InviteCreate {
  scopes_requested: string[];
}
