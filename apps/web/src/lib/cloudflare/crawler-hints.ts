/**
 * Cloudflare Crawler Hints Integration
 *
 * CRITICAL FINDING: Cloudflare does NOT expose a public API to enable Crawler Hints.
 * The feature is dashboard-only as of May 2026. The Terraform provider issue #1591
 * was closed in March 2024 with "tracking internally" - no public API shipped.
 *
 * This module provides:
 * 1. Detection of whether a domain uses Cloudflare (for UI routing)
 * 2. OAuth flow for Cloudflare account connection (future-proofing)
 * 3. Zone listing and management APIs
 * 4. Placeholder for Crawler Hints API when/if Cloudflare releases it
 *
 * WORKAROUND STRATEGY:
 * - Detect Cloudflare usage via headers
 * - Guide users to enable Crawler Hints via dashboard (1 click)
 * - Provide deep link to the exact dashboard location
 * - Monitor for API availability
 */

import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface CloudflareDetectionResult {
  /** Whether the domain uses Cloudflare */
  usesCloudflare: boolean;
  /** Detection method that confirmed CF usage */
  detectionMethod:
    | "cf-ray-header"
    | "server-header"
    | "dns-nameserver"
    | "none";
  /** CF-Ray header value (if present) */
  cfRay?: string;
  /** Data center code from CF-Ray */
  dataCenter?: string;
  /** Whether the site has Cloudflare cache enabled */
  cacheEnabled?: boolean;
  /** CF-Cache-Status value */
  cacheStatus?: "HIT" | "MISS" | "EXPIRED" | "DYNAMIC" | "BYPASS" | string;
  /** Raw response headers for debugging */
  rawHeaders?: Record<string, string>;
  /** Error message if detection failed */
  error?: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: "active" | "pending" | "initializing" | "moved" | "deleted";
  paused: boolean;
  type: "full" | "partial" | "secondary";
  developmentMode: number;
  plan: {
    id: string;
    name: string;
    isSubscribed: boolean;
  };
  createdOn: string;
  modifiedOn: string;
}

export interface CloudflareZoneSetting {
  id: string;
  value: string | boolean | number | Record<string, unknown>;
  editable: boolean;
  modifiedOn?: string;
}

export interface CrawlerHintsStatus {
  /** Whether Crawler Hints is enabled */
  enabled: boolean;
  /** Whether we could determine the status (API may not be available) */
  statusKnown: boolean;
  /** If API call failed, the error message */
  error?: string;
  /** Fallback: URL to the Cloudflare dashboard to manually enable */
  dashboardUrl: string;
  /** IndexNow URLs submitted in the last 24h (if available) */
  recentSubmissions?: number;
}

export interface CloudflareOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface CloudflareTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId?: string;
  permissions: string[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

const CloudflareApiResponseSchema = z.object({
  success: z.boolean(),
  errors: z.array(
    z.object({
      code: z.number(),
      message: z.string(),
    })
  ),
  messages: z.array(z.string()).optional(),
  result: z.unknown().nullable(),
  result_info: z
    .object({
      page: z.number(),
      per_page: z.number(),
      count: z.number(),
      total_count: z.number(),
      total_pages: z.number(),
    })
    .optional(),
});

const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "pending", "initializing", "moved", "deleted"]),
  paused: z.boolean(),
  type: z.enum(["full", "partial", "secondary"]),
  development_mode: z.number(),
  plan: z.object({
    id: z.string(),
    name: z.string(),
    is_subscribed: z.boolean(),
  }),
  created_on: z.string(),
  modified_on: z.string(),
});

// ============================================================================
// Constants
// ============================================================================

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Required OAuth scopes for Cloudflare integration.
 * Note: Zone Settings Edit is needed for Crawler Hints (when API becomes available)
 */
export const REQUIRED_SCOPES = [
  "zone:read", // List and read zones
  "zone_settings:edit", // Modify zone settings (for Crawler Hints)
  "cache_purge:edit", // Optional: purge cache after content updates
] as const;

/**
 * Cloudflare nameserver patterns for DNS detection
 */
const CLOUDFLARE_NS_PATTERNS = [
  /\.ns\.cloudflare\.com$/i,
  /\.cloudflare\.com$/i,
];

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Detect if a domain uses Cloudflare by checking HTTP response headers.
 * This is the most reliable method - CF-RAY header is unique to Cloudflare.
 *
 * @param domain - Domain to check (with or without protocol)
 * @returns Detection result with confidence indicators
 */
export async function detectCloudflare(
  domain: string
): Promise<CloudflareDetectionResult> {
  const normalizedDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const url = `https://${normalizedDomain}`;

  try {
    // Use HEAD request to minimize data transfer
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "TeveroSEO/1.0 (Cloudflare Detection)",
      },
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Primary detection: CF-Ray header (almost exclusive to Cloudflare)
    const cfRay = headers["cf-ray"];
    if (cfRay) {
      // CF-Ray format: <ray_id>-<datacenter_code>
      // e.g., "230b030023ae2822-SJC"
      const [, dataCenter] = cfRay.split("-");

      return {
        usesCloudflare: true,
        detectionMethod: "cf-ray-header",
        cfRay,
        dataCenter,
        cacheEnabled: !!headers["cf-cache-status"],
        cacheStatus: headers["cf-cache-status"] as CloudflareDetectionResult["cacheStatus"],
        rawHeaders: headers,
      };
    }

    // Secondary detection: Server header
    const server = headers["server"];
    if (server?.toLowerCase().includes("cloudflare")) {
      return {
        usesCloudflare: true,
        detectionMethod: "server-header",
        rawHeaders: headers,
      };
    }

    // Not using Cloudflare (or headers stripped)
    return {
      usesCloudflare: false,
      detectionMethod: "none",
      rawHeaders: headers,
    };
  } catch (error) {
    return {
      usesCloudflare: false,
      detectionMethod: "none",
      error: error instanceof Error ? error.message : "Detection failed",
    };
  }
}

/**
 * Detect Cloudflare via DNS nameserver lookup.
 * Less reliable than headers but works even if CF headers are stripped.
 *
 * @param domain - Domain to check
 * @returns Whether domain uses Cloudflare DNS
 */
export async function detectCloudflareViaDns(domain: string): Promise<boolean> {
  const normalizedDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .split("/")[0];

  try {
    // Use DNS over HTTPS (Cloudflare's own resolver, ironically)
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${normalizedDomain}&type=NS`,
      {
        headers: {
          Accept: "application/dns-json",
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as {
      Answer?: Array<{ data: string }>;
    };

    if (!data.Answer) {
      return false;
    }

    // Check if any nameserver matches Cloudflare patterns
    return data.Answer.some((record) =>
      CLOUDFLARE_NS_PATTERNS.some((pattern) => pattern.test(record.data))
    );
  } catch {
    return false;
  }
}

// ============================================================================
// Cloudflare API Client
// ============================================================================

export class CloudflareApiClient {
  private readonly apiToken: string;
  private readonly baseUrl = CLOUDFLARE_API_BASE;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  /**
   * Make an authenticated request to the Cloudflare API.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();
    const parsed = CloudflareApiResponseSchema.parse(data);

    if (!parsed.success) {
      const errorMessage = parsed.errors
        .map((e) => `${e.code}: ${e.message}`)
        .join(", ");
      throw new Error(`Cloudflare API error: ${errorMessage}`);
    }

    return parsed.result as T;
  }

  /**
   * List all zones accessible with this API token.
   */
  async listZones(options?: {
    name?: string;
    status?: string;
    page?: number;
    perPage?: number;
  }): Promise<CloudflareZone[]> {
    const params = new URLSearchParams();
    if (options?.name) params.set("name", options.name);
    if (options?.status) params.set("status", options.status);
    if (options?.page) params.set("page", String(options.page));
    if (options?.perPage) params.set("per_page", String(options.perPage));

    const queryString = params.toString();
    const endpoint = `/zones${queryString ? `?${queryString}` : ""}`;

    const zones = await this.request<unknown[]>(endpoint);

    return zones.map((zone) => {
      const parsed = ZoneSchema.parse(zone);
      return {
        id: parsed.id,
        name: parsed.name,
        status: parsed.status,
        paused: parsed.paused,
        type: parsed.type,
        developmentMode: parsed.development_mode,
        plan: {
          id: parsed.plan.id,
          name: parsed.plan.name,
          isSubscribed: parsed.plan.is_subscribed,
        },
        createdOn: parsed.created_on,
        modifiedOn: parsed.modified_on,
      };
    });
  }

  /**
   * Get a specific zone by domain name.
   */
  async getZoneByName(domain: string): Promise<CloudflareZone | null> {
    const zones = await this.listZones({ name: domain });
    return zones[0] || null;
  }

  /**
   * Get all zone settings.
   *
   * Note: This endpoint is deprecated by Cloudflare but still functional.
   * Individual settings should be managed via /zones/{zone_id}/settings/{setting_id}
   */
  async getZoneSettings(zoneId: string): Promise<CloudflareZoneSetting[]> {
    const settings = await this.request<unknown[]>(
      `/zones/${zoneId}/settings`
    );

    return settings.map((setting) => {
      const s = setting as Record<string, unknown>;
      return {
        id: s.id as string,
        value: s.value as string | boolean | number | Record<string, unknown>,
        editable: s.editable as boolean,
        modifiedOn: s.modified_on as string | undefined,
      };
    });
  }

  /**
   * Get Crawler Hints status for a zone.
   *
   * IMPORTANT: As of May 2026, there is NO public API to read or set Crawler Hints.
   * This method attempts to find it in zone settings but will likely fail.
   * The dashboard URL is the reliable fallback.
   */
  async getCrawlerHintsStatus(zoneId: string): Promise<CrawlerHintsStatus> {
    const dashboardUrl = `https://dash.cloudflare.com/?to=/:account/${zoneId}/caching/configuration`;

    try {
      const settings = await this.getZoneSettings(zoneId);

      // Look for crawler_hints setting (may not exist in API)
      const crawlerHintsSetting = settings.find(
        (s) =>
          s.id === "crawler_hints" ||
          s.id === "crawl_hints" ||
          s.id === "indexnow"
      );

      if (crawlerHintsSetting) {
        return {
          enabled: crawlerHintsSetting.value === "on" || crawlerHintsSetting.value === true,
          statusKnown: true,
          dashboardUrl,
        };
      }

      // Setting not found in API response
      return {
        enabled: false,
        statusKnown: false,
        error:
          "Crawler Hints setting not available via API. Please enable via dashboard.",
        dashboardUrl,
      };
    } catch (error) {
      return {
        enabled: false,
        statusKnown: false,
        error: error instanceof Error ? error.message : "Failed to check status",
        dashboardUrl,
      };
    }
  }

  /**
   * Enable Crawler Hints for a zone.
   *
   * IMPORTANT: This is a PLACEHOLDER. Cloudflare does NOT have a public API
   * for this setting as of May 2026. This will likely return an error.
   *
   * The recommended approach is to:
   * 1. Detect if domain uses Cloudflare
   * 2. If yes, show user a deep link to the dashboard
   * 3. User clicks one button in dashboard to enable
   *
   * @returns Status indicating success or failure with dashboard fallback
   */
  async enableCrawlerHints(zoneId: string): Promise<CrawlerHintsStatus> {
    const dashboardUrl = `https://dash.cloudflare.com/?to=/:account/${zoneId}/caching/configuration`;

    try {
      // Attempt to PATCH the setting (will likely fail with 404 or 400)
      await this.request(`/zones/${zoneId}/settings/crawler_hints`, {
        method: "PATCH",
        body: JSON.stringify({ value: "on" }),
      });

      return {
        enabled: true,
        statusKnown: true,
        dashboardUrl,
      };
    } catch (error) {
      // Expected failure - API not available
      return {
        enabled: false,
        statusKnown: false,
        error:
          "Crawler Hints API not available. Please enable via Cloudflare dashboard.",
        dashboardUrl,
      };
    }
  }

  /**
   * Verify API token has required permissions.
   */
  async verifyToken(): Promise<{
    valid: boolean;
    permissions: string[];
    expiresOn?: string;
  }> {
    try {
      const result = await this.request<{
        id: string;
        status: string;
        expires_on?: string;
        policies: Array<{
          id: string;
          effect: string;
          resources: Record<string, string>;
          permission_groups: Array<{ id: string; name: string }>;
        }>;
      }>("/user/tokens/verify");

      const permissions = result.policies.flatMap((policy) =>
        policy.permission_groups.map((pg) => pg.name)
      );

      return {
        valid: result.status === "active",
        permissions,
        expiresOn: result.expires_on,
      };
    } catch {
      return {
        valid: false,
        permissions: [],
      };
    }
  }
}

// ============================================================================
// OAuth Flow (Future-Proofing)
// ============================================================================

/**
 * Generate Cloudflare OAuth authorization URL.
 *
 * Note: Cloudflare's OAuth for third-party apps is evolving.
 * As of May 2026, API tokens are the primary authentication method.
 * OAuth is primarily used via Cloudflare Access or for internal apps.
 */
export function generateCloudflareOAuthUrl(config: CloudflareOAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
  });

  // Note: Cloudflare's OAuth endpoint may vary based on implementation
  // This is the standard OAuth pattern - actual endpoint TBD
  return `https://dash.cloudflare.com/oauth2/auth?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token.
 *
 * Note: Implementation depends on Cloudflare's OAuth provider specifics.
 * Currently, API tokens are the recommended approach.
 */
export async function exchangeCloudflareOAuthCode(
  _code: string,
  _config: CloudflareOAuthConfig
): Promise<CloudflareTokenInfo> {
  // Placeholder - Cloudflare OAuth for external apps is limited
  // In practice, users should create an API token via dashboard
  throw new Error(
    "Cloudflare OAuth for third-party apps requires registration. " +
      "Please use API tokens created via Cloudflare dashboard."
  );
}

// ============================================================================
// Integration Strategy
// ============================================================================

/**
 * Complete Cloudflare Crawler Hints integration flow.
 *
 * This encapsulates the recommended approach given current API limitations:
 * 1. Detect if domain uses Cloudflare
 * 2. If using CF, determine best path to enable Crawler Hints
 * 3. Return instructions or deep link for user action
 */
export interface CrawlerHintsIntegrationResult {
  /** Whether the domain uses Cloudflare */
  usesCloudflare: boolean;
  /** Detection details */
  detection: CloudflareDetectionResult;
  /** Whether Crawler Hints can be auto-enabled (currently always false) */
  canAutoEnable: boolean;
  /** Recommended action for the user */
  recommendedAction:
    | "enable-via-dashboard"
    | "connect-cloudflare-account"
    | "use-manual-indexnow"
    | "already-enabled";
  /** Deep link to Cloudflare dashboard (if applicable) */
  dashboardUrl?: string;
  /** User-facing instructions */
  instructions: string;
  /** Estimated time in minutes */
  estimatedMinutes: number;
}

export async function integrateCloudfareCrawlerHints(
  domain: string,
  options?: {
    /** If user has connected their Cloudflare account */
    apiToken?: string;
  }
): Promise<CrawlerHintsIntegrationResult> {
  // Step 1: Detect Cloudflare usage
  const detection = await detectCloudflare(domain);

  if (!detection.usesCloudflare) {
    // Try DNS detection as fallback
    const dnsDetection = await detectCloudflareViaDns(domain);

    if (!dnsDetection) {
      return {
        usesCloudflare: false,
        detection,
        canAutoEnable: false,
        recommendedAction: "use-manual-indexnow",
        instructions:
          "This domain does not appear to use Cloudflare. " +
          "Please use manual IndexNow key deployment instead.",
        estimatedMinutes: 5,
      };
    }

    // DNS detected but headers missing (possibly custom config)
    detection.usesCloudflare = true;
    detection.detectionMethod = "dns-nameserver";
  }

  // Step 2: If we have API token, try to check/enable
  if (options?.apiToken) {
    const client = new CloudflareApiClient(options.apiToken);

    try {
      // Find the zone
      const normalizedDomain = domain
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      const zone = await client.getZoneByName(normalizedDomain);

      if (zone) {
        const status = await client.getCrawlerHintsStatus(zone.id);

        if (status.enabled) {
          return {
            usesCloudflare: true,
            detection,
            canAutoEnable: false, // Already enabled
            recommendedAction: "already-enabled",
            dashboardUrl: status.dashboardUrl,
            instructions:
              "Crawler Hints is already enabled for this domain! " +
              "Cloudflare will automatically notify search engines via IndexNow " +
              "when your content changes.",
            estimatedMinutes: 0,
          };
        }

        // Try to enable (will likely fail with current API limitations)
        const enableResult = await client.enableCrawlerHints(zone.id);

        if (enableResult.enabled) {
          return {
            usesCloudflare: true,
            detection,
            canAutoEnable: true,
            recommendedAction: "already-enabled",
            dashboardUrl: enableResult.dashboardUrl,
            instructions: "Crawler Hints has been enabled successfully!",
            estimatedMinutes: 0,
          };
        }

        // API enable failed - direct to dashboard
        return {
          usesCloudflare: true,
          detection,
          canAutoEnable: false,
          recommendedAction: "enable-via-dashboard",
          dashboardUrl: enableResult.dashboardUrl,
          instructions:
            "Your Cloudflare account is connected, but Crawler Hints must be " +
            "enabled via the dashboard. Click the link below to enable it " +
            "with a single click.",
          estimatedMinutes: 1,
        };
      }
    } catch {
      // Token may not have permission for this zone
    }
  }

  // Step 3: No API access - provide dashboard instructions
  const normalizedDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return {
    usesCloudflare: true,
    detection,
    canAutoEnable: false,
    recommendedAction: "enable-via-dashboard",
    dashboardUrl: `https://dash.cloudflare.com/?search=${encodeURIComponent(
      normalizedDomain
    )}`,
    instructions:
      "Good news! Your site uses Cloudflare. You can enable IndexNow " +
      "with a single click in your Cloudflare dashboard:\n\n" +
      "1. Go to your Cloudflare dashboard\n" +
      "2. Select your domain\n" +
      "3. Navigate to Caching > Configuration\n" +
      "4. Enable 'Crawler Hints'\n\n" +
      "That's it! Cloudflare will automatically notify Bing, Yandex, and other " +
      "search engines whenever your content changes. No key file needed!",
    estimatedMinutes: 1,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  detectCloudflare,
  detectCloudflareViaDns,
  CloudflareApiClient,
  integrateCloudfareCrawlerHints,
  REQUIRED_SCOPES,
};
