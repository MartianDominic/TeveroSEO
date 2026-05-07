/**
 * Content Quality Assessor
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Analyzes HTML content to determine if scraping was successful and
 * if tier escalation is needed.
 *
 * Quality checks:
 * - Word count (minimum viable content)
 * - Text-to-HTML ratio (not just boilerplate)
 * - H1 presence (proper page structure)
 * - SPA shell detection (needs JS rendering)
 * - Bot detection page identification
 * - CAPTCHA presence
 */

import * as cheerio from "cheerio";
import type { EscalationReason, DetectedTechnology } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// Types
// =============================================================================

export interface QualityAssessment {
  /** Overall quality score 0-1 (1 = perfect, 0 = complete failure) */
  score: number;

  /** Whether the content passes minimum quality bar */
  acceptable: boolean;

  /** Detected issues that reduced the score */
  issues: string[];

  /** Suggested escalation reason if not acceptable */
  escalationReason?: EscalationReason;

  /** Detailed metrics */
  metrics: QualityMetrics;

  /** Detected technologies */
  technologies: DetectedTechnology[];
}

export interface QualityMetrics {
  /** Total word count in body text */
  wordCount: number;

  /** Ratio of text content to HTML length */
  textRatio: number;

  /** Whether page has a body element */
  hasBody: boolean;

  /** Whether page has a title element with content */
  hasTitle: boolean;

  /** Number of H1 elements */
  h1Count: number;

  /** Number of H2 elements */
  h2Count: number;

  /** Total HTML length in bytes */
  htmlLength: number;

  /** Body text length in characters */
  textLength: number;

  /** Number of links on page */
  linkCount: number;

  /** Number of images on page */
  imageCount: number;

  /** Whether page appears to be an SPA shell */
  isSpaShell: boolean;

  /** Whether page is a bot detection challenge */
  isBotDetectionPage: boolean;

  /** Whether page contains a CAPTCHA */
  isCaptchaPage: boolean;

  /** Whether Cloudflare challenge is present */
  isCloudflareChallenge: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Quality thresholds.
 */
const THRESHOLDS = {
  /** Minimum word count for acceptable content */
  MIN_WORD_COUNT: 50,

  /** Strong indicator of good content */
  GOOD_WORD_COUNT: 200,

  /** Minimum text-to-HTML ratio */
  MIN_TEXT_RATIO: 0.03,

  /** Good text-to-HTML ratio */
  GOOD_TEXT_RATIO: 0.1,

  /** Minimum HTML length for a real page */
  MIN_HTML_LENGTH: 500,

  /** Score threshold for "acceptable" content */
  ACCEPTABLE_THRESHOLD: 0.5,
};

/**
 * SPA framework indicators that suggest JS rendering is needed.
 */
const SPA_INDICATORS = [
  '<div id="root"></div>',
  '<div id="app"></div>',
  '<div id="__next"></div>',
  '<div id="__nuxt"></div>',
  "ng-app",
  "data-reactroot",
  "data-v-app",
  "window.__NUXT__",
  "window.__NEXT_DATA__",
  "window.__INITIAL_STATE__",
  "window.__PRELOADED_STATE__",
];

/**
 * Bot detection page indicators.
 */
const BOT_DETECTION_PATTERNS = [
  "Please verify you are human",
  "Are you a robot",
  "Pardon Our Interruption",
  "We want to make sure it is actually you",
  "detecting automated access",
  "Access Denied",
  "You have been blocked",
  "Your IP has been blocked",
  "Security Check Required",
  "One more step",
  "unusual traffic",
  "automated queries",
  "please complete the security check",
  "verify you are a human",
];

/**
 * CAPTCHA indicators.
 */
const CAPTCHA_PATTERNS = [
  "g-recaptcha",
  "h-captcha",
  "captcha-container",
  "cf-turnstile",
  "arkose-challenge",
  "recaptcha/api",
  "hcaptcha.com",
  "funcaptcha",
];

/**
 * Cloudflare challenge indicators.
 */
const CLOUDFLARE_PATTERNS = [
  "Attention Required",
  "cf-browser-verification",
  "__cf_chl_opt",
  "cloudflare-static",
  "Just a moment",
  "Checking your browser",
  "Enable JavaScript and cookies",
  "challenge-platform",
  "cf-ray",
  "cf-mitigated",
];

/**
 * Technology detection patterns.
 */
const TECHNOLOGY_PATTERNS: Array<{
  tech: DetectedTechnology;
  patterns: string[];
}> = [
  // CMS
  { tech: "wordpress", patterns: ["wp-content", "wp-includes", "wordpress"] },
  { tech: "shopify", patterns: ["cdn.shopify", "shopify-section", "Shopify.theme"] },
  { tech: "woocommerce", patterns: ["woocommerce", "wc-block"] },
  { tech: "squarespace", patterns: ["squarespace", "static.squarespace"] },
  { tech: "wix", patterns: ["wix.com", "wixsite", "parastorage.com"] },
  { tech: "webflow", patterns: ["webflow", "wf-page"] },
  { tech: "drupal", patterns: ["drupal", "sites/default/files"] },
  { tech: "magento", patterns: ["magento", "mage/cookies"] },

  // JS Frameworks
  { tech: "nextjs", patterns: ["__NEXT_DATA__", "_next/static", "/_next/"] },
  { tech: "nuxt", patterns: ["__NUXT__", "_nuxt/", "/_nuxt/"] },
  { tech: "react", patterns: ["data-reactroot", "react-root", "__reactContainer"] },
  { tech: "vue", patterns: ["v-cloak", "data-v-", "Vue.js"] },
  { tech: "angular", patterns: ["ng-app", "ng-version", "_ng"] },
  { tech: "svelte", patterns: ["svelte", "__svelte"] },
  { tech: "gatsby", patterns: ["gatsby", "___gatsby"] },

  // Anti-bot
  { tech: "cloudflare", patterns: ["cf-ray", "cloudflare", "cf-browser-verification"] },
  { tech: "akamai", patterns: ["akamai", "_abck", "ak_bmsc"] },
  { tech: "imperva", patterns: ["imperva", "incapsula", "_imp_apg_r_"] },
  { tech: "datadome", patterns: ["datadome", "dd_m", "dd_s"] },
  { tech: "perimeterx", patterns: ["perimeterx", "_px", "px-captcha"] },
  { tech: "recaptcha", patterns: ["g-recaptcha", "recaptcha/api"] },
  { tech: "hcaptcha", patterns: ["h-captcha", "hcaptcha.com"] },
];

// =============================================================================
// Content Quality Assessor
// =============================================================================

export class ContentQualityAssessor {
  /**
   * Assess HTML content quality.
   */
  assess(html: string): QualityAssessment {
    const $ = cheerio.load(html);
    const htmlLower = html.toLowerCase();
    const issues: string[] = [];
    let score = 1.0;

    // Extract text content
    const bodyText = $("body")
      .clone()
      .find("script, style, noscript")
      .remove()
      .end()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    // Calculate metrics
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;
    const textLength = bodyText.length;
    const htmlLength = html.length;
    const textRatio = htmlLength > 0 ? textLength / htmlLength : 0;
    const hasBody = $("body").length > 0;
    const hasTitle = $("title").length > 0 && $("title").text().trim().length > 0;
    const h1Count = $("h1").length;
    const h2Count = $("h2").length;
    const linkCount = $("a[href]").length;
    const imageCount = $("img").length;

    // Detect blocking and challenges
    const isSpaShell = this.detectSpaShell(html, wordCount);
    const isBotDetectionPage = this.detectBotPage(htmlLower);
    const isCaptchaPage = this.detectCaptcha(htmlLower);
    const isCloudflareChallenge = this.detectCloudflare(htmlLower);

    // Detect technologies
    const technologies = this.detectTechnologies(htmlLower);

    // Calculate score based on issues

    // Critical failures (score = 0)
    if (isCloudflareChallenge) {
      score = 0;
      issues.push("Cloudflare challenge detected");
    } else if (isCaptchaPage) {
      score = 0;
      issues.push("CAPTCHA page detected");
    } else if (isBotDetectionPage) {
      score = 0;
      issues.push("Bot detection page detected");
    }

    // Major issues
    if (score > 0) {
      // Word count
      if (wordCount < THRESHOLDS.MIN_WORD_COUNT) {
        score -= 0.4;
        issues.push(`Low word count: ${wordCount} (min: ${THRESHOLDS.MIN_WORD_COUNT})`);
      } else if (wordCount < THRESHOLDS.GOOD_WORD_COUNT) {
        score -= 0.15;
        issues.push(`Below average word count: ${wordCount}`);
      }

      // Text ratio
      if (textRatio < THRESHOLDS.MIN_TEXT_RATIO) {
        score -= 0.3;
        issues.push(`Low text ratio: ${(textRatio * 100).toFixed(1)}% (min: ${THRESHOLDS.MIN_TEXT_RATIO * 100}%)`);
      } else if (textRatio < THRESHOLDS.GOOD_TEXT_RATIO) {
        score -= 0.1;
        issues.push(`Below average text ratio: ${(textRatio * 100).toFixed(1)}%`);
      }

      // SPA shell (needs JS rendering)
      if (isSpaShell) {
        score -= 0.4;
        issues.push("SPA shell detected (JS rendering required)");
      }

      // Structure issues
      if (!hasBody) {
        score -= 0.3;
        issues.push("No body element");
      }
      if (!hasTitle) {
        score -= 0.1;
        issues.push("No title element");
      }
      if (h1Count === 0 && wordCount > 50) {
        score -= 0.1;
        issues.push("No H1 element");
      }

      // HTML length check
      if (htmlLength < THRESHOLDS.MIN_HTML_LENGTH) {
        score -= 0.2;
        issues.push(`Very short HTML: ${htmlLength} bytes`);
      }
    }

    // Clamp score
    score = Math.max(0, Math.min(1, score));

    // Determine escalation reason
    let escalationReason: EscalationReason | undefined;
    if (score < THRESHOLDS.ACCEPTABLE_THRESHOLD) {
      if (isCloudflareChallenge || isBotDetectionPage) {
        escalationReason = "bot_detected";
      } else if (isCaptchaPage) {
        escalationReason = "captcha";
      } else if (isSpaShell) {
        escalationReason = "js_required";
      } else if (wordCount < THRESHOLDS.MIN_WORD_COUNT) {
        escalationReason = "empty_response";
      }
    }

    return {
      score,
      acceptable: score >= THRESHOLDS.ACCEPTABLE_THRESHOLD,
      issues,
      escalationReason,
      metrics: {
        wordCount,
        textRatio,
        hasBody,
        hasTitle,
        h1Count,
        h2Count,
        htmlLength,
        textLength,
        linkCount,
        imageCount,
        isSpaShell,
        isBotDetectionPage,
        isCaptchaPage,
        isCloudflareChallenge,
      },
      technologies,
    };
  }

  /**
   * Quick check if content is acceptable (without full assessment).
   */
  isAcceptable(html: string): boolean {
    const assessment = this.assess(html);
    return assessment.acceptable;
  }

  /**
   * Get suggested escalation reason for failed content.
   */
  getEscalationReason(html: string): EscalationReason | undefined {
    const assessment = this.assess(html);
    return assessment.escalationReason;
  }

  /**
   * Detect if page is an SPA shell needing JS rendering.
   */
  private detectSpaShell(html: string, wordCount: number): boolean {
    // Only consider it a shell if word count is low
    if (wordCount >= 100) {
      return false;
    }

    const htmlLower = html.toLowerCase();
    return SPA_INDICATORS.some((indicator) =>
      htmlLower.includes(indicator.toLowerCase())
    );
  }

  /**
   * Detect bot detection/blocking pages.
   */
  private detectBotPage(htmlLower: string): boolean {
    return BOT_DETECTION_PATTERNS.some((pattern) =>
      htmlLower.includes(pattern.toLowerCase())
    );
  }

  /**
   * Detect CAPTCHA presence.
   */
  private detectCaptcha(htmlLower: string): boolean {
    return CAPTCHA_PATTERNS.some((pattern) =>
      htmlLower.includes(pattern.toLowerCase())
    );
  }

  /**
   * Detect Cloudflare challenge specifically.
   */
  private detectCloudflare(htmlLower: string): boolean {
    // Need multiple indicators for high confidence
    const indicators = CLOUDFLARE_PATTERNS.filter((pattern) =>
      htmlLower.includes(pattern.toLowerCase())
    );

    // Single indicator might be a false positive (e.g., cf-ray header mention)
    // Two or more is strong signal
    return indicators.length >= 2;
  }

  /**
   * Detect technologies from HTML content.
   */
  private detectTechnologies(htmlLower: string): DetectedTechnology[] {
    const detected: DetectedTechnology[] = [];

    for (const { tech, patterns } of TECHNOLOGY_PATTERNS) {
      if (patterns.some((p) => htmlLower.includes(p.toLowerCase()))) {
        detected.push(tech);
      }
    }

    // Add React if Next.js detected (implicit)
    if (detected.includes("nextjs") && !detected.includes("react")) {
      detected.push("react");
    }
    // Add Vue if Nuxt detected (implicit)
    if (detected.includes("nuxt") && !detected.includes("vue")) {
      detected.push("vue");
    }

    return [...new Set(detected)]; // Deduplicate
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const contentQualityAssessor = new ContentQualityAssessor();
