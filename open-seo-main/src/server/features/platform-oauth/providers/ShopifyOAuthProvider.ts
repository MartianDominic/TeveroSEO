/**
 * Shopify OAuth Provider
 * Phase 61-03: Platform Integration Excellence
 *
 * Implements OAuth for Shopify stores (4.4% market share, 28% e-commerce).
 * Shop-specific authorization URLs and permanent (non-expiring) tokens.
 */
import { getRequiredEnvValueSync } from "@/server/lib/runtime-env";
import type { OAuthProvider, TokenSet } from "./GoogleOAuthProvider";

/**
 * Shopify API scopes for SEO data access.
 * Per DESIGN.md Tier 1 requirements.
 */
export const SHOPIFY_SCOPES = [
  "read_products",
  "read_content",
  "read_themes",
  "read_online_store_pages",
  "read_publications",
] as const;

/**
 * Shopify OAuth Provider implementation.
 *
 * Key differences from standard OAuth:
 * - Authorization URL is shop-specific: https://{shop}/admin/oauth/authorize
 * - Access tokens do NOT expire (no refresh needed)
 * - Shop domain must be validated (.myshopify.com)
 */
export class ShopifyOAuthProvider implements OAuthProvider {
  readonly name = "Shopify";
  readonly platform = "shopify" as const;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly shop: string;

  constructor(shop: string, redirectUri: string) {
    // Validate and normalize shop domain (T-61-07: mitigate spoofing)
    this.shop = this.validateShopDomain(shop);
    this.clientId = getRequiredEnvValueSync("SHOPIFY_CLIENT_ID");
    this.clientSecret = getRequiredEnvValueSync("SHOPIFY_CLIENT_SECRET");
    this.redirectUri = redirectUri;
  }

  /**
   * Validate shop domain format.
   * Must end in .myshopify.com or be a valid shop name.
   */
  private validateShopDomain(shop: string): string {
    const normalized = shop.toLowerCase().trim();

    // If already has .myshopify.com, validate and use
    if (normalized.endsWith(".myshopify.com")) {
      const shopName = normalized.replace(".myshopify.com", "");
      if (!/^[a-z0-9-]+$/.test(shopName)) {
        throw new Error("Invalid Shopify shop domain format");
      }
      return normalized;
    }

    // Otherwise, treat as shop name and append domain
    if (!/^[a-z0-9-]+$/.test(normalized)) {
      throw new Error("Invalid Shopify shop name format");
    }
    return `${normalized}.myshopify.com`;
  }

  /**
   * Generate Shopify OAuth authorization URL.
   * Shop-specific: https://{shop}/admin/oauth/authorize
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: SHOPIFY_SCOPES.join(","),
      redirect_uri: this.redirectUri,
      state,
    });

    return `https://${this.shop}/admin/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens.
   * Shopify returns permanent access token (no expiry).
   */
  async exchangeCodeForTokens(code: string): Promise<TokenSet> {
    const response = await fetch(
      `https://${this.shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify token exchange failed: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      scope?: string;
    };

    // Shopify tokens do NOT expire - use MAX_SAFE_INTEGER
    return {
      accessToken: data.access_token,
      expiresIn: Number.MAX_SAFE_INTEGER,
      tokenType: "Bearer",
      scope: data.scope,
    };
  }

  /**
   * Refresh access token - NOT SUPPORTED for Shopify.
   * Shopify tokens are permanent and don't expire.
   */
  async refreshAccessToken(_refreshToken: string): Promise<TokenSet> {
    throw new Error("Shopify tokens do not expire and cannot be refreshed");
  }

  /**
   * Revoke token - requires app uninstall or Admin API.
   */
  async revokeToken(_token: string): Promise<void> {
    throw new Error("Shopify token revocation requires app uninstall");
  }

  /**
   * Get the validated shop domain.
   */
  getShop(): string {
    return this.shop;
  }
}
