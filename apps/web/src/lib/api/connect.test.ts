/**
 * Connect API Client Tests
 * Phase 66-04: Connection Wizard UI
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { connectApi, ConnectApiError } from "./connect";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("connectApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("detect", () => {
    it("sends POST request with URL and returns detection result", async () => {
      const mockResult = {
        platform: "shopify",
        confidence: 100,
        features: ["ecommerce"],
        paidPlanRequired: false,
        estimatedTime: "2 min",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResult),
      });

      const result = await connectApi.detect("example.myshopify.com");

      expect(mockFetch).toHaveBeenCalledWith("/api/connect/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "example.myshopify.com" }),
      });
      expect(result).toEqual(mockResult);
    });

    it("throws ConnectApiError on detection failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Invalid URL", code: "INVALID_URL" }),
      });

      await expect(connectApi.detect("invalid")).rejects.toThrow(ConnectApiError);

      const error = await connectApi.detect("invalid").catch((e) => e);
      expect(error.message).toBe("Invalid URL");
      expect(error.status).toBe(400);
      expect(error.code).toBe("INVALID_URL");
    });

    it("handles JSON parse errors gracefully", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Parse error")),
      });

      const error = await connectApi.detect("test.com").catch((e) => e);
      expect(error).toBeInstanceOf(ConnectApiError);
      expect(error.message).toBe("Detection failed");
      expect(error.status).toBe(500);
    });
  });

  describe("getGuide", () => {
    it("fetches guide for platform without siteId", async () => {
      const mockGuide = {
        guide: {
          platform: "shopify",
          name: "Shopify",
          steps: [{ number: 1, title: "Log in", description: "Log into Shopify" }],
          estimatedTime: "2 min",
          difficulty: "easy",
          paidPlanRequired: false,
          fallbackToGtm: true,
        },
        snippet: '<script async src="https://pixel.tevero.io/t.js" data-site="test"></script>',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGuide),
      });

      const result = await connectApi.getGuide("shopify");

      expect(mockFetch).toHaveBeenCalledWith("/api/connect/guide/shopify");
      expect(result).toEqual(mockGuide);
    });

    it("includes siteId in query params when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ guide: {}, snippet: "" }),
      });

      await connectApi.getGuide("wix", "site-123");

      expect(mockFetch).toHaveBeenCalledWith("/api/connect/guide/wix?siteId=site-123");
    });

    it("throws ConnectApiError when platform not found", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Platform not found" }),
      });

      const error = await connectApi.getGuide("invalid").catch((e) => e);
      expect(error).toBeInstanceOf(ConnectApiError);
      expect(error.status).toBe(404);
    });
  });

  describe("verify", () => {
    it("sends verification request with siteId", async () => {
      const mockResponse = {
        status: "detected",
        firstPing: "2026-05-03T12:00:00Z",
        location: "San Francisco, CA",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await connectApi.verify("site-123");

      expect(mockFetch).toHaveBeenCalledWith("/api/connect/verify?siteId=site-123");
      expect(result).toEqual(mockResponse);
    });

    it("throws error on verification failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Server error" }),
      });

      await expect(connectApi.verify("site-123")).rejects.toThrow(ConnectApiError);
    });
  });

  describe("createInstallation", () => {
    it("creates pixel installation", async () => {
      const mockResponse = {
        installationId: "install-456",
        siteId: "site-789",
        snippet: '<script async src="https://pixel.tevero.io/t.js" data-site="site-789"></script>',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await connectApi.createInstallation("workspace-1", "mysite.com");

      expect(mockFetch).toHaveBeenCalledWith("/api/pixel/installation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: "workspace-1", domain: "mysite.com" }),
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("sendHandoff", () => {
    it("sends developer handoff email", async () => {
      const mockResponse = {
        handoffId: "handoff-123",
        magicLink: "https://tevero.io/connect/abc123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await connectApi.sendHandoff("site-123", "dev@example.com", "Please add this");

      expect(mockFetch).toHaveBeenCalledWith("/api/connect/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: "site-123",
          email: "dev@example.com",
          message: "Please add this",
        }),
      });
      expect(result).toEqual(mockResponse);
    });

    it("works without optional message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ handoffId: "h1", magicLink: "https://x" }),
      });

      await connectApi.sendHandoff("site-123", "dev@example.com");

      expect(mockFetch).toHaveBeenCalledWith("/api/connect/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: "site-123",
          email: "dev@example.com",
          message: undefined,
        }),
      });
    });
  });
});

describe("ConnectApiError", () => {
  it("creates error with message, status, and code", () => {
    const error = new ConnectApiError("Test error", 400, "TEST_CODE");

    expect(error.message).toBe("Test error");
    expect(error.status).toBe(400);
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("ConnectApiError");
  });

  it("works without code", () => {
    const error = new ConnectApiError("Test error", 500);

    expect(error.code).toBeUndefined();
    expect(error.status).toBe(500);
  });
});
