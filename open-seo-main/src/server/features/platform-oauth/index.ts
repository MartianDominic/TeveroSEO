/**
 * Platform OAuth Module
 * Phase 61-01: Platform Integration Excellence
 *
 * Barrel export for OAuth platform integration functionality.
 */

// Types
export type {
  TokenSet,
  OAuthConfig,
  OAuthPlatform,
  AuthorizationUrlOptions,
  PlatformAccount,
} from "./types";

// Provider base
export { OAuthProvider, OAuthProviderBase } from "./OAuthProviderBase";

// Token encryption
export {
  encryptToken,
  decryptToken,
  encryptTokenSafe,
  decryptTokenSafe,
} from "./TokenEncryption";
