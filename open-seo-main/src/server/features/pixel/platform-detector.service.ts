/**
 * PlatformDetectorService
 * Phase 66-03: CMS Platform Detection
 *
 * Auto-detect CMS platform from URL with 95%+ accuracy.
 * Uses subdomain patterns (100% confidence) and HTML signatures (90-95% confidence).
 *
 * Detection methods in order of reliability:
 * 1. Subdomain patterns (100% confidence) - e.g., *.myshopify.com
 * 2. HTML signatures (90-95% confidence) - meta generator tags, JS globals
 * 3. Response headers (80% confidence) - X-Powered-By, etc.
 * 4. GTM detection (as enhancement) - gtm.js presence
 */

// ============================================================================
// Types
// ============================================================================

export type SupportedPlatform =
  | "wordpress_self_hosted"
  | "wordpress_com"
  | "shopify"
  | "wix"
  | "squarespace"
  | "webflow"
  | "weebly"
  | "godaddy"
  | "hubspot"
  | "ghost"
  | "bigcommerce"
  | "woocommerce"
  | "magento"
  | "custom_html"
  | "gtm_enabled"
  | "unknown";

export interface PlatformDetectionResult {
  platform: SupportedPlatform | "unknown";
  confidence: number; // 0-100
  features: string[]; // e.g., ['ecommerce', 'blog', 'custom_code', 'gtm_enabled']
  paidPlanRequired: boolean;
  estimatedTime: string; // e.g., "2 min"
}

export const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
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
  "gtm_enabled",
];

// ============================================================================
// Platform Configuration
// ============================================================================

interface PlatformConfig {
  name: string;
  features: string[];
  paidPlanRequired: boolean;
  estimatedTime: string;
}

const PLATFORM_CONFIG: Record<SupportedPlatform | "unknown", PlatformConfig> = {
  wordpress_self_hosted: {
    name: "WordPress (self-hosted)",
    features: ["blog", "custom_code"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  wordpress_com: {
    name: "WordPress.com",
    features: ["blog"],
    paidPlanRequired: true, // Business plan required for custom code
    estimatedTime: "3 min",
  },
  shopify: {
    name: "Shopify",
    features: ["ecommerce"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  wix: {
    name: "Wix",
    features: ["custom_code"],
    paidPlanRequired: true, // Premium required for custom code
    estimatedTime: "2 min",
  },
  squarespace: {
    name: "Squarespace",
    features: [],
    paidPlanRequired: true, // Business plan required
    estimatedTime: "2 min",
  },
  webflow: {
    name: "Webflow",
    features: ["custom_code"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  weebly: {
    name: "Weebly",
    features: [],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  godaddy: {
    name: "GoDaddy Website Builder",
    features: [],
    paidPlanRequired: false,
    estimatedTime: "3 min",
  },
  hubspot: {
    name: "HubSpot CMS",
    features: ["custom_code"],
    paidPlanRequired: true, // Professional plan required
    estimatedTime: "2 min",
  },
  ghost: {
    name: "Ghost",
    features: ["blog"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  bigcommerce: {
    name: "BigCommerce",
    features: ["ecommerce"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  woocommerce: {
    name: "WooCommerce",
    features: ["ecommerce", "custom_code"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  magento: {
    name: "Magento",
    features: ["ecommerce", "custom_code"],
    paidPlanRequired: false,
    estimatedTime: "5 min", // More complex setup
  },
  custom_html: {
    name: "Custom HTML",
    features: ["custom_code"],
    paidPlanRequired: false,
    estimatedTime: "1 min",
  },
  gtm_enabled: {
    name: "Google Tag Manager",
    features: ["gtm_enabled"],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
  unknown: {
    name: "Unknown",
    features: [],
    paidPlanRequired: false,
    estimatedTime: "2 min",
  },
};

// ============================================================================
// Subdomain Pattern Detection (100% confidence)
// ============================================================================

interface SubdomainPattern {
  pattern: RegExp;
  platform: SupportedPlatform;
}

const SUBDOMAIN_PATTERNS: SubdomainPattern[] = [
  { pattern: /\.myshopify\.com$/i, platform: "shopify" },
  { pattern: /\.wordpress\.com$/i, platform: "wordpress_com" },
  { pattern: /\.wixsite\.com$/i, platform: "wix" },
  { pattern: /\.wix\.com$/i, platform: "wix" },
  { pattern: /\.squarespace\.com$/i, platform: "squarespace" },
  { pattern: /\.webflow\.io$/i, platform: "webflow" },
  { pattern: /\.ghost\.io$/i, platform: "ghost" },
  { pattern: /\.mybigcommerce\.com$/i, platform: "bigcommerce" },
  { pattern: /\.godaddysites\.com$/i, platform: "godaddy" },
  { pattern: /\.weebly\.com$/i, platform: "weebly" },
  { pattern: /\.hubspotpagebuilder\.com$/i, platform: "hubspot" },
];

// ============================================================================
// HTML Signature Detection (90-95% confidence)
// ============================================================================

interface HtmlSignature {
  check: (html: string) => boolean;
  platform: SupportedPlatform;
  confidence: number;
}

const HTML_SIGNATURES: HtmlSignature[] = [
  // WordPress self-hosted (meta generator)
  {
    check: (html) =>
      /<meta[^>]*name=["']generator["'][^>]*content=["'][^"']*WordPress[^"']*["']/i.test(
        html
      ) ||
      /<meta[^>]*content=["'][^"']*WordPress[^"']*["'][^>]*name=["']generator["']/i.test(
        html
      ),
    platform: "wordpress_self_hosted",
    confidence: 95,
  },
  // Shopify (meta generator or cdn)
  {
    check: (html) =>
      /<meta[^>]*name=["']generator["'][^>]*content=["']Shopify["']/i.test(
        html
      ) ||
      html.includes("cdn.shopify.com") ||
      html.includes("cdn.shopifycdn.net"),
    platform: "shopify",
    confidence: 95,
  },
  // Squarespace (TemplateConfig or meta)
  {
    check: (html) =>
      html.includes("Squarespace.TemplateConfig") ||
      /<meta[^>]*name=["']generator["'][^>]*content=["'][^"']*Squarespace[^"']*["']/i.test(
        html
      ),
    platform: "squarespace",
    confidence: 95,
  },
  // Webflow (__WEBFLOW_CONTEXT__ or meta)
  {
    check: (html) =>
      html.includes("__WEBFLOW_CONTEXT__") ||
      html.includes("webflow.io") ||
      /<meta[^>]*name=["']generator["'][^>]*content=["'][^"']*Webflow[^"']*["']/i.test(
        html
      ),
    platform: "webflow",
    confidence: 95,
  },
  // Wix (__wix_data__ or wixstatic)
  {
    check: (html) =>
      html.includes("__wix_data__") ||
      html.includes("wixstatic.com") ||
      html.includes("parastorage.com"),
    platform: "wix",
    confidence: 90,
  },
  // Ghost (meta generator)
  {
    check: (html) =>
      /<meta[^>]*name=["']generator["'][^>]*content=["'][^"']*Ghost[^"']*["']/i.test(
        html
      ) || html.includes("Powered by Ghost"),
    platform: "ghost",
    confidence: 95,
  },
  // WooCommerce (meta or class)
  {
    check: (html) =>
      /<meta[^>]*name=["']generator["'][^>]*content=["'][^"']*WooCommerce[^"']*["']/i.test(
        html
      ) ||
      html.includes('class="woocommerce') ||
      html.includes("is-woocommerce"),
    platform: "woocommerce",
    confidence: 95,
  },
  // Magento (MAGE_ or Magento)
  {
    check: (html) =>
      html.includes("MAGE_COOKIES") ||
      html.includes("var MAGE_") ||
      html.includes("Magento_") ||
      html.includes("mage/cookies"),
    platform: "magento",
    confidence: 90,
  },
  // Weebly
  {
    check: (html) =>
      html.includes("weebly.com") || html.includes('class="weebly-'),
    platform: "weebly",
    confidence: 90,
  },
  // GoDaddy
  {
    check: (html) =>
      html.includes("godaddy.com") || html.includes("secureserver.net"),
    platform: "godaddy",
    confidence: 85,
  },
  // HubSpot CMS
  {
    check: (html) =>
      html.includes("hs-scripts.com") ||
      html.includes("hubspot.com") ||
      html.includes("_hsp"),
    platform: "hubspot",
    confidence: 85,
  },
  // BigCommerce
  {
    check: (html) =>
      html.includes("bigcommerce.com") || html.includes("BigCommerce"),
    platform: "bigcommerce",
    confidence: 90,
  },
];

// ============================================================================
// Header Detection (80% confidence)
// ============================================================================

interface HeaderSignature {
  header: string;
  check: (value: string) => boolean;
  platform: SupportedPlatform;
  confidence: number;
}

const HEADER_SIGNATURES: HeaderSignature[] = [
  {
    header: "x-powered-by",
    check: (v) => v.toLowerCase().includes("shopify"),
    platform: "shopify",
    confidence: 80,
  },
  {
    header: "x-wix-request-id",
    check: () => true,
    platform: "wix",
    confidence: 80,
  },
  {
    header: "x-wix-server",
    check: () => true,
    platform: "wix",
    confidence: 80,
  },
  {
    header: "x-squarespace-vary",
    check: () => true,
    platform: "squarespace",
    confidence: 80,
  },
  {
    header: "x-ghost-cache-status",
    check: () => true,
    platform: "ghost",
    confidence: 80,
  },
];

// ============================================================================
// GTM Detection
// ============================================================================

function detectGTM(html: string): boolean {
  return (
    html.includes("googletagmanager.com/gtm.js") ||
    html.includes("googletagmanager.com/ns.html") ||
    /GTM-[A-Z0-9]+/i.test(html)
  );
}

// ============================================================================
// PlatformDetectorService Class
// ============================================================================

export class PlatformDetectorService {
  private timeout: number;

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout ?? 3000; // 3 second default per plan requirement
  }

  /**
   * Detect the CMS platform from a URL.
   *
   * @param url - The URL to analyze
   * @returns PlatformDetectionResult with platform, confidence, features, etc.
   */
  async detectPlatform(url: string): Promise<PlatformDetectionResult> {
    try {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      const parsedUrl = new URL(normalizedUrl);

      // Step 1: Check subdomain patterns (100% confidence, no fetch needed)
      const subdomainMatch = this.checkSubdomainPatterns(parsedUrl.hostname);
      if (subdomainMatch) {
        // Still fetch to check for GTM
        try {
          const html = await this.fetchHtml(normalizedUrl);
          const gtmEnabled = detectGTM(html);
          const config = PLATFORM_CONFIG[subdomainMatch];
          const features = [...config.features];
          if (gtmEnabled) {
            features.push("gtm_enabled");
          }
          return {
            platform: subdomainMatch,
            confidence: 100,
            features,
            paidPlanRequired: config.paidPlanRequired,
            estimatedTime: config.estimatedTime,
          };
        } catch {
          // If fetch fails, still return subdomain match
          const config = PLATFORM_CONFIG[subdomainMatch];
          return {
            platform: subdomainMatch,
            confidence: 100,
            features: config.features,
            paidPlanRequired: config.paidPlanRequired,
            estimatedTime: config.estimatedTime,
          };
        }
      }

      // Step 2: Fetch HTML and headers
      const { html, headers } = await this.fetchWithHeaders(normalizedUrl);

      // Step 3: Check response headers (80% confidence)
      const headerMatch = this.checkHeaders(headers);
      if (headerMatch) {
        const config = PLATFORM_CONFIG[headerMatch.platform];
        const features = [...config.features];
        if (detectGTM(html)) {
          features.push("gtm_enabled");
        }
        return {
          platform: headerMatch.platform,
          confidence: headerMatch.confidence,
          features,
          paidPlanRequired: config.paidPlanRequired,
          estimatedTime: config.estimatedTime,
        };
      }

      // Step 4: Check HTML signatures (90-95% confidence)
      const htmlMatch = this.checkHtmlSignatures(html);
      if (htmlMatch) {
        const config = PLATFORM_CONFIG[htmlMatch.platform];
        const features = [...config.features];
        if (detectGTM(html)) {
          features.push("gtm_enabled");
        }
        return {
          platform: htmlMatch.platform,
          confidence: htmlMatch.confidence,
          features,
          paidPlanRequired: config.paidPlanRequired,
          estimatedTime: config.estimatedTime,
        };
      }

      // Step 5: Unknown platform
      const features: string[] = [];
      if (detectGTM(html)) {
        features.push("gtm_enabled");
      }

      return {
        platform: "unknown",
        confidence: 0,
        features,
        paidPlanRequired: false,
        estimatedTime: "2 min",
      };
    } catch (error) {
      // On any error, return unknown
      return {
        platform: "unknown",
        confidence: 0,
        features: [],
        paidPlanRequired: false,
        estimatedTime: "2 min",
      };
    }
  }

  /**
   * Normalize URL by adding https:// if missing.
   */
  private normalizeUrl(url: string): string {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Check subdomain patterns for instant detection.
   */
  private checkSubdomainPatterns(hostname: string): SupportedPlatform | null {
    for (const { pattern, platform } of SUBDOMAIN_PATTERNS) {
      if (pattern.test(hostname)) {
        return platform;
      }
    }
    return null;
  }

  /**
   * Fetch HTML content with timeout.
   */
  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "TeveroSEO-PlatformDetector/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch HTML and headers with timeout.
   */
  private async fetchWithHeaders(
    url: string
  ): Promise<{ html: string; headers: Headers }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "TeveroSEO-PlatformDetector/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return { html, headers: response.headers };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check response headers for platform signatures.
   */
  private checkHeaders(
    headers: Headers
  ): { platform: SupportedPlatform; confidence: number } | null {
    for (const sig of HEADER_SIGNATURES) {
      const value = headers.get(sig.header);
      if (value && sig.check(value)) {
        return { platform: sig.platform, confidence: sig.confidence };
      }
    }
    return null;
  }

  /**
   * Check HTML content for platform signatures.
   */
  private checkHtmlSignatures(
    html: string
  ): { platform: SupportedPlatform; confidence: number } | null {
    for (const sig of HTML_SIGNATURES) {
      if (sig.check(html)) {
        return { platform: sig.platform, confidence: sig.confidence };
      }
    }
    return null;
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Convenience function for one-shot platform detection.
 *
 * @param url - The URL to detect platform for
 * @returns PlatformDetectionResult
 */
export async function detectPlatform(
  url: string
): Promise<PlatformDetectionResult> {
  const service = new PlatformDetectorService();
  return service.detectPlatform(url);
}
