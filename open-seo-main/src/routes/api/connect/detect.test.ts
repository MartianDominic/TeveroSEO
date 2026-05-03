/**
 * Detection API Endpoint Tests
 * Phase 66-03: CMS Platform Detection API
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the platform detector service using class
vi.mock("@/server/features/pixel/platform-detector.service", () => {
  return {
    PlatformDetectorService: class MockPlatformDetectorService {
      timeout: number;
      constructor(options?: { timeout?: number }) {
        this.timeout = options?.timeout ?? 3000;
      }
      async detectPlatform(_url: string) {
        return {
          platform: "shopify",
          confidence: 100,
          features: ["ecommerce"],
          paidPlanRequired: false,
          estimatedTime: "2 min",
        };
      }
    },
  };
});

// Mock the CMS guides
vi.mock("@/server/features/pixel/cms-guides", () => ({
  CMS_GUIDES: {
    shopify: {
      platform: "shopify",
      name: "Shopify",
      paidPlanRequired: false,
      estimatedTime: "2 min",
      steps: [],
      difficulty: "easy",
      fallbackToGtm: true,
    },
  },
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("POST /api/connect/detect", () => {
  describe("input validation", () => {
    it("rejects empty URL", async () => {
      // Import dynamically to use mocks
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Invalid input");
    });

    it("rejects localhost (SSRF protection)", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://localhost:3000" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe("Invalid input");
    });

    it("rejects 127.0.0.1 (SSRF protection)", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://127.0.0.1" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(400);
    });

    it("rejects 10.x.x.x private IPs (SSRF protection)", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://10.0.0.1" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(400);
    });

    it("rejects 192.168.x.x private IPs (SSRF protection)", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://192.168.1.1" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(400);
    });

    it("rejects AWS metadata endpoint (SSRF protection)", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "http://169.254.169.254/latest/meta-data" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(400);
    });
  });

  describe("successful detection", () => {
    it("detects platform and returns response", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://mystore.myshopify.com" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.platform).toBe("shopify");
      expect(data.confidence).toBe(100);
      expect(data.features).toContain("ecommerce");
      expect(data.paidPlanRequired).toBe(false);
      expect(data.estimatedTime).toBe("2 min");
      expect(data.hasGuide).toBe(true);
    });

    it("adds https:// if missing", async () => {
      const { Route } = await import("./detect");
      const handler = Route.options.server?.handlers?.POST;

      const request = new Request("http://localhost/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "mystore.myshopify.com" }),
      });

      const response = await handler!({ request });
      expect(response.status).toBe(200);
    });
  });
});
