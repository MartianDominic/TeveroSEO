/**
 * Platform Detector Tests
 *
 * Tests multi-probe platform detection for WordPress, Shopify, Wix,
 * Squarespace, Webflow, and unknown (custom) platforms.
 *
 * Uses mocked fetch responses to simulate platform-specific HTML and API responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { detectPlatform, DETECTION_PROBES } from "./PlatformDetector";
import type { DetectionResult } from "../types";

// ============================================================================
// Test Fixtures
// ============================================================================

const WORDPRESS_HTML_WITH_WP_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="WordPress 6.5">
  <link rel="stylesheet" href="/wp-content/themes/theme/style.css">
</head>
<body>
  <script src="/wp-content/plugins/plugin/script.js"></script>
</body>
</html>
`;

const WORDPRESS_HTML_ONLY_WP_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/wp-content/themes/theme/style.css">
</head>
<body>
  <img src="/wp-content/uploads/image.jpg">
</body>
</html>
`;

const SHOPIFY_HTML = `
<!DOCTYPE html>
<html>
<head>
  <link rel="preconnect" href="https://cdn.shopify.com">
</head>
<body>
  <script src="https://cdn.shopify.com/s/assets/storefront.js"></script>
</body>
</html>
`;

const SHOPIFY_MYSHOPIFY_HTML = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <script>window.Shopify = { shop: "example.myshopify.com" };</script>
</body>
</html>
`;

const WIX_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="Wix.com Website Builder">
</head>
<body>
  <script src="https://static.wixstatic.com/umd.min.js"></script>
</body>
</html>
`;

const WIX_PARASTORAGE_HTML = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <script src="https://static.parastorage.com/services/wix-thunderbolt/dist/app.js"></script>
</body>
</html>
`;

const SQUARESPACE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="Squarespace">
</head>
<body>
  <script src="https://static.squarespace.com/universal/scripts.js"></script>
</body>
</html>
`;

const WEBFLOW_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="Webflow">
</head>
<body>
  <script src="https://webflow.io/scripts/webflow.js"></script>
</body>
</html>
`;

const WEBFLOW_ASSETS_HTML = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <script src="https://assets-global.website-files.com/webflow.js"></script>
</body>
</html>
`;

const CUSTOM_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="generator" content="Custom CMS">
</head>
<body>
  <p>A simple custom website with no identifiable platform.</p>
</body>
</html>
`;

// ============================================================================
// Helper Functions
// ============================================================================

function createMockResponse(
  html: string,
  ok = true,
  headers: Record<string, string> = {},
): Response {
  return {
    ok,
    text: () => Promise.resolve(html),
    headers: new Map(Object.entries(headers)) as unknown as Headers,
  } as Response;
}

function createWpJsonResponse(exists: boolean): Response {
  return {
    ok: exists,
  } as Response;
}

// ============================================================================
// Tests
// ============================================================================

describe("PlatformDetector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("detectPlatform", () => {
    describe("WordPress detection", () => {
      it("returns high confidence when /wp-json/ API exists", async () => {
        // Arrange: WordPress site with wp-json API available
        mockFetch
          .mockResolvedValueOnce(
            createMockResponse(WORDPRESS_HTML_WITH_WP_CONTENT),
          )
          .mockResolvedValueOnce(createWpJsonResponse(true));

        // Act
        const result = await detectPlatform("https://example.com");

        // Assert
        expect(result.platform).toBe("wordpress");
        expect(result.confidence).toBe("high");
        expect(result.signals.some((s) => s.found === "/wp-json/")).toBe(true);
      });

      it("returns medium confidence when only /wp-content/ is found (no wp-json)", async () => {
        // Arrange: WordPress site without wp-json API
        mockFetch
          .mockResolvedValueOnce(
            createMockResponse(WORDPRESS_HTML_ONLY_WP_CONTENT),
          )
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://example.com");

        // Assert
        expect(result.platform).toBe("wordpress");
        expect(result.confidence).toBe("medium");
        expect(result.signals.some((s) => s.found === "/wp-content/")).toBe(
          true,
        );
      });

      it("detects WordPress meta generator tag", async () => {
        // Arrange: WordPress site with generator meta tag
        mockFetch
          .mockResolvedValueOnce(
            createMockResponse(WORDPRESS_HTML_WITH_WP_CONTENT),
          )
          .mockResolvedValueOnce(createWpJsonResponse(true));

        // Act
        const result = await detectPlatform("https://example.com");

        // Assert
        const metaSignal = result.signals.find(
          (s) => s.type === "meta" && s.platform === "wordpress",
        );
        expect(metaSignal).toBeDefined();
        expect(metaSignal?.found).toContain("WordPress");
      });
    });

    describe("Shopify detection", () => {
      it("returns high confidence when cdn.shopify.com is found", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(SHOPIFY_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://store.example.com");

        // Assert
        expect(result.platform).toBe("shopify");
        expect(result.confidence).toBe("high");
        expect(result.signals.some((s) => s.found === "cdn.shopify.com")).toBe(
          true,
        );
      });

      it("detects .myshopify.com domain reference", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(SHOPIFY_MYSHOPIFY_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://store.example.com");

        // Assert
        expect(result.platform).toBe("shopify");
        expect(result.signals.some((s) => s.found === ".myshopify.com")).toBe(
          true,
        );
      });
    });

    describe("Wix detection", () => {
      it("returns high confidence when wixstatic.com is found", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(WIX_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://wix-site.com");

        // Assert
        expect(result.platform).toBe("wix");
        expect(result.confidence).toBe("high");
        expect(result.signals.some((s) => s.found === "wixstatic.com")).toBe(
          true,
        );
      });

      it("detects parastorage.com as Wix signal", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(WIX_PARASTORAGE_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://wix-site.com");

        // Assert
        expect(result.platform).toBe("wix");
        expect(result.signals.some((s) => s.found === "parastorage.com")).toBe(
          true,
        );
      });
    });

    describe("Squarespace detection", () => {
      it("returns high confidence when static.squarespace.com is found", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(SQUARESPACE_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://squarespace-site.com");

        // Assert
        expect(result.platform).toBe("squarespace");
        expect(result.confidence).toBe("high");
        expect(
          result.signals.some((s) => s.found === "static.squarespace.com"),
        ).toBe(true);
      });

      it("detects Squarespace meta generator tag", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(SQUARESPACE_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://squarespace-site.com");

        // Assert
        const metaSignal = result.signals.find(
          (s) => s.type === "meta" && s.platform === "squarespace",
        );
        expect(metaSignal).toBeDefined();
        expect(metaSignal?.found).toContain("Squarespace");
      });
    });

    describe("Webflow detection", () => {
      it("returns high confidence when webflow.io is found", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(WEBFLOW_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://webflow-site.com");

        // Assert
        expect(result.platform).toBe("webflow");
        expect(result.confidence).toBe("high");
        expect(result.signals.some((s) => s.found === "webflow.io")).toBe(true);
      });

      it("detects assets-global.website-files.com as Webflow signal", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(WEBFLOW_ASSETS_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://webflow-site.com");

        // Assert
        expect(result.platform).toBe("webflow");
        expect(result.signals.some((s) => s.found === "webflow.io")).toBe(true);
      });

      it("detects Webflow meta generator tag", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(WEBFLOW_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://webflow-site.com");

        // Assert
        const metaSignal = result.signals.find(
          (s) => s.type === "meta" && s.platform === "webflow",
        );
        expect(metaSignal).toBeDefined();
        expect(metaSignal?.found).toContain("Webflow");
      });
    });

    describe("Unknown platform detection", () => {
      it("returns custom with low confidence when no platform detected", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(CUSTOM_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        const result = await detectPlatform("https://custom-site.com");

        // Assert
        expect(result.platform).toBe("custom");
        expect(result.confidence).toBe("low");
        expect(result.signals).toHaveLength(0);
      });
    });

    describe("Signal tracking", () => {
      it("includes all matched probes in signals array with weights", async () => {
        // Arrange: WordPress with multiple signals
        mockFetch
          .mockResolvedValueOnce(
            createMockResponse(WORDPRESS_HTML_WITH_WP_CONTENT),
          )
          .mockResolvedValueOnce(createWpJsonResponse(true));

        // Act
        const result = await detectPlatform("https://example.com");

        // Assert
        expect(result.signals.length).toBeGreaterThan(0);
        result.signals.forEach((signal) => {
          expect(signal).toHaveProperty("type");
          expect(signal).toHaveProperty("platform");
          expect(signal).toHaveProperty("weight");
          expect(signal).toHaveProperty("found");
          expect(typeof signal.weight).toBe("number");
          expect(signal.weight).toBeGreaterThan(0);
        });
      });
    });

    describe("Error handling", () => {
      it("returns custom with error signal when network request fails", async () => {
        // Arrange
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        // Act
        const result = await detectPlatform("https://unreachable-site.com");

        // Assert
        expect(result.platform).toBe("custom");
        expect(result.confidence).toBe("low");
        expect(result.signals.some((s) => s.found.includes("Error:"))).toBe(
          true,
        );
      });

      it("handles timeout gracefully", async () => {
        // Arrange: Simulate timeout
        mockFetch.mockRejectedValueOnce(new Error("Timeout"));

        // Act
        const result = await detectPlatform("https://slow-site.com");

        // Assert
        expect(result.platform).toBe("custom");
        expect(result.confidence).toBe("low");
      });
    });

    describe("URL normalization", () => {
      it("adds https:// prefix when missing", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(SHOPIFY_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        await detectPlatform("store.example.com");

        // Assert
        expect(mockFetch).toHaveBeenCalledWith(
          "https://store.example.com",
          expect.any(Object),
        );
      });

      it("preserves existing http:// prefix", async () => {
        // Arrange
        mockFetch
          .mockResolvedValueOnce(createMockResponse(CUSTOM_HTML))
          .mockResolvedValueOnce(createWpJsonResponse(false));

        // Act
        await detectPlatform("http://insecure-site.com");

        // Assert
        expect(mockFetch).toHaveBeenCalledWith(
          "http://insecure-site.com",
          expect.any(Object),
        );
      });
    });
  });

  describe("DETECTION_PROBES", () => {
    it("exports detection probes array", () => {
      expect(Array.isArray(DETECTION_PROBES)).toBe(true);
      expect(DETECTION_PROBES.length).toBeGreaterThan(0);
    });

    it("includes probes for all major platforms", () => {
      const platforms = new Set(DETECTION_PROBES.map((p) => p.platform));

      expect(platforms.has("wordpress")).toBe(true);
      expect(platforms.has("shopify")).toBe(true);
      expect(platforms.has("wix")).toBe(true);
      expect(platforms.has("squarespace")).toBe(true);
      expect(platforms.has("webflow")).toBe(true);
    });

    it("each probe has required properties", () => {
      DETECTION_PROBES.forEach((probe) => {
        expect(probe).toHaveProperty("type");
        expect(probe).toHaveProperty("platform");
        expect(probe).toHaveProperty("weight");
        expect(probe).toHaveProperty("check");
        expect(typeof probe.check).toBe("function");
      });
    });
  });
});
