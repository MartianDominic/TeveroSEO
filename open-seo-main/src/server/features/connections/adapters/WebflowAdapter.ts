/**
 * Webflow Platform Adapter
 * Phase 31-01: Platform Adapters
 *
 * Implements PlatformAdapter interface for Webflow CMS API v2.
 * Uses Bearer token authentication.
 *
 * Webflow API docs: https://developers.webflow.com/reference/
 * Sites API: https://developers.webflow.com/reference/sites/get-site
 */
import type {
  PlatformAdapter,
  CapabilityResult,
  WebflowAdapterConfig,
} from "./BaseAdapter";

// ============================================================================
// Webflow API Types
// ============================================================================

/**
 * Webflow site object from API.
 */
interface WebflowSite {
  id: string;
  displayName: string;
  shortName: string;
  previewUrl?: string;
}

// ============================================================================
// Webflow Adapter Implementation
// ============================================================================

/**
 * Webflow platform adapter using CMS API v2.
 *
 * Authentication: Bearer token in Authorization header.
 * Base URL: https://api.webflow.com/v2
 *
 * @example
 * ```typescript
 * const adapter = new WebflowAdapter({
 *   siteId: 'site-123',
 *   accessToken: 'wf_xxx...',
 * });
 *
 * const result = await adapter.verifyConnection();
 * if (result.connected) {
 *   console.log('Connected to Webflow site');
 * }
 * ```
 */
export class WebflowAdapter implements PlatformAdapter {
  readonly platform = "webflow" as const;
  readonly siteUrl: string;
  private siteId: string;
  private accessToken: string;
  private baseUrl = "https://api.webflow.com/v2";

  constructor(config: WebflowAdapterConfig) {
    this.siteId = config.siteId;
    this.accessToken = config.accessToken;
    // Webflow sites accessed via custom domain or sitename.webflow.io
    this.siteUrl = `https://webflow.com/dashboard/sites/${config.siteId}`;
  }

  /**
   * Make an authenticated request to the Webflow API.
   * Uses 30 second timeout to prevent hanging requests.
   *
   * @param endpoint - API endpoint (e.g., '/sites/{siteId}')
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
   * Verify connection is valid by querying site info.
   * Calls GET /sites/{siteId} to verify access.
   *
   * @returns CapabilityResult with connected status and detected capabilities
   */
  async verifyConnection(): Promise<CapabilityResult> {
    try {
      // Query site info to verify token and site access
      await this.request<WebflowSite>(`/sites/${this.siteId}`);

      return {
        connected: true,
        capabilities: {
          canReadPosts: true,
          canWritePosts: true, // CMS collections support write
          canReadPages: true,
          canWritePages: true, // Static pages support write
          canReadSeo: true,
          canWriteSeo: true, // SEO fields editable via CMS API
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
   * Returns true if connection is valid (Webflow OAuth tokens have write access).
   *
   * @returns true if connected (implies write access)
   */
  async testWritePermission(): Promise<boolean> {
    const result = await this.verifyConnection();
    return result.connected && (result.capabilities?.canWritePosts ?? false);
  }
}
