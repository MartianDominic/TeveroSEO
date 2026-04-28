/**
 * Base Platform Adapter Interface
 * Phase 31-03: Platform Adapters
 *
 * Defines the contract for all platform adapters (WordPress, Shopify, etc.).
 * Each adapter must implement verifyConnection and testWritePermission.
 */
import type { PlatformType } from "../types";

// ============================================================================
// Capability Result
// ============================================================================

/**
 * Result from verifyConnection() - indicates connection status and capabilities.
 */
export interface CapabilityResult {
  /** Whether the connection is valid and authenticated */
  connected: boolean;

  /** Error message if connection failed */
  error?: string;

  /** Platform capabilities detected from the connection */
  capabilities?: {
    canReadPosts?: boolean;
    canWritePosts?: boolean;
    canReadPages?: boolean;
    canWritePages?: boolean;
    canReadMedia?: boolean;
    canWriteMedia?: boolean;
    canReadProducts?: boolean;
    canWriteProducts?: boolean;
    canReadSeo?: boolean;
    canWriteSeo?: boolean;
  };
}

// ============================================================================
// Platform Adapter Interface
// ============================================================================

/**
 * Base interface for all platform adapters.
 * WordPress, Shopify, Wix, etc. must implement this interface.
 */
export interface PlatformAdapter {
  /** The platform type this adapter handles */
  platform: PlatformType;

  /** The site URL this adapter is connected to */
  siteUrl: string;

  /**
   * Verify connection is valid and detect capabilities.
   * Returns capabilities object showing what operations are available.
   */
  verifyConnection(): Promise<CapabilityResult>;

  /**
   * Test write permission by attempting a no-op or draft update.
   * Returns true if write operations will succeed.
   */
  testWritePermission(): Promise<boolean>;
}

// ============================================================================
// Platform-Specific Config Types
// ============================================================================

/**
 * WordPress adapter configuration.
 * Uses Application Password authentication with REST API v2.
 */
export interface WordPressAdapterConfig {
  /** WordPress site URL (e.g., https://example.com) */
  siteUrl: string;

  /** WordPress username */
  username: string;

  /** WordPress Application Password (generated in user profile) */
  appPassword: string;
}

/**
 * Shopify adapter configuration.
 * Uses Admin API access token with GraphQL endpoint.
 */
export interface ShopifyAdapterConfig {
  /** Shopify store domain (e.g., mystore.myshopify.com) */
  shopDomain: string;

  /** Admin API access token */
  accessToken: string;

  /** API version (defaults to 2026-04) */
  apiVersion?: string;
}

/**
 * Wix adapter configuration.
 * Uses Wix Headless API with Bearer token authentication.
 */
export interface WixAdapterConfig {
  /** Wix site ID */
  siteId: string;

  /** Wix API access token (from OAuth or app dashboard) */
  accessToken: string;

  /** Optional Wix account ID */
  accountId?: string;
}

/**
 * Squarespace adapter configuration.
 * Uses Squarespace REST API with API key authentication.
 */
export interface SquarespaceAdapterConfig {
  /** Squarespace site ID */
  siteId: string;

  /** Squarespace API key */
  apiKey: string;
}

/**
 * Webflow adapter configuration.
 * Uses Webflow CMS API v2 with Bearer token authentication.
 */
export interface WebflowAdapterConfig {
  /** Webflow site ID */
  siteId: string;

  /** Webflow API access token */
  accessToken: string;
}

// ============================================================================
// Factory Type
// ============================================================================

/**
 * Factory function type for creating adapters from config.
 */
export type AdapterFactory = (config: unknown) => PlatformAdapter;

// ============================================================================
// Write Operations Interface (Phase 33-03)
// ============================================================================

/**
 * Write result from platform operations.
 */
export interface WriteResult {
  success: boolean;
  error?: string;
}

/**
 * Extended adapter interface for platforms that support write operations.
 * Adapters implementing this can be used with the auto-fix system.
 */
export interface PlatformWriteAdapter extends PlatformAdapter {
  /**
   * Read a specific field value from a resource.
   * @param resourceId Platform-specific resource ID
   * @param field Field name (e.g., 'title', 'meta_description', 'alt_text')
   * @returns Current value or null if not set
   */
  readField(resourceId: string, field: string): Promise<string | null>;

  /**
   * Write a value to a specific field on a resource.
   * @param resourceId Platform-specific resource ID
   * @param field Field name
   * @param value New value to set
   */
  writeField(resourceId: string, field: string, value: string): Promise<WriteResult>;

  /**
   * Update multiple meta fields at once.
   * More efficient than multiple writeField calls for platforms that support bulk updates.
   */
  updateMeta(resourceId: string, meta: Record<string, string>): Promise<WriteResult>;

  /**
   * Update image alt text (optional - not all platforms support this).
   */
  updateImageAlt?(imageId: string, alt: string): Promise<WriteResult>;

  /**
   * Update image HTML attributes (width, height, loading).
   */
  updateImageAttributes?(imageId: string, attributes: Record<string, string>): Promise<WriteResult>;
}

/**
 * Type guard to check if an adapter supports write operations.
 */
export function isWriteAdapter(adapter: PlatformAdapter): adapter is PlatformWriteAdapter {
  return 'readField' in adapter && 'writeField' in adapter && 'updateMeta' in adapter;
}
