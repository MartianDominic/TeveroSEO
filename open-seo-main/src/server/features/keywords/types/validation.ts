/**
 * Page Validation Types
 *
 * Types for consent/challenge page detection in the crawler system.
 * Used by PageValidator to identify cookie consent walls, bot challenges,
 * and blocking pages that return HTTP 200 but contain no real content.
 */

/**
 * Suggested action for the crawler when validation fails.
 * - "retry_with_js": Page may render correctly with JavaScript
 * - "skip_or_reclassify": Page is not a product page or should be skipped
 * - null: Page is valid, no action needed
 */
export type SuggestedAction = "retry_with_js" | "skip_or_reclassify" | null;

/**
 * Reason codes for validation results.
 * Provides machine-readable feedback for debugging and metrics.
 */
export type ValidationReason =
  // Success
  | "ok"
  // Consent/challenge detection
  | `consent_or_challenge:${string}`
  | `consent_banner_blocking:${string}`
  // Content issues
  | "small_page_with_consent_keywords"
  | "no_product_content_found"
  | "suspiciously_small_page"
  // Edge cases
  | "empty_html"
  | "invalid_html";

/**
 * Result of page validation.
 */
export interface ValidationResult {
  /** Whether the page contains valid extractable content */
  isValid: boolean;

  /** Machine-readable reason code for the validation result */
  reason: ValidationReason;

  /** Suggested action for the crawler to take */
  suggestedAction: SuggestedAction;

  /** Optional details for debugging */
  details?: {
    /** Detected consent/challenge signature if any */
    detectedSignature?: string;
    /** HTML size in bytes */
    htmlSize?: number;
    /** Main content length in characters */
    contentLength?: number;
    /** Whether product indicators were found */
    hasProductIndicators?: boolean;
  };
}

/**
 * Configuration for PageValidator thresholds.
 */
export interface ValidationConfig {
  /** Minimum HTML size in bytes (pages smaller than this with consent keywords are suspicious) */
  minHtmlSize: number;

  /** Minimum main content length in characters */
  minContentLength: number;

  /** Whether to require product indicators for valid pages */
  requireProductIndicators: boolean;
}

/**
 * Default validation configuration.
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  minHtmlSize: 5000,
  minContentLength: 200,
  requireProductIndicators: true,
};
