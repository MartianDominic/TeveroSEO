/**
 * Platform Detector Service
 *
 * Multi-probe fingerprinting system to detect website platforms (WordPress, Shopify, etc.)
 * via HTML analysis, API probing, and CDN detection.
 *
 * Detection heuristics use weighted scoring to determine platform confidence:
 * - High confidence: total score >= 100 (strong signal like API endpoint or CDN)
 * - Medium confidence: total score >= 50 (weaker signals like /wp-content/)
 * - Low confidence: total score < 50 (fallback to "custom")
 */
import * as cheerio from "cheerio";
import type { PlatformType, DetectionResult, DetectionSignal } from "../types";

// ============================================================================
// Types
// ============================================================================

interface DetectionProbe {
  type: "api" | "cdn" | "meta" | "header";
  platform: PlatformType;
  weight: number;
  check: (data: ProbeData) => string | null; // Returns found string or null
}

interface ProbeData {
  html: string;
  headers: Record<string, string>;
  apiProbes: Record<string, boolean>;
}

// ============================================================================
// Detection Probes Configuration
// ============================================================================

/**
 * Detection probes for each supported platform.
 * Higher weight = stronger signal of platform presence.
 *
 * WordPress:
 * - /wp-json/ API (100) - definitive
 * - /wp-content/ paths (80) - strong indicator
 * - Generator meta tag (90) - very reliable
 *
 * Shopify:
 * - cdn.shopify.com (100) - definitive
 * - .myshopify.com (100) - definitive
 *
 * Wix:
 * - wixstatic.com (100) - definitive
 * - parastorage.com (90) - Wix CDN
 *
 * Squarespace:
 * - static.squarespace.com (100) - definitive
 * - Generator meta tag (90)
 *
 * Webflow:
 * - webflow.io scripts (100) - definitive
 * - assets-global.website-files.com (90) - Webflow CDN
 * - Generator meta tag (90)
 */
export const DETECTION_PROBES: DetectionProbe[] = [
  // WordPress probes
  {
    type: "api",
    platform: "wordpress",
    weight: 100,
    check: (d) => (d.apiProbes["/wp-json/"] ? "/wp-json/" : null),
  },
  {
    type: "cdn",
    platform: "wordpress",
    weight: 80,
    check: (d) => (d.html.includes("/wp-content/") ? "/wp-content/" : null),
  },
  {
    type: "meta",
    platform: "wordpress",
    weight: 90,
    check: (d) => {
      const $ = cheerio.load(d.html);
      const gen = $('meta[name="generator"]').attr("content");
      return gen?.includes("WordPress") ? gen : null;
    },
  },

  // Shopify probes
  {
    type: "cdn",
    platform: "shopify",
    weight: 100,
    check: (d) =>
      d.html.includes("cdn.shopify.com") ? "cdn.shopify.com" : null,
  },
  {
    type: "cdn",
    platform: "shopify",
    weight: 100,
    check: (d) =>
      d.html.includes(".myshopify.com") ? ".myshopify.com" : null,
  },

  // Wix probes
  {
    type: "cdn",
    platform: "wix",
    weight: 100,
    check: (d) => (d.html.includes("wixstatic.com") ? "wixstatic.com" : null),
  },
  {
    type: "cdn",
    platform: "wix",
    weight: 90,
    check: (d) =>
      d.html.includes("parastorage.com") ? "parastorage.com" : null,
  },

  // Squarespace probes
  {
    type: "cdn",
    platform: "squarespace",
    weight: 100,
    check: (d) =>
      d.html.includes("static.squarespace.com")
        ? "static.squarespace.com"
        : null,
  },
  {
    type: "meta",
    platform: "squarespace",
    weight: 90,
    check: (d) => {
      const $ = cheerio.load(d.html);
      const gen = $('meta[name="generator"]').attr("content");
      return gen?.includes("Squarespace") ? gen : null;
    },
  },

  // Webflow probes
  {
    type: "cdn",
    platform: "webflow",
    weight: 100,
    check: (d) =>
      d.html.includes("webflow.io") ||
      d.html.includes("assets-global.website-files.com")
        ? "webflow.io"
        : null,
  },
  {
    type: "meta",
    platform: "webflow",
    weight: 90,
    check: (d) => {
      const $ = cheerio.load(d.html);
      const gen = $('meta[name="generator"]').attr("content");
      return gen?.includes("Webflow") ? gen : null;
    },
  },
];

// ============================================================================
// Platform Detection
// ============================================================================

/**
 * Detect the platform of a website via multi-probe fingerprinting.
 * Uses 15 second timeout for detection requests.
 *
 * @param url - The URL or domain to detect (https:// prefix added if missing)
 * @returns Detection result with platform, confidence, and matched signals
 *
 * @example
 * const result = await detectPlatform("example.com");
 * // { platform: "wordpress", confidence: "high", signals: [...] }
 */
export async function detectPlatform(url: string): Promise<DetectionResult> {
  const normalizedUrl = normalizeUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    // Fetch HTML content
    const response = await fetch(normalizedUrl, {
      headers: { "User-Agent": "TeveroSEO-PlatformDetector/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });
    const html = await response.text();
    const headers = extractHeaders(response);

    // Probe WordPress REST API endpoint
    const wpJsonExists = await probeWpJson(normalizedUrl);

    // Build probe data
    const data: ProbeData = {
      html,
      headers,
      apiProbes: { "/wp-json/": wpJsonExists },
    };

    // Score platforms
    const { scores, signals } = scorePlatforms(data);

    // Determine winner
    return determineResult(scores, signals);
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return createErrorResult(new Error("Detection timeout after 15s"));
    }
    return createErrorResult(error as Error);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Normalize URL by adding https:// prefix if missing.
 */
function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Extract headers from response into a plain object.
 */
function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/**
 * Probe WordPress REST API endpoint.
 * Uses HEAD request to minimize bandwidth with 5 second timeout.
 */
async function probeWpJson(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(`${baseUrl}/wp-json/`, {
      method: "HEAD",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Score all platforms based on probe matches.
 */
function scorePlatforms(data: ProbeData): {
  scores: Record<PlatformType, number>;
  signals: DetectionSignal[];
} {
  const scores: Record<PlatformType, number> = {
    wordpress: 0,
    shopify: 0,
    wix: 0,
    squarespace: 0,
    webflow: 0,
    custom: 0,
    pixel: 0,
  };
  const signals: DetectionSignal[] = [];

  for (const probe of DETECTION_PROBES) {
    const found = probe.check(data);
    if (found) {
      scores[probe.platform] += probe.weight;
      signals.push({
        type: probe.type,
        platform: probe.platform,
        weight: probe.weight,
        found,
      });
    }
  }

  return { scores, signals };
}

/**
 * Determine final result from scores and signals.
 */
function determineResult(
  scores: Record<PlatformType, number>,
  signals: DetectionSignal[],
): DetectionResult {
  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
  const [topPlatform, topScore] = sorted[0] as [PlatformType, number];

  if (topScore === 0) {
    return { platform: "custom", confidence: "low", signals };
  }

  const confidence =
    topScore >= 100 ? "high" : topScore >= 50 ? "medium" : "low";
  return { platform: topPlatform, confidence, signals };
}

/**
 * Create error result when detection fails.
 */
function createErrorResult(error: Error): DetectionResult {
  return {
    platform: "custom",
    confidence: "low",
    signals: [
      {
        type: "api",
        platform: "custom",
        weight: 0,
        found: `Error: ${error.message}`,
      },
    ],
  };
}
