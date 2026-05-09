/**
 * Tests for Cloudflare Crawler Hints Integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  detectCloudflare,
  detectCloudflareViaDns,
  CloudflareApiClient,
  integrateCloudfareCrawlerHints,
  REQUIRED_SCOPES,
} from "../crawler-hints";

// ============================================================================
// Mocks
// ============================================================================

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// detectCloudflare Tests
// ============================================================================

describe("detectCloudflare", () => {
  it("should detect Cloudflare via CF-Ray header", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({
        "cf-ray": "230b030023ae2822-SJC",
        "cf-cache-status": "HIT",
        server: "cloudflare",
      }),
    });

    const result = await detectCloudflare("example.com");

    expect(result.usesCloudflare).toBe(true);
    expect(result.detectionMethod).toBe("cf-ray-header");
    expect(result.cfRay).toBe("230b030023ae2822-SJC");
    expect(result.dataCenter).toBe("SJC");
    expect(result.cacheEnabled).toBe(true);
    expect(result.cacheStatus).toBe("HIT");
  });

  it("should detect Cloudflare via Server header when CF-Ray absent", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({
        server: "cloudflare",
      }),
    });

    const result = await detectCloudflare("example.com");

    expect(result.usesCloudflare).toBe(true);
    expect(result.detectionMethod).toBe("server-header");
  });

  it("should return false when no Cloudflare indicators", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({
        server: "nginx",
      }),
    });

    const result = await detectCloudflare("example.com");

    expect(result.usesCloudflare).toBe(false);
    expect(result.detectionMethod).toBe("none");
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await detectCloudflare("example.com");

    expect(result.usesCloudflare).toBe(false);
    expect(result.detectionMethod).toBe("none");
    expect(result.error).toBe("Network error");
  });

  it("should normalize domain with protocol", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({
        "cf-ray": "abc123-LAX",
      }),
    });

    await detectCloudflare("https://example.com/");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ method: "HEAD" })
    );
  });
});

// ============================================================================
// detectCloudflareViaDns Tests
// ============================================================================

describe("detectCloudflareViaDns", () => {
  it("should detect Cloudflare nameservers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Answer: [
          { data: "anna.ns.cloudflare.com" },
          { data: "bob.ns.cloudflare.com" },
        ],
      }),
    });

    const result = await detectCloudflareViaDns("example.com");

    expect(result).toBe(true);
  });

  it("should return false for non-Cloudflare nameservers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Answer: [
          { data: "ns1.google.com" },
          { data: "ns2.google.com" },
        ],
      }),
    });

    const result = await detectCloudflareViaDns("example.com");

    expect(result).toBe(false);
  });

  it("should handle missing Answer field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await detectCloudflareViaDns("example.com");

    expect(result).toBe(false);
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("DNS query failed"));

    const result = await detectCloudflareViaDns("example.com");

    expect(result).toBe(false);
  });
});

// ============================================================================
// CloudflareApiClient Tests
// ============================================================================

describe("CloudflareApiClient", () => {
  const client = new CloudflareApiClient("test-api-token");

  describe("listZones", () => {
    it("should list zones successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          errors: [],
          result: [
            {
              id: "zone-123",
              name: "example.com",
              status: "active",
              paused: false,
              type: "full",
              development_mode: 0,
              plan: {
                id: "plan-1",
                name: "Free",
                is_subscribed: true,
              },
              created_on: "2024-01-01T00:00:00Z",
              modified_on: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });

      const zones = await client.listZones();

      expect(zones).toHaveLength(1);
      expect(zones[0].id).toBe("zone-123");
      expect(zones[0].name).toBe("example.com");
      expect(zones[0].status).toBe("active");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-token",
          }),
        })
      );
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          errors: [{ code: 9106, message: "Missing X-Auth-Email header" }],
          result: null,
        }),
      });

      await expect(client.listZones()).rejects.toThrow(
        "Cloudflare API error: 9106: Missing X-Auth-Email header"
      );
    });
  });

  describe("getZoneByName", () => {
    it("should find zone by domain name", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          errors: [],
          result: [
            {
              id: "zone-456",
              name: "test.com",
              status: "active",
              paused: false,
              type: "full",
              development_mode: 0,
              plan: { id: "p1", name: "Pro", is_subscribed: true },
              created_on: "2024-01-01T00:00:00Z",
              modified_on: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });

      const zone = await client.getZoneByName("test.com");

      expect(zone).not.toBeNull();
      expect(zone?.id).toBe("zone-456");
    });

    it("should return null when zone not found", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          errors: [],
          result: [],
        }),
      });

      const zone = await client.getZoneByName("nonexistent.com");

      expect(zone).toBeNull();
    });
  });

  describe("getCrawlerHintsStatus", () => {
    it("should indicate status unknown when setting not in API", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          errors: [],
          result: [
            { id: "always_online", value: "on", editable: true },
            { id: "browser_cache_ttl", value: 14400, editable: true },
          ],
        }),
      });

      const status = await client.getCrawlerHintsStatus("zone-123");

      expect(status.statusKnown).toBe(false);
      expect(status.enabled).toBe(false);
      expect(status.error).toContain("not available via API");
      expect(status.dashboardUrl).toContain("zone-123");
    });

    it("should detect crawler_hints if present in API (future-proof)", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          errors: [],
          result: [
            { id: "crawler_hints", value: "on", editable: true },
          ],
        }),
      });

      const status = await client.getCrawlerHintsStatus("zone-123");

      expect(status.statusKnown).toBe(true);
      expect(status.enabled).toBe(true);
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          errors: [],
          result: {
            id: "token-123",
            status: "active",
            expires_on: "2025-12-31T23:59:59Z",
            policies: [
              {
                id: "policy-1",
                effect: "allow",
                resources: { "com.cloudflare.api.account.zone.*": "*" },
                permission_groups: [
                  { id: "pg-1", name: "Zone Read" },
                  { id: "pg-2", name: "Zone Settings Edit" },
                ],
              },
            ],
          },
        }),
      });

      const result = await client.verifyToken();

      expect(result.valid).toBe(true);
      expect(result.permissions).toContain("Zone Read");
      expect(result.permissions).toContain("Zone Settings Edit");
      expect(result.expiresOn).toBe("2025-12-31T23:59:59Z");
    });

    it("should handle invalid token", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          errors: [{ code: 1000, message: "Invalid token" }],
          result: null,
        }),
      });

      const result = await client.verifyToken();

      expect(result.valid).toBe(false);
      expect(result.permissions).toEqual([]);
    });
  });
});

// ============================================================================
// integrateCloudfareCrawlerHints Tests
// ============================================================================

describe("integrateCloudfareCrawlerHints", () => {
  it("should recommend manual IndexNow for non-Cloudflare domains", async () => {
    // Header detection
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ server: "nginx" }),
    });
    // DNS detection
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Answer: [{ data: "ns1.google.com" }],
      }),
    });

    const result = await integrateCloudfareCrawlerHints("example.com");

    expect(result.usesCloudflare).toBe(false);
    expect(result.recommendedAction).toBe("use-manual-indexnow");
    expect(result.canAutoEnable).toBe(false);
  });

  it("should recommend dashboard for Cloudflare domains without API token", async () => {
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({
        "cf-ray": "abc123-LAX",
        server: "cloudflare",
      }),
    });

    const result = await integrateCloudfareCrawlerHints("cloudflare-site.com");

    expect(result.usesCloudflare).toBe(true);
    expect(result.recommendedAction).toBe("enable-via-dashboard");
    expect(result.dashboardUrl).toContain("cloudflare-site.com");
    expect(result.estimatedMinutes).toBe(1);
    expect(result.instructions).toContain("Cloudflare dashboard");
  });

  it("should use DNS detection when headers fail", async () => {
    // Header detection fails
    mockFetch.mockResolvedValueOnce({
      headers: new Headers({ server: "nginx" }),
    });
    // DNS detection succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Answer: [{ data: "anna.ns.cloudflare.com" }],
      }),
    });

    const result = await integrateCloudfareCrawlerHints("proxy-site.com");

    expect(result.usesCloudflare).toBe(true);
    expect(result.detection.detectionMethod).toBe("dns-nameserver");
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe("REQUIRED_SCOPES", () => {
  it("should include necessary permissions", () => {
    expect(REQUIRED_SCOPES).toContain("zone:read");
    expect(REQUIRED_SCOPES).toContain("zone_settings:edit");
  });
});
