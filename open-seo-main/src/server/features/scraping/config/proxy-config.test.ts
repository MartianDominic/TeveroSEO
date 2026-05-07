/**
 * Proxy Configuration Tests
 * Phase 92: On-Page SEO Mastery - Tiered Scraping Architecture
 */

/// <reference types="node" />

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  GeonodeConfigSchema,
  WebshareConfigSchema,
  loadProxyConfig,
  reloadProxyConfig,
  type GeonodeConfig,
} from "./proxy-config";

// =============================================================================
// Geonode Schema Tests
// =============================================================================

describe("GeonodeConfigSchema", () => {
  const validConfig = {
    host: "proxy.geonode.io",
    port: 9000,
    username: "geonode_testuser-type-residential",
    password: "0-0-0-0",
  };

  it("should parse valid config", () => {
    const result = GeonodeConfigSchema.safeParse(validConfig);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.host).toBe("proxy.geonode.io");
      expect(result.data.port).toBe(9000);
      expect(result.data.username).toBe("geonode_testuser-type-residential");
      expect(result.data.sessionLifetimeMin).toBe(0); // default
    }
  });

  it("should use default host", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      host: undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.host).toBe("proxy.geonode.io");
    }
  });

  it("should use default port", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      port: undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(9000);
    }
  });

  it("should coerce port from string", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      port: "9001",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(9001);
    }
  });

  it("should reject invalid port", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      port: 99999,
    });

    expect(result.success).toBe(false);
  });

  it("should require username", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      username: "",
    });

    expect(result.success).toBe(false);
  });

  it("should require -type- in username", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      username: "geonode_testuser",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("-type-");
    }
  });

  it("should require password", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("should validate UUID format for password", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      password: "invalid",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("UUID");
    }
  });

  it("should lowercase defaultCountry", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      defaultCountry: "US",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultCountry).toBe("us");
    }
  });

  it("should validate country length", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      defaultCountry: "USA",
    });

    expect(result.success).toBe(false);
  });

  it("should coerce sessionLifetimeMin from string", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      sessionLifetimeMin: "30",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sessionLifetimeMin).toBe(30);
    }
  });

  it("should limit sessionLifetimeMin to 60", () => {
    const result = GeonodeConfigSchema.safeParse({
      ...validConfig,
      sessionLifetimeMin: 120,
    });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Webshare Schema Tests
// =============================================================================

describe("WebshareConfigSchema", () => {
  it("should parse valid config with API key", () => {
    const result = WebshareConfigSchema.safeParse({
      apiKey: "test-api-key",
      enabled: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiKey).toBe("test-api-key");
      expect(result.data.enabled).toBe(true);
    }
  });

  it("should default enabled to false", () => {
    const result = WebshareConfigSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enabled).toBe(false);
    }
  });

  it("should allow undefined apiKey", () => {
    const result = WebshareConfigSchema.safeParse({
      enabled: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.apiKey).toBeUndefined();
    }
  });
});

// =============================================================================
// loadProxyConfig Tests
// =============================================================================

describe("loadProxyConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env to clean state
    process.env = { ...originalEnv };
    // Reset singleton
    reloadProxyConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return null geonode when not configured", () => {
    delete process.env.GEONODE_USERNAME;
    delete process.env.GEONODE_PASSWORD;

    const config = loadProxyConfig();

    expect(config.geonode).toBeNull();
    expect(config.hasProxies).toBe(false);
  });

  it("should load geonode config from environment", () => {
    process.env.GEONODE_USERNAME = "geonode_test-type-residential";
    process.env.GEONODE_PASSWORD = "test-uuid";

    const config = loadProxyConfig();

    expect(config.geonode).not.toBeNull();
    expect(config.geonode?.username).toBe("geonode_test-type-residential");
    expect(config.hasProxies).toBe(true);
    expect(config.availableTiers).toContain("geonode");
  });

  it("should use custom host and port", () => {
    process.env.GEONODE_HOST = "custom.geonode.io";
    process.env.GEONODE_PORT = "9001";
    process.env.GEONODE_USERNAME = "geonode_test-type-residential";
    process.env.GEONODE_PASSWORD = "test-uuid";

    const config = loadProxyConfig();

    expect(config.geonode?.host).toBe("custom.geonode.io");
    expect(config.geonode?.port).toBe(9001);
  });

  it("should handle webshare config", () => {
    process.env.WEBSHARE_API_KEY = "test-webshare-key";

    const config = loadProxyConfig();

    expect(config.webshare?.enabled).toBe(true);
    expect(config.webshare?.apiKey).toBe("test-webshare-key");
    expect(config.availableTiers).toContain("webshare");
  });

  it("should include both tiers when both configured", () => {
    process.env.WEBSHARE_API_KEY = "test-webshare-key";
    process.env.GEONODE_USERNAME = "geonode_test-type-residential";
    process.env.GEONODE_PASSWORD = "test-uuid";

    const config = loadProxyConfig();

    expect(config.hasProxies).toBe(true);
    expect(config.availableTiers).toEqual(["webshare", "geonode"]);
  });

  it("should trim whitespace from credentials", () => {
    process.env.GEONODE_USERNAME = "  geonode_test-type-residential  ";
    process.env.GEONODE_PASSWORD = "  test-uuid  ";

    const config = loadProxyConfig();

    expect(config.geonode?.username).toBe("geonode_test-type-residential");
    expect(config.geonode?.password).toBe("test-uuid");
  });

  it("should handle invalid geonode config gracefully in development", () => {
    process.env.NODE_ENV = "development";
    process.env.GEONODE_USERNAME = "invalid-no-type";
    process.env.GEONODE_PASSWORD = "test-uuid";

    // Should not throw
    const config = loadProxyConfig();

    expect(config.geonode).toBeNull();
  });

  it("should load default country", () => {
    process.env.GEONODE_USERNAME = "geonode_test-type-residential";
    process.env.GEONODE_PASSWORD = "test-uuid";
    process.env.GEONODE_DEFAULT_COUNTRY = "US";

    const config = loadProxyConfig();

    expect(config.geonode?.defaultCountry).toBe("us");
  });

  it("should load session lifetime", () => {
    process.env.GEONODE_USERNAME = "geonode_test-type-residential";
    process.env.GEONODE_PASSWORD = "test-uuid";
    process.env.GEONODE_SESSION_LIFETIME_MIN = "15";

    const config = loadProxyConfig();

    expect(config.geonode?.sessionLifetimeMin).toBe(15);
  });
});
