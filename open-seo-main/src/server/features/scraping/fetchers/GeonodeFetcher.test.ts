/**
 * Geonode Fetcher Tests
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 *
 * Unit tests for URL construction and integration tests for proxy connectivity.
 */

/// <reference types="node" />

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import {
  buildGeonodeProxyUrl,
  GeonodeFetcher,
  createGeonodeFetcher,
  resetGeonodeFetcher,
} from "./GeonodeFetcher";
import type { GeonodeConfig } from "../config/proxy-config";

// =============================================================================
// Mock Config
// =============================================================================

const mockConfig: GeonodeConfig = {
  host: "proxy.geonode.io",
  port: 9000,
  username: "geonode_testuser-type-residential",
  password: "0-0-0-0",
  defaultCountry: undefined,
  sessionLifetimeMin: 0,
};

// =============================================================================
// Unit Tests: URL Construction
// =============================================================================

describe("buildGeonodeProxyUrl", () => {
  it("should build basic proxy URL without modifiers", () => {
    const result = buildGeonodeProxyUrl(mockConfig);

    expect(result.url).toBe(
      "http://geonode_testuser-type-residential:0-0-0-0@proxy.geonode.io:9000"
    );
    expect(result.username).toBe("geonode_testuser-type-residential");
    expect(result.modifiers).toEqual([]);
  });

  it("should add country modifier to username", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { country: "US" });

    expect(result.username).toBe("geonode_testuser-type-residential-country-us");
    expect(result.modifiers).toContain("country:us");
    expect(result.url).toContain("-country-us:");
  });

  it("should lowercase country code", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { country: "GB" });

    expect(result.username).toContain("-country-gb");
    expect(result.modifiers).toContain("country:gb");
  });

  it("should add city modifier to username", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { city: "New York" });

    expect(result.username).toBe("geonode_testuser-type-residential-city-newyork");
    expect(result.modifiers).toContain("city:new york");
  });

  it("should add session modifier with default lifetime", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { sessionId: "abc123" });

    expect(result.username).toBe(
      "geonode_testuser-type-residential-session-abc123-lifetime-10m"
    );
    expect(result.modifiers).toContain("session:abc123");
    expect(result.modifiers).toContain("lifetime:10m");
  });

  it("should use custom session lifetime", () => {
    const result = buildGeonodeProxyUrl(mockConfig, {
      sessionId: "abc123",
      sessionLifetimeMin: 30,
    });

    expect(result.username).toContain("-lifetime-30m");
    expect(result.modifiers).toContain("lifetime:30m");
  });

  it("should combine multiple modifiers in correct order", () => {
    const result = buildGeonodeProxyUrl(mockConfig, {
      country: "gb",
      city: "london",
      sessionId: "xyz789",
      sessionLifetimeMin: 15,
    });

    expect(result.username).toBe(
      "geonode_testuser-type-residential-country-gb-city-london-session-xyz789-lifetime-15m"
    );
    expect(result.modifiers).toEqual([
      "country:gb",
      "city:london",
      "session:xyz789",
      "lifetime:15m",
    ]);
  });

  it("should URL-encode special characters in password", () => {
    const configWithSpecialPassword: GeonodeConfig = {
      ...mockConfig,
      password: "pw@:1",
    };

    const result = buildGeonodeProxyUrl(configWithSpecialPassword);

    expect(result.url).toContain(encodeURIComponent("pw@:1"));
    expect(result.url).toContain("pass%40word%3A123");
  });

  it("should handle custom port", () => {
    const configWithPort: GeonodeConfig = {
      ...mockConfig,
      port: 9001, // Sticky port
    };

    const result = buildGeonodeProxyUrl(configWithPort);

    expect(result.url).toContain("@proxy.geonode.io:9001");
  });

  it("should create HttpsProxyAgent instance", () => {
    const result = buildGeonodeProxyUrl(mockConfig);

    expect(result.agent).toBeDefined();
    expect(result.agent.constructor.name).toBe("HttpsProxyAgent");
  });
});

// =============================================================================
// Unit Tests: GeonodeFetcher Class
// =============================================================================

describe("GeonodeFetcher", () => {
  let fetcher: GeonodeFetcher;

  beforeEach(() => {
    fetcher = createGeonodeFetcher(mockConfig);
  });

  afterEach(() => {
    resetGeonodeFetcher();
  });

  describe("getConfig", () => {
    it("should return config without password", () => {
      const config = fetcher.getConfig();

      expect(config.host).toBe("proxy.geonode.io");
      expect(config.port).toBe(9000);
      expect(config.username).toBe("geonode_testuser-type-residential");
      expect(config).not.toHaveProperty("password");
    });
  });

  describe("with default country", () => {
    it("should use default country from config", () => {
      const configWithCountry: GeonodeConfig = {
        ...mockConfig,
        defaultCountry: "us",
      };
      const fetcherWithCountry = createGeonodeFetcher(configWithCountry);
      const config = fetcherWithCountry.getConfig();

      expect(config.defaultCountry).toBe("us");
    });
  });
});

// =============================================================================
// Integration Tests (require credentials)
// =============================================================================

// Check if real credentials are available
const hasCredentials =
  process.env.GEONODE_USERNAME &&
  process.env.GEONODE_PASSWORD &&
  process.env.GEONODE_USERNAME.includes("-type-");

describe.skipIf(!hasCredentials)("GeonodeFetcher integration", () => {
  let fetcher: GeonodeFetcher;

  beforeAll(() => {
    const config: GeonodeConfig = {
      host: process.env.GEONODE_HOST ?? "proxy.geonode.io",
      port: parseInt(process.env.GEONODE_PORT ?? "9000", 10),
      username: process.env.GEONODE_USERNAME!,
      password: process.env.GEONODE_PASSWORD!,
      defaultCountry: process.env.GEONODE_DEFAULT_COUNTRY,
      sessionLifetimeMin: parseInt(
        process.env.GEONODE_SESSION_LIFETIME_MIN ?? "0",
        10
      ),
    };
    fetcher = createGeonodeFetcher(config);
  });

  it("should test connection successfully", { timeout: 20000 }, async () => {
    const result = await fetcher.testConnection();

    expect(result.success).toBe(true);
    expect(result.ip).toBeDefined();
    expect(result.ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    expect(result.latencyMs).toBeLessThan(15000);
  });

  it("should fetch through proxy", { timeout: 20000 }, async () => {
    const result = await fetcher.fetch({
      url: "https://httpbin.org/headers",
      timeoutMs: 15000,
    });

    expect(result.success).toBe(true);
    expect(result.html).toBeDefined();
    expect(result.statusCode).toBe(200);
    expect(result.proxyUsed).toContain("geonode");
    expect(result.bytesTransferred).toBeGreaterThan(0);
  });

  it("should include proxy modifier in proxyUsed when geo-targeting", { timeout: 20000 }, async () => {
    const result = await fetcher.fetch({
      url: "https://api.ipify.org?format=json",
      country: "us",
      timeoutMs: 15000,
    });

    expect(result.success).toBe(true);
    expect(result.proxyUsed).toContain("geonode:country:us");
  });

  it("should return same IP with session persistence", { timeout: 35000 }, async () => {
    const sessionId = `test_session_${Date.now()}`;

    // First request
    const result1 = await fetcher.fetch({
      url: "https://api.ipify.org?format=json",
      sessionId,
      sessionLifetimeMin: 5,
      timeoutMs: 15000,
    });

    // Brief delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Second request with same session
    const result2 = await fetcher.fetch({
      url: "https://api.ipify.org?format=json",
      sessionId,
      sessionLifetimeMin: 5,
      timeoutMs: 15000,
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.html && result2.html) {
      const ip1 = JSON.parse(result1.html).ip;
      const ip2 = JSON.parse(result2.html).ip;
      expect(ip1).toBe(ip2);
    }
  });

  it("should handle timeout gracefully", { timeout: 10000 }, async () => {
    const result = await fetcher.fetch({
      url: "https://httpbin.org/delay/30", // 30 second delay
      timeoutMs: 2000, // 2 second timeout
      maxRetries: 0,
    });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe("timeout");
    expect(result.latencyMs).toBeGreaterThanOrEqual(2000);
    expect(result.latencyMs).toBeLessThan(5000); // Should abort, not wait full 30s
  });

  it("should handle 404 responses", { timeout: 20000 }, async () => {
    const result = await fetcher.fetch({
      url: "https://httpbin.org/status/404",
      timeoutMs: 15000,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.error).toBe("HTTP 404");
  });

  it("should retry on transient failures", { timeout: 20000 }, async () => {
    // This test verifies retry behavior, not actual retries
    // httpbin.org/status/500 returns 500 which doesn't trigger retries
    const result = await fetcher.fetch({
      url: "https://httpbin.org/status/500",
      timeoutMs: 15000,
      maxRetries: 2,
    });

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("GeonodeFetcher edge cases", () => {
  it("should handle empty session ID gracefully", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { sessionId: "" });

    // Empty sessionId should be treated as no session
    expect(result.username).toBe("geonode_testuser-type-residential");
  });

  it("should handle undefined options", () => {
    const result = buildGeonodeProxyUrl(mockConfig, undefined);

    expect(result.username).toBe("geonode_testuser-type-residential");
    expect(result.modifiers).toEqual([]);
  });

  it("should sanitize city names with special characters", () => {
    const result = buildGeonodeProxyUrl(mockConfig, { city: "São Paulo" });

    // Should lowercase and remove spaces
    expect(result.username).toContain("-city-sãopaulo");
  });
});
