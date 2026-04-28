/**
 * Squarespace Platform Adapter
 * Phase 31-01: Platform Adapters
 *
 * Implements PlatformAdapter interface for Squarespace REST API.
 * Uses API key authentication with Bearer token.
 *
 * Squarespace API docs: https://developers.squarespace.com/commerce-apis
 * Note: Squarespace API is limited - primarily read operations for content.
 */
import type {
  PlatformAdapter,
  CapabilityResult,
  SquarespaceAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// Squarespace Adapter Implementation
// ============================================================================

/**
 * Squarespace platform adapter using REST API.
 *
 * Authentication: Bearer token in Authorization header.
 * Base URL: https://api.squarespace.com/1.0
 *
 * Note: Squarespace API has limited write capabilities for third-party apps.
 * Content API is primarily read-heavy. SEO meta updates may require
 * Developer Mode on the site.
 *
 * @example
 * ```typescript
 * const adapter = new SquarespaceAdapter({
 *   siteId: 'site-123',
 *   apiKey: 'sqsp_xxx...',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   console.log('Connected to Squarespace site');
 * }
 * ```
 */
export class SquarespaceAdapter implements PlatformAdapter {
  readonly platform = "squarespace" as const;
  readonly siteUrl: string;
  private siteId: string;
  private apiKey: string;
  private baseUrl = "https://api.squarespace.com/1.0";

  constructor(config: SquarespaceAdapterConfig) {
    this.siteId = config.siteId;
    this.apiKey = config.apiKey;
    // Squarespace sites accessed via custom domain or sitename.squarespace.com
    this.siteUrl = `https://www.squarespace.com/config/${config.siteId}`;
  }

  /**
   * Make an authenticated request to the Squarespace API.
   * Uses 30 second timeout to prevent hanging requests.
   *
   * @param endpoint - API endpoint (e.g., '/commerce/inventory')
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
          Authorization: `Bearer ${this.apiKey}`,
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
   * Verify connection is valid by querying inventory endpoint.
   * Uses commerce/inventory as a lightweight verification call.
   *
   * Note: Squarespace API is limited for third-party apps.
   * canWritePosts is false as content API doesn't support write operations.
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      // Query inventory to verify API key is valid
      // This is a lightweight endpoint that works with commerce API access
      await this.request<{ inventory: unknown[] }>("/commerce/inventory");

      return {
        connected: true,
        capabilities: {
          canReadPosts: true,
          canWritePosts: false, // Squarespace content API is read-heavy
          canReadPages: true,
          canWritePages: false, // Limited write access for third-party
          canReadSeo: true,
          canWriteSeo: false, // SEO updates require Developer Mode
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
   * Returns false for Squarespace as third-party apps have limited write access.
   *
   * @returns false (Squarespace API is read-heavy for third-party apps)
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    // Squarespace has limited write capabilities for third-party apps
    return result.connected && (result.capabilities?.canWritePosts ?? false);
  }
}
