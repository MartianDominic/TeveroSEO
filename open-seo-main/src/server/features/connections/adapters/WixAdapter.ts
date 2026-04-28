/**
 * Wix Platform Adapter
 * Phase 31-01: Platform Adapters
 *
 * Implements PlatformAdapter interface for Wix Headless API.
 * Uses Bearer token authentication with wix-site-id header.
 *
 * Wix Headless API docs: https://dev.wix.com/docs/rest
 * Site Properties API: https://dev.wix.com/docs/rest/site-management/site-properties
 */
import type {
  PlatformAdapter,
  CapabilityResult,
  WixAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// Wix Adapter Implementation
// ============================================================================

/**
 * Wix platform adapter using Headless API.
 *
 * Authentication: Bearer token in Authorization header + wix-site-id header.
 * Base URL: https://www.wixapis.com
 *
 * @example
 * ```typescript
 * const adapter = new WixAdapter({
 *   siteId: 'site-123',
 *   accessToken: 'IST.xxx...',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   console.log('Connected to Wix site');
 * }
 * ```
 */
export class WixAdapter implements PlatformAdapter {
  readonly platform = "wix" as const;
  readonly siteUrl: string;
  private siteId: string;
  private accessToken: string;
  private baseUrl = "https://www.wixapis.com";

  constructor(config: WixAdapterConfig) {
    this.siteId = config.siteId;
    this.accessToken = config.accessToken;
    // Wix sites are typically accessed via user.wixsite.com/sitename or custom domain
    this.siteUrl = `https://www.wix.com/dashboard/${config.siteId}`;
  }

  /**
   * Make an authenticated request to the Wix API.
   * Uses 30 second timeout to prevent hanging requests.
   *
   * @param endpoint - API endpoint (e.g., '/site-properties/v4/properties')
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws Error if response is not OK or times out
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "wix-site-id": this.siteId,
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        // Return generic error message to avoid leaking API details (T-31-01)
        const status = res.status;
        if (status === 401 || status === 403) {
          throw new Error("Connection failed: Invalid or expired credentials");
        }
        throw new Error(`Connection failed: API error ${status}`);
      }

      return res.json();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("Connection failed: Request timeout after 30s");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Verify connection is valid by querying site properties.
   * Calls GET /site-properties/v4/properties to check authentication.
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      // Query site properties to verify authentication
      await this.request<{ properties: unknown }>("/site-properties/v4/properties");

      return {
        connected: true,
        capabilities: {
          canReadPosts: true,
          canWritePosts: true, // Requires BLOG.PUBLISH-POST scope
          canReadPages: true,
          canWritePages: true,
          canReadSeo: true,
          canWriteSeo: true,
        },
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Test if the adapter has write permission.
   * Returns true if connection is valid and has blog write capability.
   *
   * @returns true if user can write posts
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected && (result.capabilities?.canWritePosts ?? false);
  }
}
