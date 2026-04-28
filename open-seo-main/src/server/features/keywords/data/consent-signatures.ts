/**
 * Consent and Challenge Detection Signatures
 *
 * Comprehensive lists of signatures for detecting:
 * - Cookie consent platforms (GDPR compliance)
 * - Bot challenge/verification pages (Cloudflare, etc.)
 * - CAPTCHA services
 * - Product page indicators
 *
 * These signatures are used for fast string matching before any DOM parsing.
 */

/**
 * Cookie consent platform signatures.
 * Found in HTML source of consent dialogs and banners.
 * 30+ platforms covering major EU compliance tools.
 */
export const CONSENT_SIGNATURES: readonly string[] = [
  // Major commercial platforms
  "cookiebot",
  "onetrust",
  "iubenda",
  "cookieconsent",
  "tarteaucitron",
  "cookiefirst",
  "quantcast",
  "trustarc",
  "cookiepro",
  "osano",
  "termly",
  "securiti",
  "usercentrics",
  "didomi",
  "consentmanager",
  "crownpeak",
  "ensighten",
  "evidon",
  "complianz",
  "cookieyes",
  "cookielaw",
  "cookie-law-info",
  "gdpr-cookie-compliance",
  "cookie-notice",
  "cookie-script",
  "moove-gdpr",
  "eu-cookie-law",
  "cookie-bar",
  "cookie-consent-box",
  "klaro-cookie",

  // Generic consent keywords (when combined with small page size)
  "cookie-consent",
  "gdpr-consent",
  "cookie-policy",
  "privacy-consent",
] as const;

/**
 * DOM selectors for consent banners and dialogs.
 * Used to detect consent UI elements in the page structure.
 * 10+ selectors covering common implementations.
 */
export const CONSENT_DOM_SELECTORS: readonly string[] = [
  // OneTrust
  "#onetrust-consent-sdk",
  "#onetrust-banner-sdk",
  "#onetrust-pc-sdk",

  // Cookiebot
  "#CookiebotDialog",
  "#CookiebotDialogBody",
  "#CookieConsent",

  // Generic/common patterns
  ".cc-banner",
  ".cc-window",
  "#gdpr-cookie-notice",
  "#cookie-notice",
  '[data-cookieconsent="true"]',
  "[data-cookieconsent]",
  ".cookie-consent-banner",
  ".cookie-consent-modal",
  ".cookie-banner",
  ".consent-banner",
  ".privacy-banner",

  // TarteAuCitron
  "#tarteaucitronRoot",
  "#tarteaucitronAlertBig",

  // Quantcast
  ".qc-cmp-ui-container",
  ".qc-cmp2-container",

  // Iubenda
  ".iubenda-cs-container",

  // UserCentrics
  "#usercentrics-root",

  // Didomi
  "#didomi-host",

  // Complianz
  ".cmplz-cookiebanner",

  // CookieYes
  ".cky-consent-container",
] as const;

/**
 * Bot challenge and verification signatures.
 * Detect pages that are bot verification challenges rather than content.
 * 15+ signatures covering major anti-bot services.
 */
export const BOT_CHALLENGE_SIGNATURES: readonly string[] = [
  // Cloudflare
  "cf-challenge",
  "cf-turnstile",
  "cf-chl-bypass",
  "challenge-platform",
  "cf-browser-verification",
  "just a moment",
  "checking your browser",
  "ray id",
  "cf-mitigated",
  "__cf_chl_opt",
  "cf_chl_prog",

  // Generic challenges
  "browser-check",
  "please wait",
  "verifying",
  "access denied",
  "blocked",
  "security check",
  "ddos protection",
  "under attack mode",

  // CAPTCHA services
  "captcha",
  "recaptcha",
  "hcaptcha",
  "g-recaptcha",
  "h-captcha",

  // Commercial bot detection
  "datadome",
  "perimeterx",
  "kasada",
  "akamai-bot-manager",
  "imperva",
  "incapsula",
  "distil",
  "shape security",
  "human-challenge",
  "bot-challenge",
] as const;

/**
 * Product page indicators.
 * Used to verify a page is likely a product page with real content.
 * Presence of these elements suggests the page has valid product data.
 */
export const PRODUCT_PAGE_INDICATORS: readonly string[] = [
  // Schema.org Product markup
  '[itemprop="product"]',
  '[itemtype*="schema.org/Product"]',
  '[itemtype*="schema.org/Offer"]',
  "[itemscope][itemtype*=Product]",

  // Common product selectors
  ".product-title",
  ".product-name",
  ".product-info",
  ".product-detail",
  ".product-description",
  ".product-price",

  // Data attributes
  "[data-product-id]",
  "[data-sku]",
  "[data-product]",
  "[data-item-id]",
  "[data-product-sku]",

  // E-commerce actions
  ".add-to-cart",
  ".buy-button",
  ".add-to-basket",
  "[data-add-to-cart]",
  "#add-to-cart",
  'button[name="add"]',

  // Price indicators
  '[itemprop="price"]',
  '[itemprop="priceCurrency"]',
  ".price",
  ".current-price",
  ".sale-price",

  // Availability
  '[itemprop="availability"]',
  ".stock-status",
  ".availability",

  // WooCommerce specific
  ".woocommerce-product-details__short-description",
  ".single-product",
  ".product_title",

  // Shopify specific
  ".product__title",
  ".product__price",
  ".product-single",
] as const;

/**
 * Content selectors for validating main content presence.
 * Used to check if page has substantial content beyond consent banners.
 */
export const MAIN_CONTENT_SELECTORS: readonly string[] = [
  "main",
  "article",
  ".product-description",
  '[itemprop="description"]',
  ".content",
  "#content",
  ".main-content",
  "#main-content",
  ".page-content",
  ".entry-content",
  ".product-content",
  ".product-details",
] as const;
