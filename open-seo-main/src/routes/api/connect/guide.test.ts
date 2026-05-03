/**
 * Guide API Endpoint Tests
 * Phase 66-03: Installation Guide API
 */
import { describe, it, expect, vi } from "vitest";

// Mock the CMS guides
vi.mock("@/server/features/pixel/cms-guides", () => ({
  getGuide: vi.fn((platform: string, siteId?: string) => {
    if (platform === "shopify") {
      return {
        platform: "shopify",
        name: "Shopify",
        paidPlanRequired: false,
        estimatedTime: "2 min",
        difficulty: "easy",
        fallbackToGtm: true,
        steps: [
          {
            number: 1,
            title: "Log into Shopify admin",
            description: "Go to yourstore.myshopify.com/admin and sign in.",
          },
          {
            number: 2,
            title: "Go to Online Store, then Themes",
            description: 'Click "Online Store" then "Themes".',
          },
          {
            number: 3,
            title: "Edit your theme code",
            description: 'Click "Edit code".',
          },
          {
            number: 4,
            title: "Add the TeveroSEO helper",
            description: "Paste this code:",
            code: siteId
              ? `<script async src="https://pixel.tevero.io/t.js" data-site="${siteId}"></script>`
              : '<script async src="https://pixel.tevero.io/t.js" data-site="{{SITE_ID}}"></script>',
          },
          {
            number: 5,
            title: "Save your changes",
            description: "Click Save. That's it!",
          },
        ],
      };
    }
    return undefined;
  }),
  SUPPORTED_PLATFORMS: [
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
    "gtm_fallback",
  ],
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("GET /api/connect/guide/:platform", () => {
  describe("valid platform", () => {
    it("returns guide for valid platform", async () => {
      const { Route } = await import("./guide/[platform]");
      const handler = Route.options.server?.handlers?.GET;

      const request = new Request(
        "http://localhost/api/connect/guide/shopify",
        { method: "GET" }
      );

      const response = await handler!({
        request,
        params: { platform: "shopify" },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.guide).toBeDefined();
      expect(data.guide.platform).toBe("shopify");
      expect(data.guide.steps.length).toBe(5);
      expect(data.snippet).toContain("pixel.tevero.io");
    });

    it("interpolates siteId into code snippets", async () => {
      const { Route } = await import("./guide/[platform]");
      const handler = Route.options.server?.handlers?.GET;

      const request = new Request(
        "http://localhost/api/connect/guide/shopify?siteId=my-site-123",
        { method: "GET" }
      );

      const response = await handler!({
        request,
        params: { platform: "shopify" },
      });

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.snippet).toContain("my-site-123");
      expect(data.snippet).not.toContain("{{SITE_ID}}");
    });

    it("keeps placeholder when no siteId provided", async () => {
      const { Route } = await import("./guide/[platform]");
      const handler = Route.options.server?.handlers?.GET;

      const request = new Request(
        "http://localhost/api/connect/guide/shopify",
        { method: "GET" }
      );

      const response = await handler!({
        request,
        params: { platform: "shopify" },
      });

      const data = await response.json();
      expect(data.snippet).toContain("{{SITE_ID}}");
    });
  });

  describe("invalid platform", () => {
    it("returns 404 for unknown platform", async () => {
      const { Route } = await import("./guide/[platform]");
      const handler = Route.options.server?.handlers?.GET;

      const request = new Request(
        "http://localhost/api/connect/guide/nonexistent",
        { method: "GET" }
      );

      const response = await handler!({
        request,
        params: { platform: "nonexistent" },
      });

      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toContain("No guide found");
      expect(data.supportedPlatforms).toBeDefined();
      expect(data.supportedPlatforms.length).toBeGreaterThan(0);
    });

    it("returns 400 for empty platform", async () => {
      const { Route } = await import("./guide/[platform]");
      const handler = Route.options.server?.handlers?.GET;

      const request = new Request("http://localhost/api/connect/guide/", {
        method: "GET",
      });

      const response = await handler!({
        request,
        params: { platform: "" },
      });

      expect(response.status).toBe(400);
    });
  });
});
