/**
 * SPADetector
 *
 * Detects Single Page Application frameworks in HTML.
 * Per D-18: SPA detection identifies React/Next/Vue/Nuxt/Angular indicators.
 */

export type SPAFramework =
  | "react"
  | "next"
  | "vue"
  | "nuxt"
  | "angular"
  | "unknown";

export interface SPADetectionResult {
  isSPA: boolean;
  framework: SPAFramework | null;
  hasContent: boolean;
  indicators: string[];
}

interface SPAIndicator {
  pattern: string | RegExp;
  framework: SPAFramework;
  name: string;
}

/**
 * SPA indicators with pattern and framework mapping.
 * Order matters - more specific patterns should come first.
 */
const SPA_INDICATORS: SPAIndicator[] = [
  // Next.js (check before React since Next uses React)
  { pattern: "__NEXT_DATA__", framework: "next", name: "__NEXT_DATA__" },
  { pattern: 'id="__next"', framework: "next", name: "__next div" },
  { pattern: "window.__NEXT_DATA__", framework: "next", name: "window.__NEXT_DATA__" },

  // Nuxt.js (check before Vue since Nuxt uses Vue)
  { pattern: "__NUXT__", framework: "nuxt", name: "__NUXT__" },
  { pattern: "window.__NUXT__", framework: "nuxt", name: "window.__NUXT__" },
  { pattern: 'id="__nuxt"', framework: "nuxt", name: "__nuxt div" },

  // React
  { pattern: '<div id="root"></div>', framework: "react", name: "root div empty" },
  { pattern: 'data-reactroot', framework: "react", name: "data-reactroot" },

  // Vue
  { pattern: '<div id="app"></div>', framework: "vue", name: "app div empty" },

  // Angular
  { pattern: "ng-app", framework: "angular", name: "ng-app" },
  { pattern: "ng-version", framework: "angular", name: "ng-version" },
];

/**
 * Content indicators to check if page has meaningful rendered content.
 */
const CONTENT_PATTERNS: RegExp[] = [
  /<h1[^>]*>.+<\/h1>/is,
  /<article[^>]*>/i,
  /<main[^>]*>.{50,}<\/main>/is,
  /<p[^>]*>.{50,}<\/p>/is,
];

const DEFAULT_USER_AGENT = "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)";

export class SPADetector {
  /**
   * Detect if HTML contains SPA framework indicators.
   *
   * @param html - Raw HTML content
   * @returns Detection result with framework info
   */
  static detect(html: string): SPADetectionResult {
    const indicators: string[] = [];
    let framework: SPAFramework | null = null;

    // Check for SPA indicators
    for (const indicator of SPA_INDICATORS) {
      const matches =
        typeof indicator.pattern === "string"
          ? html.includes(indicator.pattern)
          : indicator.pattern.test(html);

      if (matches) {
        indicators.push(indicator.name);
        // Set framework from first match (most specific)
        if (!framework) {
          framework = indicator.framework;
        }
      }
    }

    const isSPA = indicators.length > 0;

    // Check for meaningful content
    const hasContent = CONTENT_PATTERNS.some((pattern) => pattern.test(html));

    return {
      isSPA,
      framework: isSPA ? framework : null,
      hasContent,
      indicators,
    };
  }

  /**
   * Check if HTML needs JavaScript rendering.
   * Returns true only if SPA detected AND no meaningful content.
   *
   * @param html - Raw HTML content
   * @returns true if JS rendering is needed
   */
  static needsJsRendering(html: string): boolean {
    const detection = this.detect(html);
    return detection.isSPA && !detection.hasContent;
  }

  /**
   * Fetch URL and check if it needs JS rendering.
   *
   * @param url - URL to check
   * @returns Object with needsJs flag and detection details
   */
  static async checkUrl(
    url: string
  ): Promise<{ needsJs: boolean; detection: SPADetectionResult }> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          needsJs: false,
          detection: {
            isSPA: false,
            framework: null,
            hasContent: false,
            indicators: [],
          },
        };
      }

      const html = await response.text();
      const detection = this.detect(html);

      return {
        needsJs: detection.isSPA && !detection.hasContent,
        detection,
      };
    } catch {
      return {
        needsJs: false,
        detection: {
          isSPA: false,
          framework: null,
          hasContent: false,
          indicators: [],
        },
      };
    }
  }
}

/**
 * Convenience function for SPA detection.
 */
export function detectSPA(html: string): SPADetectionResult {
  return SPADetector.detect(html);
}

/**
 * Convenience function to check if JS rendering is needed.
 */
export function needsJsRendering(html: string): boolean {
  return SPADetector.needsJsRendering(html);
}
