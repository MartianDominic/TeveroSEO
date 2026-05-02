/**
 * OAuth Providers Barrel Export
 * Phase 61-02: Platform Integration Excellence
 *
 * Exports all OAuth provider implementations.
 */

export {
  GoogleOAuthProvider,
  GOOGLE_SCOPES,
  type GoogleService,
  type OAuthProvider,
  type OAuthPlatform,
  type TokenSet,
} from "./GoogleOAuthProvider";

export {
  WordPressAppPasswordProvider,
  type WordPressCredentials,
  type WordPressUserInfo,
  type WordPressSiteInfo,
  type ValidationResult,
} from "./WordPressAppPasswordProvider";

export { WixOAuthProvider, WIX_SCOPES } from "./WixOAuthProvider";

export { ShopifyOAuthProvider, SHOPIFY_SCOPES } from "./ShopifyOAuthProvider";
