/**
 * PlatformIntegrationFacade Tests
 * Phase 66-09: Platform Integration Facade
 *
 * Tests the unified facade that bridges:
 * - Phase 61 OAuth connections
 * - Phase 31/33 Write adapters
 * - Phase 39 CMS publishers
 * - Phase 66 Pixel system
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PlatformIntegrationFacade,
  type ConnectionStatus,
  type Integration,
  type FacadeDependencies,
  type Analytics,
  type Content,
  type Result,
  type PixelStatus,
  type PixelAnalytics,
  type DomChange,
  type DateRange,
  type SeoField,
} from "./platform-facade";

// -----------------------------------------------------------------------------
// Mock Dependencies
// -----------------------------------------------------------------------------

function createMockPixelService() {
  return {
    getInstallationBySiteId: vi.fn(),
    getInstallationConfig: vi.fn(),
    getOrCreateInstallation: vi.fn(),
  };
}

function createMockOAuthService() {
  return {
    getConnectionsByWorkspace: vi.fn(),
    getConnectionBySiteUrl: vi.fn(),
    getAccessToken: vi.fn(),
  };
}

function createMockWriteAdapterRegistry() {
  return {
    getAdapter: vi.fn(),
    hasAdapter: vi.fn(),
  };
}

function createMockCmsPublisherRegistry() {
  return {
    getPublisher: vi.fn(),
    hasPublisher: vi.fn(),
  };
}

function createMockDependencies(): FacadeDependencies {
  return {
    pixelService: createMockPixelService(),
    oauthService: createMockOAuthService(),
    writeAdapterRegistry: createMockWriteAdapterRegistry(),
    cmsPublisherRegistry: createMockCmsPublisherRegistry(),
  };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("PlatformIntegrationFacade", () => {
  let facade: PlatformIntegrationFacade;
  let deps: FacadeDependencies;

  beforeEach(() => {
    deps = createMockDependencies();
    facade = new PlatformIntegrationFacade(deps);
  });

  // ---------------------------------------------------------------------------
  // getConnectionStatus tests
  // ---------------------------------------------------------------------------

  describe("getConnectionStatus", () => {
    it("should return pixel and OAuth status combined", async () => {
      // Mock pixel installation
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        domain: "example.com",
        status: "verified",
        features: {
          analytics: true,
          cwv: true,
          metaInjection: false,
          schemaInjection: false,
          linkInjection: false,
          abTesting: false,
        },
      });

      // Mock OAuth connections
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([
        {
          id: "conn-1",
          platform: "google_search_console",
          status: "active",
          scopesGranted: ["webmasters.readonly"],
          lastSyncAt: new Date("2026-05-01"),
        },
        {
          id: "conn-2",
          platform: "google_analytics",
          status: "active",
          scopesGranted: ["analytics.readonly"],
          lastSyncAt: new Date("2026-05-02"),
        },
      ]);

      const status = await facade.getConnectionStatus("site-123", "workspace-1");

      expect(status.siteId).toBe("site-123");
      expect(status.domain).toBe("example.com");
      expect(status.pixelConnected).toBe(true);
      expect(status.pixelStatus).toBe("verified");
      expect(status.oauthConnections).toHaveLength(2);
      expect(status.oauthConnections[0].platform).toBe("google_search_console");
    });

    it("should return pixelConnected false when no pixel installed", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue(null);
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);

      const status = await facade.getConnectionStatus("site-123", "workspace-1");

      expect(status.pixelConnected).toBe(false);
      expect(status.pixelStatus).toBeUndefined();
    });

    it("should compute capabilities from pixel and OAuth features", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        domain: "example.com",
        status: "verified",
        features: {
          analytics: true,
          cwv: true,
          metaInjection: true,
          schemaInjection: false,
          linkInjection: false,
          abTesting: false,
        },
      });

      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([
        {
          id: "conn-1",
          platform: "google_search_console",
          status: "active",
          scopesGranted: ["webmasters"],
        },
        {
          id: "conn-2",
          platform: "wordpress_org",
          status: "active",
          scopesGranted: ["edit_posts", "edit_pages"],
        },
      ]);

      const status = await facade.getConnectionStatus("site-123", "workspace-1");

      expect(status.capabilities.analytics).toBe(true); // pixel analytics
      expect(status.capabilities.cwv).toBe(true); // pixel CWV
      expect(status.capabilities.historicalData).toBe(true); // GSC active
      expect(status.capabilities.publishing).toBe(true); // WordPress with write scopes
      expect(status.capabilities.seoEditing).toBe(true); // pixel metaInjection OR OAuth
    });
  });

  // ---------------------------------------------------------------------------
  // getAvailableIntegrations tests
  // ---------------------------------------------------------------------------

  describe("getAvailableIntegrations", () => {
    it("should return list of unconnected platforms", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue(null);
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([
        {
          id: "conn-1",
          platform: "google_search_console",
          status: "active",
        },
      ]);

      const integrations = await facade.getAvailableIntegrations("site-123", "workspace-1");

      // Should not include GSC (already connected)
      expect(integrations.some((i) => i.platform === "google_search_console")).toBe(false);
      // Should include other platforms
      expect(integrations.some((i) => i.platform === "google_analytics")).toBe(true);
      expect(integrations.some((i) => i.platform === "wordpress_org")).toBe(true);
    });

    it("should include pixel if not installed", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue(null);
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);

      const integrations = await facade.getAvailableIntegrations("site-123", "workspace-1");

      expect(integrations.some((i) => i.platform === "pixel")).toBe(true);
    });

    it("should exclude pixel if already installed", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        status: "verified",
      });
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);

      const integrations = await facade.getAvailableIntegrations("site-123", "workspace-1");

      expect(integrations.some((i) => i.platform === "pixel")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getAnalytics tests - routes to pixel or GA based on availability
  // ---------------------------------------------------------------------------

  describe("getAnalytics", () => {
    it("should route traffic analytics to GA OAuth if available", async () => {
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([
        {
          id: "conn-1",
          platform: "google_analytics",
          status: "active",
        },
      ]);

      const analytics = await facade.getAnalytics("site-123", "workspace-1", "traffic");

      expect(analytics.source).toBe("google_analytics");
      expect(deps.oauthService.getConnectionsByWorkspace).toHaveBeenCalled();
    });

    it("should fallback to pixel analytics for traffic when GA unavailable", async () => {
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        status: "verified",
      });

      const analytics = await facade.getAnalytics("site-123", "workspace-1", "traffic");

      expect(analytics.source).toBe("pixel");
    });

    it("should require GSC OAuth for rankings analytics", async () => {
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);

      const analytics = await facade.getAnalytics("site-123", "workspace-1", "rankings");

      expect(analytics.available).toBe(false);
      expect(analytics.requiredConnection).toBe("google_search_console");
    });

    it("should use pixel for CWV analytics (always available after pixel install)", async () => {
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        status: "verified",
        features: { cwv: true },
      });

      const analytics = await facade.getAnalytics("site-123", "workspace-1", "cwv");

      expect(analytics.source).toBe("pixel");
      expect(analytics.available).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // updateSeoField tests - routes to OAuth adapter or pixel DOM change
  // ---------------------------------------------------------------------------

  describe("updateSeoField", () => {
    it("should route to OAuth write adapter if available", async () => {
      const mockAdapter = {
        writeField: vi.fn().mockResolvedValue({ success: true }),
      };
      deps.writeAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      deps.writeAdapterRegistry.hasAdapter.mockReturnValue(true);

      const result = await facade.updateSeoField(
        "site-123",
        "workspace-1",
        "page-1",
        "meta_description",
        "New description"
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe("oauth");
      expect(mockAdapter.writeField).toHaveBeenCalledWith("page-1", "meta_description", "New description");
    });

    it("should queue pixel DOM change if no OAuth adapter", async () => {
      deps.writeAdapterRegistry.hasAdapter.mockReturnValue(false);
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        status: "verified",
        features: { metaInjection: true },
      });

      const result = await facade.updateSeoField(
        "site-123",
        "workspace-1",
        "page-1",
        "meta_description",
        "New description"
      );

      expect(result.success).toBe(true);
      expect(result.method).toBe("pixel");
      expect(result.pendingApproval).toBe(true);
    });

    it("should return unavailable if neither OAuth nor pixel available", async () => {
      deps.writeAdapterRegistry.hasAdapter.mockReturnValue(false);
      deps.pixelService.getInstallationBySiteId.mockResolvedValue(null);

      const result = await facade.updateSeoField(
        "site-123",
        "workspace-1",
        "page-1",
        "meta_description",
        "New description"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No write method available");
    });
  });

  // ---------------------------------------------------------------------------
  // publishContent tests - routes to P39 CMS publisher
  // ---------------------------------------------------------------------------

  describe("publishContent", () => {
    it("should route to CMS publisher when OAuth with write scopes available", async () => {
      const mockPublisher = {
        publish: vi.fn().mockResolvedValue({ success: true, url: "https://example.com/post-1" }),
      };
      deps.cmsPublisherRegistry.getPublisher.mockReturnValue(mockPublisher);
      deps.cmsPublisherRegistry.hasPublisher.mockReturnValue(true);

      const content: Content = {
        title: "Test Post",
        body: "<p>Hello world</p>",
        platform: "wordpress_org",
      };

      const result = await facade.publishContent("site-123", "workspace-1", content);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com/post-1");
      expect(mockPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({ title: "Test Post" }));
    });

    it("should return error when no OAuth with write scopes", async () => {
      deps.cmsPublisherRegistry.hasPublisher.mockReturnValue(false);

      const content: Content = {
        title: "Test Post",
        body: "<p>Hello world</p>",
        platform: "wordpress_org",
      };

      const result = await facade.publishContent("site-123", "workspace-1", content);

      expect(result.success).toBe(false);
      expect(result.error).toContain("requires OAuth connection with write scopes");
    });
  });

  // ---------------------------------------------------------------------------
  // Falls back gracefully when service unavailable
  // ---------------------------------------------------------------------------

  describe("fallback behavior", () => {
    it("should handle pixel service errors gracefully", async () => {
      deps.pixelService.getInstallationBySiteId.mockRejectedValue(new Error("DB connection failed"));
      deps.oauthService.getConnectionsByWorkspace.mockResolvedValue([]);

      const status = await facade.getConnectionStatus("site-123", "workspace-1");

      // Should return a valid status even with error
      expect(status.siteId).toBe("site-123");
      expect(status.pixelConnected).toBe(false);
      expect(status.error).toContain("DB connection failed");
    });

    it("should handle OAuth service errors gracefully", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        status: "verified",
      });
      deps.oauthService.getConnectionsByWorkspace.mockRejectedValue(new Error("OAuth service down"));

      const status = await facade.getConnectionStatus("site-123", "workspace-1");

      expect(status.pixelConnected).toBe(true);
      expect(status.oauthConnections).toEqual([]);
      expect(status.warning).toContain("OAuth service");
    });

    it("should handle write adapter errors gracefully", async () => {
      const mockAdapter = {
        writeField: vi.fn().mockRejectedValue(new Error("API rate limited")),
      };
      deps.writeAdapterRegistry.getAdapter.mockReturnValue(mockAdapter);
      deps.writeAdapterRegistry.hasAdapter.mockReturnValue(true);

      const result = await facade.updateSeoField(
        "site-123",
        "workspace-1",
        "page-1",
        "meta_description",
        "New description"
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("API rate limited");
    });
  });

  // ---------------------------------------------------------------------------
  // Pixel-specific operations
  // ---------------------------------------------------------------------------

  describe("getPixelStatus", () => {
    it("should return pixel installation status", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue({
        id: "install-1",
        siteId: "site-123",
        domain: "example.com",
        status: "verified",
        firstPingAt: new Date("2026-05-01T10:00:00Z"),
        lastPingAt: new Date("2026-05-03T10:00:00Z"),
        pingCount: 1500,
        features: {
          analytics: true,
          cwv: true,
          metaInjection: true,
          schemaInjection: false,
          linkInjection: false,
          abTesting: false,
        },
      });

      const status = await facade.getPixelStatus("site-123");

      expect(status.installed).toBe(true);
      expect(status.status).toBe("verified");
      expect(status.pingCount).toBe(1500);
      expect(status.features?.analytics).toBe(true);
    });

    it("should return not installed when pixel missing", async () => {
      deps.pixelService.getInstallationBySiteId.mockResolvedValue(null);

      const status = await facade.getPixelStatus("site-123");

      expect(status.installed).toBe(false);
      expect(status.status).toBeUndefined();
    });
  });
});
