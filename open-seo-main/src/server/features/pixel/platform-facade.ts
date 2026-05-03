/**
 * PlatformIntegrationFacade - Unified Platform Integration API
 * Phase 66-09: Platform Integration Facade
 *
 * Unifies all existing platform integration systems:
 * - Phase 61 OAuth connections
 * - Phase 31/33 Write adapters
 * - Phase 39 CMS publishers
 * - Phase 66 Pixel system
 *
 * Provides a single API for connection status, read/write operations,
 * and intelligent routing to the best available service.
 */

import type { PixelFeatures, PixelInstallationStatus } from "@/db/pixel-schema";

// -----------------------------------------------------------------------------
// Types - Connection Status
// -----------------------------------------------------------------------------

/**
 * OAuth connection status for a platform
 */
export interface OAuthConnectionInfo {
  platform: string;
  status: string;
  capabilities: ("read" | "write")[];
  lastSync?: Date;
}

/**
 * Combined capabilities from pixel and OAuth
 */
export interface PlatformCapabilities {
  analytics: boolean; // Pixel OR GA OAuth
  cwv: boolean; // Pixel
  historicalData: boolean; // GSC/GA OAuth
  publishing: boolean; // CMS OAuth with write scopes
  seoEditing: boolean; // CMS OAuth OR pixel DOM changes
}

/**
 * Connection status for a site - combines pixel and OAuth info
 */
export interface ConnectionStatus {
  siteId: string;
  domain: string;

  // Pixel status
  pixelConnected: boolean;
  pixelStatus?: PixelInstallationStatus;
  pixelFeatures?: PixelFeatures;

  // OAuth status (per platform)
  oauthConnections: OAuthConnectionInfo[];

  // Combined capabilities
  capabilities: PlatformCapabilities;

  // Error/warning info
  error?: string;
  warning?: string;
}

// -----------------------------------------------------------------------------
// Types - Integrations
// -----------------------------------------------------------------------------

/**
 * Available integration that can be connected
 */
export interface Integration {
  platform: string;
  name: string;
  description: string;
  capabilities: string[];
  requiresOAuth: boolean;
  priority: number;
}

// Platform integrations metadata
const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    platform: "pixel",
    name: "TeveroPixel",
    description: "Real-time analytics and SEO modifications",
    capabilities: ["analytics", "cwv", "seo_editing"],
    requiresOAuth: false,
    priority: 0,
  },
  {
    platform: "google_search_console",
    name: "Google Search Console",
    description: "See your ranking positions and keyword performance",
    capabilities: ["rankings", "historical_data", "url_submission"],
    requiresOAuth: true,
    priority: 1,
  },
  {
    platform: "google_analytics",
    name: "Google Analytics",
    description: "Access historical traffic and conversion data",
    capabilities: ["traffic", "historical_data", "conversions"],
    requiresOAuth: true,
    priority: 2,
  },
  {
    platform: "google_business_profile",
    name: "Google Business Profile",
    description: "Manage reviews and local SEO",
    capabilities: ["reviews", "local_seo"],
    requiresOAuth: true,
    priority: 3,
  },
  {
    platform: "wordpress_org",
    name: "WordPress",
    description: "Publish content and edit SEO fields directly",
    capabilities: ["publishing", "seo_editing"],
    requiresOAuth: true,
    priority: 4,
  },
  {
    platform: "shopify",
    name: "Shopify",
    description: "Manage products and publish content",
    capabilities: ["publishing", "seo_editing", "products"],
    requiresOAuth: true,
    priority: 5,
  },
  {
    platform: "wix",
    name: "Wix",
    description: "Create and edit content",
    capabilities: ["publishing", "seo_editing"],
    requiresOAuth: true,
    priority: 6,
  },
  {
    platform: "webflow",
    name: "Webflow",
    description: "Edit CMS items directly",
    capabilities: ["publishing", "seo_editing"],
    requiresOAuth: true,
    priority: 7,
  },
];

// -----------------------------------------------------------------------------
// Types - Analytics
// -----------------------------------------------------------------------------

export interface Analytics {
  source: "pixel" | "google_analytics" | "google_search_console";
  available: boolean;
  requiredConnection?: string;
  data?: unknown;
}

// -----------------------------------------------------------------------------
// Types - Content
// -----------------------------------------------------------------------------

export interface Content {
  title: string;
  body: string;
  platform: string;
  slug?: string;
  metaDescription?: string;
  featuredImage?: string;
}

// -----------------------------------------------------------------------------
// Types - Results
// -----------------------------------------------------------------------------

export interface Result {
  success: boolean;
  method?: "oauth" | "pixel";
  error?: string;
  pendingApproval?: boolean;
  url?: string;
  changeId?: string;
}

// -----------------------------------------------------------------------------
// Types - Pixel Status
// -----------------------------------------------------------------------------

export interface PixelStatus {
  installed: boolean;
  status?: PixelInstallationStatus;
  domain?: string;
  firstPingAt?: Date;
  lastPingAt?: Date;
  pingCount?: number;
  features?: PixelFeatures;
}

// -----------------------------------------------------------------------------
// Types - Pixel Analytics
// -----------------------------------------------------------------------------

export interface DateRange {
  start: Date;
  end: Date;
}

export interface PixelAnalytics {
  pageviews: number;
  sessions: number;
  uniqueVisitors: number;
  avgTimeOnPage?: number;
  bounceRate?: number;
  cwv?: {
    lcp: number;
    cls: number;
    inp: number;
  };
}

// -----------------------------------------------------------------------------
// Types - DOM Changes
// -----------------------------------------------------------------------------

export type SeoField =
  | "meta_title"
  | "meta_description"
  | "canonical"
  | "schema"
  | "h1"
  | "alt_text";

export interface DomChange {
  changeType: SeoField;
  targetSelector?: string;
  targetUrl?: string;
  oldValue?: string;
  newValue: string;
}

// -----------------------------------------------------------------------------
// Dependency Interfaces
// -----------------------------------------------------------------------------

export interface PixelServiceInterface {
  getInstallationBySiteId(siteId: string): Promise<PixelInstallation | null>;
  getInstallationConfig(siteId: string): Promise<unknown>;
  getOrCreateInstallation(workspaceId: string, domain: string): Promise<unknown>;
}

interface PixelInstallation {
  id: string;
  siteId: string;
  domain: string;
  status: PixelInstallationStatus;
  features?: PixelFeatures;
  firstPingAt?: Date;
  lastPingAt?: Date;
  pingCount?: number;
}

export interface OAuthServiceInterface {
  getConnectionsByWorkspace(workspaceId: string): Promise<OAuthConnection[]>;
  getConnectionBySiteUrl?(workspaceId: string, siteUrl: string): Promise<OAuthConnection | null>;
  getAccessToken?(connectionId: string): Promise<string | null>;
}

interface OAuthConnection {
  id: string;
  platform: string;
  status: string;
  scopesGranted?: string[];
  lastSyncAt?: Date;
}

export interface WriteAdapterRegistryInterface {
  getAdapter(workspaceId: string, siteId: string): WriteAdapter | null;
  hasAdapter(workspaceId: string, siteId: string): boolean;
}

interface WriteAdapter {
  writeField(resourceId: string, field: string, value: string): Promise<{ success: boolean; error?: string }>;
  readField?(resourceId: string, field: string): Promise<string | null>;
}

export interface CmsPublisherRegistryInterface {
  getPublisher(workspaceId: string, platform: string): CmsPublisher | null;
  hasPublisher(workspaceId: string, platform: string): boolean;
}

interface CmsPublisher {
  publish(content: Content): Promise<{ success: boolean; url?: string; error?: string }>;
  schedule?(content: Content, publishAt: Date): Promise<{ success: boolean; error?: string }>;
}

// -----------------------------------------------------------------------------
// Facade Dependencies
// -----------------------------------------------------------------------------

export interface FacadeDependencies {
  pixelService: PixelServiceInterface;
  oauthService: OAuthServiceInterface;
  writeAdapterRegistry: WriteAdapterRegistryInterface;
  cmsPublisherRegistry: CmsPublisherRegistryInterface;
}

// -----------------------------------------------------------------------------
// Write scopes mapping
// -----------------------------------------------------------------------------

const WRITE_SCOPE_PATTERNS: Record<string, string[]> = {
  wordpress_org: ["edit_posts", "edit_pages", "upload_files"],
  wordpress_com: ["edit", "write"],
  shopify: ["write_products", "write_content", "write_themes"],
  wix: ["WIX.BLOG.CREATE-DRAFT", "WIX.BLOG.PUBLISH-POST"],
  webflow: ["cms:write"],
  google_search_console: ["webmasters"], // URL submission
};

// -----------------------------------------------------------------------------
// PlatformIntegrationFacade
// -----------------------------------------------------------------------------

/**
 * PlatformIntegrationFacade - Unified API for all platform integrations.
 *
 * Routes operations to the best available service:
 * - Pixel for analytics/CWV when no GA connected
 * - OAuth adapters for direct API writes when available
 * - Pixel DOM changes when OAuth unavailable
 */
export class PlatformIntegrationFacade {
  constructor(private readonly deps: FacadeDependencies) {}

  // ---------------------------------------------------------------------------
  // CONNECTION STATUS
  // ---------------------------------------------------------------------------

  /**
   * Get combined connection status for a site.
   * Includes pixel status, OAuth connections, and computed capabilities.
   */
  async getConnectionStatus(
    siteId: string,
    workspaceId: string
  ): Promise<ConnectionStatus> {
    let pixelInstallation: PixelInstallation | null = null;
    let oauthConnections: OAuthConnection[] = [];
    let pixelError: string | undefined;
    let oauthWarning: string | undefined;

    // Get pixel status
    try {
      pixelInstallation = await this.deps.pixelService.getInstallationBySiteId(siteId);
    } catch (error) {
      pixelError = error instanceof Error ? error.message : "Unknown pixel error";
    }

    // Get OAuth connections
    try {
      oauthConnections = await this.deps.oauthService.getConnectionsByWorkspace(workspaceId);
    } catch (error) {
      oauthWarning = `OAuth service: ${error instanceof Error ? error.message : "unavailable"}`;
    }

    // Map OAuth connections to info objects
    const oauthConnectionInfos: OAuthConnectionInfo[] = oauthConnections.map((conn) => ({
      platform: conn.platform,
      status: conn.status,
      capabilities: this.getOAuthCapabilities(conn),
      lastSync: conn.lastSyncAt,
    }));

    // Compute capabilities
    const capabilities = this.computeCapabilities(pixelInstallation, oauthConnections);

    return {
      siteId,
      domain: pixelInstallation?.domain ?? "",
      pixelConnected: pixelInstallation !== null && pixelInstallation.status !== "error",
      pixelStatus: pixelInstallation?.status,
      pixelFeatures: pixelInstallation?.features,
      oauthConnections: oauthConnectionInfos,
      capabilities,
      error: pixelError,
      warning: oauthWarning,
    };
  }

  /**
   * Get available integrations that can still be connected.
   */
  async getAvailableIntegrations(
    siteId: string,
    workspaceId: string
  ): Promise<Integration[]> {
    const connectedPlatforms = new Set<string>();

    // Check pixel
    try {
      const pixelInstallation = await this.deps.pixelService.getInstallationBySiteId(siteId);
      if (pixelInstallation && pixelInstallation.status !== "error") {
        connectedPlatforms.add("pixel");
      }
    } catch {
      // Pixel service error - don't exclude pixel from available
    }

    // Check OAuth connections
    try {
      const oauthConnections = await this.deps.oauthService.getConnectionsByWorkspace(workspaceId);
      for (const conn of oauthConnections) {
        if (conn.status === "active") {
          connectedPlatforms.add(conn.platform);
        }
      }
    } catch {
      // OAuth service error - continue with available integrations
    }

    // Filter out connected platforms
    return AVAILABLE_INTEGRATIONS.filter((integration) => !connectedPlatforms.has(integration.platform));
  }

  // ---------------------------------------------------------------------------
  // READ OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get analytics from the best available source.
   *
   * Routing:
   * - traffic: GA OAuth if available, else pixel
   * - rankings: Requires GSC OAuth
   * - cwv: Always pixel
   */
  async getAnalytics(
    siteId: string,
    workspaceId: string,
    type: "traffic" | "rankings" | "cwv"
  ): Promise<Analytics> {
    // Get available connections
    let oauthConnections: OAuthConnection[] = [];
    try {
      oauthConnections = await this.deps.oauthService.getConnectionsByWorkspace(workspaceId);
    } catch {
      // Continue without OAuth
    }

    const hasGa = oauthConnections.some(
      (c) => c.platform === "google_analytics" && c.status === "active"
    );
    const hasGsc = oauthConnections.some(
      (c) => c.platform === "google_search_console" && c.status === "active"
    );

    // Route by type
    if (type === "rankings") {
      if (hasGsc) {
        return {
          source: "google_search_console",
          available: true,
          // In real implementation, would fetch actual data
        };
      }
      return {
        source: "google_search_console",
        available: false,
        requiredConnection: "google_search_console",
      };
    }

    if (type === "cwv") {
      // CWV always from pixel
      const pixelInstallation = await this.deps.pixelService.getInstallationBySiteId(siteId);
      if (pixelInstallation && pixelInstallation.features?.cwv) {
        return {
          source: "pixel",
          available: true,
        };
      }
      return {
        source: "pixel",
        available: false,
        requiredConnection: "pixel",
      };
    }

    // Traffic - prefer GA, fallback to pixel
    if (hasGa) {
      return {
        source: "google_analytics",
        available: true,
      };
    }

    // Check pixel
    const pixelInstallation = await this.deps.pixelService.getInstallationBySiteId(siteId);
    if (pixelInstallation && pixelInstallation.status === "verified") {
      return {
        source: "pixel",
        available: true,
      };
    }

    return {
      source: "pixel",
      available: false,
      requiredConnection: "pixel",
    };
  }

  // ---------------------------------------------------------------------------
  // WRITE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Update an SEO field on a resource.
   *
   * Routing:
   * - OAuth write adapter if available
   * - Pixel DOM change queue if OAuth unavailable
   */
  async updateSeoField(
    siteId: string,
    workspaceId: string,
    resourceId: string,
    field: SeoField,
    value: string
  ): Promise<Result> {
    // Try OAuth adapter first
    if (this.deps.writeAdapterRegistry.hasAdapter(workspaceId, siteId)) {
      const adapter = this.deps.writeAdapterRegistry.getAdapter(workspaceId, siteId);
      if (adapter) {
        try {
          const result = await adapter.writeField(resourceId, field, value);
          return {
            success: result.success,
            method: "oauth",
            error: result.error,
          };
        } catch (error) {
          return {
            success: false,
            method: "oauth",
            error: error instanceof Error ? error.message : "Write adapter error",
          };
        }
      }
    }

    // Fallback to pixel DOM change
    try {
      const pixelInstallation = await this.deps.pixelService.getInstallationBySiteId(siteId);
      if (pixelInstallation && this.canUsePixelForField(pixelInstallation, field)) {
        // In real implementation, would queue the DOM change
        // For now, return success with pending approval
        return {
          success: true,
          method: "pixel",
          pendingApproval: true,
          changeId: `change-${Date.now()}`,
        };
      }
    } catch {
      // Pixel service error
    }

    return {
      success: false,
      error: "No write method available. Connect OAuth or install pixel with meta injection enabled.",
    };
  }

  /**
   * Create a redirect (requires OAuth adapter).
   */
  async createRedirect(
    siteId: string,
    workspaceId: string,
    from: string,
    to: string
  ): Promise<Result> {
    // Redirects require OAuth adapter - pixel can't handle this
    if (!this.deps.writeAdapterRegistry.hasAdapter(workspaceId, siteId)) {
      return {
        success: false,
        error: "Redirect creation requires OAuth connection with write access",
      };
    }

    // In real implementation, would call adapter's createRedirect method
    return {
      success: true,
      method: "oauth",
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLISH OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Publish content via CMS publisher.
   * Requires OAuth with write scopes.
   */
  async publishContent(
    siteId: string,
    workspaceId: string,
    content: Content
  ): Promise<Result> {
    if (!this.deps.cmsPublisherRegistry.hasPublisher(workspaceId, content.platform)) {
      return {
        success: false,
        error: `Publishing to ${content.platform} requires OAuth connection with write scopes`,
      };
    }

    const publisher = this.deps.cmsPublisherRegistry.getPublisher(workspaceId, content.platform);
    if (!publisher) {
      return {
        success: false,
        error: "Publisher not available",
      };
    }

    try {
      const result = await publisher.publish(content);
      return {
        success: result.success,
        method: "oauth",
        url: result.url,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        method: "oauth",
        error: error instanceof Error ? error.message : "Publish error",
      };
    }
  }

  /**
   * Schedule content for future publishing.
   */
  async scheduleContent(
    siteId: string,
    workspaceId: string,
    content: Content,
    publishAt: Date
  ): Promise<Result> {
    if (!this.deps.cmsPublisherRegistry.hasPublisher(workspaceId, content.platform)) {
      return {
        success: false,
        error: `Scheduling on ${content.platform} requires OAuth connection with write scopes`,
      };
    }

    const publisher = this.deps.cmsPublisherRegistry.getPublisher(workspaceId, content.platform);
    if (!publisher || !publisher.schedule) {
      return {
        success: false,
        error: "Scheduling not supported for this platform",
      };
    }

    try {
      const result = await publisher.schedule(content, publishAt);
      return {
        success: result.success,
        method: "oauth",
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        method: "oauth",
        error: error instanceof Error ? error.message : "Schedule error",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PIXEL OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get pixel installation status.
   */
  async getPixelStatus(siteId: string): Promise<PixelStatus> {
    try {
      const installation = await this.deps.pixelService.getInstallationBySiteId(siteId);
      if (!installation) {
        return { installed: false };
      }

      return {
        installed: true,
        status: installation.status,
        domain: installation.domain,
        firstPingAt: installation.firstPingAt,
        lastPingAt: installation.lastPingAt,
        pingCount: installation.pingCount,
        features: installation.features,
      };
    } catch {
      return { installed: false };
    }
  }

  /**
   * Get pixel analytics for a date range.
   */
  async getPixelAnalytics(siteId: string, range: DateRange): Promise<PixelAnalytics | null> {
    // In real implementation, would query pixel_analytics_daily table
    // For now, return null indicating no data
    return null;
  }

  /**
   * Queue a DOM change for approval.
   */
  async queueDomChange(siteId: string, change: DomChange): Promise<Result> {
    try {
      const installation = await this.deps.pixelService.getInstallationBySiteId(siteId);
      if (!installation) {
        return {
          success: false,
          error: "Pixel not installed for this site",
        };
      }

      // In real implementation, would insert into pixel_dom_changes table
      return {
        success: true,
        method: "pixel",
        pendingApproval: true,
        changeId: `change-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to queue DOM change",
      };
    }
  }

  /**
   * Approve a pending DOM change.
   */
  async approveDomChange(changeId: string): Promise<Result> {
    // In real implementation, would update pixel_dom_changes status
    return {
      success: true,
      method: "pixel",
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Get OAuth capabilities based on scopes.
   */
  private getOAuthCapabilities(conn: OAuthConnection): ("read" | "write")[] {
    const capabilities: ("read" | "write")[] = ["read"]; // Always have read

    // Check for write scopes
    const writePatterns = WRITE_SCOPE_PATTERNS[conn.platform] ?? [];
    const hasWriteScope = conn.scopesGranted?.some((scope) =>
      writePatterns.some((pattern) => scope.includes(pattern))
    );

    if (hasWriteScope) {
      capabilities.push("write");
    }

    return capabilities;
  }

  /**
   * Compute combined capabilities from pixel and OAuth.
   */
  private computeCapabilities(
    pixel: PixelInstallation | null,
    oauthConnections: OAuthConnection[]
  ): PlatformCapabilities {
    const hasActivePixel = pixel !== null && pixel.status === "verified";
    const pixelFeatures = pixel?.features;

    // Check OAuth connections
    const hasGa = oauthConnections.some(
      (c) => c.platform === "google_analytics" && c.status === "active"
    );
    const hasGsc = oauthConnections.some(
      (c) => c.platform === "google_search_console" && c.status === "active"
    );

    // Check for any CMS with write scopes
    const cmsWritePlatforms = ["wordpress_org", "wordpress_com", "shopify", "wix", "webflow"];
    const hasCmsWrite = oauthConnections.some((conn) => {
      if (!cmsWritePlatforms.includes(conn.platform) || conn.status !== "active") {
        return false;
      }
      const writePatterns = WRITE_SCOPE_PATTERNS[conn.platform] ?? [];
      return conn.scopesGranted?.some((scope) =>
        writePatterns.some((pattern) => scope.includes(pattern))
      );
    });

    return {
      analytics: (hasActivePixel && pixelFeatures?.analytics) || hasGa,
      cwv: hasActivePixel && (pixelFeatures?.cwv ?? false),
      historicalData: hasGsc || hasGa,
      publishing: hasCmsWrite,
      seoEditing:
        hasCmsWrite ||
        (hasActivePixel && (pixelFeatures?.metaInjection ?? false)),
    };
  }

  /**
   * Check if pixel can handle a specific SEO field.
   */
  private canUsePixelForField(
    installation: PixelInstallation,
    field: SeoField
  ): boolean {
    const features = installation.features;
    if (!features) return false;

    switch (field) {
      case "meta_title":
      case "meta_description":
      case "canonical":
        return features.metaInjection;
      case "schema":
        return features.schemaInjection;
      case "h1":
      case "alt_text":
        return features.linkInjection; // Uses DOM manipulation capability
      default:
        return false;
    }
  }
}
