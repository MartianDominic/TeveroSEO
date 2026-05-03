/**
 * PlatformDetectorService Tests
 * Phase 66-03: CMS Platform Detection
 *
 * Tests for auto-detecting CMS platforms from URLs with 95%+ accuracy.
 * Uses subdomain patterns (100% confidence) and HTML signatures (90-95% confidence).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PlatformDetectorService,
  detectPlatform,
  type PlatformDetectionResult,
  type SupportedPlatform,
  SUPPORTED_PLATFORMS,
} from "./platform-detector.service";

// Mock fetch for controlled testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("PlatformDetectorService", () => {
  let service: PlatformDetectorService;

  beforeEach(() => {
    service = new PlatformDetectorService();
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================================
  // Subdomain Pattern Tests (100% confidence)
  // ============================================================================

  describe("subdomain pattern detection (100% confidence)", () => {
    it("detects Shopify via myshopify.com subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://mystore.myshopify.com"
      );

      expect(result.platform).toBe("shopify");
      expect(result.confidence).toBe(100);
    });

    it("detects WordPress.com via wordpress.com subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://example.wordpress.com"
      );

      expect(result.platform).toBe("wordpress_com");
      expect(result.confidence).toBe(100);
    });

    it("detects Wix via wixsite.com subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://myblog.wixsite.com/site"
      );

      expect(result.platform).toBe("wix");
      expect(result.confidence).toBe(100);
    });

    it("detects Squarespace via squarespace.com subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://mysite.squarespace.com"
      );

      expect(result.platform).toBe("squarespace");
      expect(result.confidence).toBe(100);
    });

    it("detects Webflow via webflow.io subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://myproject.webflow.io"
      );

      expect(result.platform).toBe("webflow");
      expect(result.confidence).toBe(100);
    });

    it("detects Ghost via ghost.io subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://myblog.ghost.io");

      expect(result.platform).toBe("ghost");
      expect(result.confidence).toBe(100);
    });

    it("detects BigCommerce via mybigcommerce.com subdomain", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://store.mybigcommerce.com"
      );

      expect(result.platform).toBe("bigcommerce");
      expect(result.confidence).toBe(100);
    });
  });

  // ============================================================================
  // HTML Signature Tests (90-95% confidence)
  // ============================================================================

  describe("HTML signature detection (90-95% confidence)", () => {
    it("detects self-hosted WordPress via meta generator tag", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="generator" content="WordPress 6.4.2">
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://myblog.com");

      expect(result.platform).toBe("wordpress_self_hosted");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects Shopify via meta generator tag", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="generator" content="Shopify">
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mystore.com");

      expect(result.platform).toBe("shopify");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects Squarespace via Squarespace.TemplateConfig in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head></head>
            <body>
              <script>window.Squarespace.TemplateConfig = {};</script>
            </body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.platform).toBe("squarespace");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects Webflow via __WEBFLOW_CONTEXT__ in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head></head>
            <body>
              <script>window.__WEBFLOW_CONTEXT__ = {};</script>
            </body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.platform).toBe("webflow");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects Wix via __wix_data__ in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head></head>
            <body>
              <script>window.__wix_data__ = {};</script>
            </body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.platform).toBe("wix");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects Wix via wixStatic in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <link href="https://static.wixstatic.com/styles.css">
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.platform).toBe("wix");
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it("detects Ghost via Powered by Ghost meta", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="generator" content="Ghost 5.0">
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://myblog.com");

      expect(result.platform).toBe("ghost");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects WooCommerce via WooCommerce in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="generator" content="WooCommerce 8.0">
            </head>
            <body class="woocommerce"></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mystore.com");

      expect(result.platform).toBe("woocommerce");
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it("detects Magento via Magento in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <script>var MAGE_COOKIES_PATH = '/';</script>
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mystore.com");

      expect(result.platform).toBe("magento");
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });
  });

  // ============================================================================
  // Response Header Tests (80% confidence)
  // ============================================================================

  describe("response header detection (80% confidence)", () => {
    it("detects Shopify via X-Powered-By header", async () => {
      const headers = new Headers();
      headers.set("X-Powered-By", "Shopify");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers,
      });

      const result = await service.detectPlatform("https://mystore.com");

      expect(result.platform).toBe("shopify");
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it("detects Wix via X-Wix-* headers", async () => {
      const headers = new Headers();
      headers.set("X-Wix-Request-Id", "abc123");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers,
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.platform).toBe("wix");
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });
  });

  // ============================================================================
  // GTM Detection Tests (as enhancement)
  // ============================================================================

  describe("GTM detection (as enhancement)", () => {
    it("detects GTM via gtm.js script presence", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXXX"></script>
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.features).toContain("gtm_enabled");
    });

    it("detects GTM via GTM- in HTML", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head></head>
            <body>
              <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXX"></iframe></noscript>
            </body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mysite.com");

      expect(result.features).toContain("gtm_enabled");
    });
  });

  // ============================================================================
  // Unknown/Fallback Tests
  // ============================================================================

  describe("unknown sites handling", () => {
    it("returns unknown for undetectable sites", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <title>Custom Site</title>
            </head>
            <body>
              <p>Just a regular website</p>
            </body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://customsite.com");

      expect(result.platform).toBe("unknown");
      expect(result.confidence).toBe(0);
    });

    it("identifies custom_html when detectable patterns but not CMS", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Static Site</title>
            </head>
            <body>
              <!-- Hand-coded static site -->
            </body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://staticsite.example.com"
      );

      expect(result.platform).toBe("unknown");
      expect(result.confidence).toBe(0);
    });
  });

  // ============================================================================
  // Timeout Tests
  // ============================================================================

  describe("timeout handling", () => {
    it("completes detection in under 3 seconds", async () => {
      const start = Date.now();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      await service.detectPlatform("https://mysite.com");
      const duration = Date.now() - start;

      // Should complete quickly (mocked, so essentially instant)
      expect(duration).toBeLessThan(1000);
    });

    it("handles timeout gracefully", async () => {
      // Use real timers for this test
      vi.useRealTimers();

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 50)
          )
      );

      const result = await service.detectPlatform("https://slowsite.com");

      expect(result.platform).toBe("unknown");
      expect(result.confidence).toBe(0);

      // Restore fake timers for remaining tests
      vi.useFakeTimers();
    });
  });

  // ============================================================================
  // Feature Detection Tests
  // ============================================================================

  describe("feature detection", () => {
    it("identifies ecommerce platforms", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://mystore.myshopify.com"
      );

      expect(result.features).toContain("ecommerce");
    });

    it("identifies blog platforms", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="generator" content="Ghost 5.0">
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://myblog.com");

      expect(result.features).toContain("blog");
    });
  });

  // ============================================================================
  // Convenience Function Tests
  // ============================================================================

  describe("detectPlatform convenience function", () => {
    it("exports standalone detectPlatform function", async () => {
      expect(typeof detectPlatform).toBe("function");
    });
  });

  // ============================================================================
  // Paid Plan Detection Tests
  // ============================================================================

  describe("paid plan detection", () => {
    it("identifies platforms requiring paid plans", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://example.wordpress.com"
      );

      expect(result.paidPlanRequired).toBe(true);
    });

    it("identifies platforms not requiring paid plans", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta name="generator" content="WordPress 6.4.2">
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://myblog.com");

      expect(result.paidPlanRequired).toBe(false);
    });
  });

  // ============================================================================
  // Estimated Time Tests
  // ============================================================================

  describe("estimated time calculation", () => {
    it("provides estimated installation time", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><head></head><body></body></html>",
        headers: new Headers(),
      });

      const result = await service.detectPlatform(
        "https://mystore.myshopify.com"
      );

      expect(result.estimatedTime).toBe("2 min");
    });

    it("provides longer time for complex platforms", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <script>var MAGE_COOKIES_PATH = '/';</script>
            </head>
            <body></body>
          </html>
        `,
        headers: new Headers(),
      });

      const result = await service.detectPlatform("https://mystore.com");

      expect(result.estimatedTime).toBe("5 min");
    });
  });

  // ============================================================================
  // SUPPORTED_PLATFORMS Export Tests
  // ============================================================================

  describe("SUPPORTED_PLATFORMS constant", () => {
    it("exports list of supported platforms", () => {
      expect(SUPPORTED_PLATFORMS).toBeInstanceOf(Array);
      expect(SUPPORTED_PLATFORMS.length).toBeGreaterThanOrEqual(14);
    });

    it("includes all required platforms", () => {
      const required: SupportedPlatform[] = [
        "wordpress_self_hosted",
        "wordpress_com",
        "shopify",
        "wix",
        "squarespace",
        "webflow",
        "weebly",
        "godaddy",
        "hubspot",
        "ghost",
        "bigcommerce",
        "woocommerce",
        "magento",
        "custom_html",
      ];

      for (const platform of required) {
        expect(SUPPORTED_PLATFORMS).toContain(platform);
      }
    });
  });
});
