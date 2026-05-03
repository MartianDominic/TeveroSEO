/**
 * Tests for PixelScriptService.
 * Phase 66: Platform Unification Excellence - Plan 01
 *
 * Tests pixel script generation:
 * - generatePixelScript returns valid JS with data-site attribute
 * - Script size is under 5KB uncompressed
 * - Script includes async loading pattern
 * - getOrCreateInstallation creates new record if none exists
 * - getInstallationBySiteId returns null for unknown siteId
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PixelScriptService,
  generatePixelScript,
  generatePixelLoader,
  type PixelScriptConfig,
} from "./pixel-script.service";

describe("PixelScriptService", () => {
  let service: PixelScriptService;
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    query: {
      pixelInstallations: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      query: {
        pixelInstallations: {
          findFirst: vi.fn(),
        },
      },
    };

    service = new PixelScriptService(mockDb as unknown as Parameters<typeof PixelScriptService>[0]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("generatePixelScript", () => {
    it("returns valid HTML script tag with data-site attribute", () => {
      const siteId = "abc123";
      const script = generatePixelScript(siteId);

      expect(script).toContain("<script");
      expect(script).toContain("async");
      expect(script).toContain('data-site="abc123"');
      expect(script).toContain("</script>");
    });

    it("uses the correct pixel endpoint URL", () => {
      const script = generatePixelScript("test-site");

      expect(script).toContain('src="https://pixel.tevero.io/t.js"');
    });

    it("produces valid embeddable HTML", () => {
      const script = generatePixelScript("site-456");

      // Should be a complete script tag
      expect(script.startsWith("<script")).toBe(true);
      expect(script.endsWith("</script>")).toBe(true);

      // Should have proper attributes
      expect(script).toMatch(/async/);
      expect(script).toMatch(/src=/);
      expect(script).toMatch(/data-site=/);
    });
  });

  describe("generatePixelLoader", () => {
    it("generates JavaScript code", () => {
      const loader = generatePixelLoader();

      expect(typeof loader).toBe("string");
      expect(loader.length).toBeGreaterThan(0);
    });

    it("is under 5KB uncompressed", () => {
      const loader = generatePixelLoader();
      const sizeInBytes = new TextEncoder().encode(loader).length;
      const sizeInKB = sizeInBytes / 1024;

      expect(sizeInKB).toBeLessThan(5);
    });

    it("includes async loading pattern", () => {
      const loader = generatePixelLoader();

      // Should use async patterns
      expect(loader).toMatch(/async|Promise|then|await/);
    });

    it("initializes analytics module", () => {
      const loader = generatePixelLoader();

      // Should have analytics tracking
      expect(loader).toMatch(/pageview|analytics|track/i);
    });

    it("uses Navigator.sendBeacon for reliable data collection", () => {
      const loader = generatePixelLoader();

      expect(loader).toContain("sendBeacon");
    });

    it("handles SPA navigation with MutationObserver or history API", () => {
      const loader = generatePixelLoader();

      // Should handle SPA navigation
      expect(loader).toMatch(/MutationObserver|pushState|popstate|history/);
    });

    it("fetches config from API endpoint", () => {
      const loader = generatePixelLoader();

      // Should fetch config
      expect(loader).toMatch(/fetch|config/i);
    });
  });

  describe("getOrCreateInstallation", () => {
    it("returns existing installation if found", async () => {
      const existingInstallation = {
        id: "pix-001",
        workspaceId: "workspace-123",
        siteId: "site-abc",
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
      };

      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(
        existingInstallation
      );

      const result = await service.getOrCreateInstallation(
        "workspace-123",
        "example.com"
      );

      expect(result).toEqual(existingInstallation);
      expect(mockDb.query.pixelInstallations.findFirst).toHaveBeenCalled();
    });

    it("creates new installation if none exists", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(null);

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "pix-new",
            workspaceId: "workspace-123",
            siteId: "generated-uuid",
            domain: "newsite.com",
            status: "pending",
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      const result = await service.getOrCreateInstallation(
        "workspace-123",
        "newsite.com"
      );

      expect(result).toBeDefined();
      expect(result.workspaceId).toBe("workspace-123");
      expect(result.domain).toBe("newsite.com");
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("generates unique siteId for new installations", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(null);

      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "pix-1",
            siteId: "unique-site-id-1",
            domain: "site1.com",
          },
        ]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      await service.getOrCreateInstallation("workspace-123", "site1.com");

      // Verify values was called with an object containing siteId
      expect(mockInsertChain.values).toHaveBeenCalled();
      const insertedValues = mockInsertChain.values.mock.calls[0][0];
      expect(insertedValues.siteId).toBeDefined();
      expect(typeof insertedValues.siteId).toBe("string");
    });
  });

  describe("getInstallationBySiteId", () => {
    it("returns installation for valid siteId", async () => {
      const installation = {
        id: "pix-001",
        siteId: "known-site",
        domain: "known.com",
        status: "verified",
      };

      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(installation);

      const result = await service.getInstallationBySiteId("known-site");

      expect(result).toEqual(installation);
    });

    it("returns null for unknown siteId", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(null);

      const result = await service.getInstallationBySiteId("unknown-site");

      expect(result).toBeNull();
    });
  });

  describe("getInstallationConfig", () => {
    it("returns config with siteId, workspaceId, features", async () => {
      const installation = {
        id: "pix-001",
        siteId: "site-abc",
        workspaceId: "workspace-123",
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
        allowedOrigins: ["https://example.com", "https://www.example.com"],
      };

      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(installation);

      const config = await service.getInstallationConfig("site-abc");

      expect(config).toMatchObject({
        siteId: "site-abc",
        workspaceId: "workspace-123",
        features: expect.objectContaining({
          analytics: true,
          cwv: true,
        }),
        allowedOrigins: expect.arrayContaining(["https://example.com"]),
      });
    });

    it("returns null for unknown siteId", async () => {
      mockDb.query.pixelInstallations.findFirst.mockResolvedValue(null);

      const config = await service.getInstallationConfig("unknown-site");

      expect(config).toBeNull();
    });
  });

  describe("PixelScriptConfig type", () => {
    it("includes required configuration fields", () => {
      const config: PixelScriptConfig = {
        siteId: "site-123",
        workspaceId: "workspace-456",
        allowedOrigins: ["https://example.com"],
        features: {
          analytics: true,
          cwv: true,
          metaInjection: false,
          schemaInjection: false,
          linkInjection: false,
          abTesting: false,
        },
      };

      expect(config.siteId).toBe("site-123");
      expect(config.workspaceId).toBe("workspace-456");
      expect(config.allowedOrigins).toContain("https://example.com");
      expect(config.features.analytics).toBe(true);
    });
  });
});
