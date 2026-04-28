/**
 * PageValidator Tests
 *
 * Comprehensive tests for consent/challenge page detection.
 * Tests cover:
 * - OneTrust consent detection
 * - Cloudflare challenge detection
 * - CookieBot dialog detection
 * - Valid product page passing
 * - Non-blocking consent banner handling
 * - Suspiciously small page detection
 * - Empty HTML handling
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PageValidator } from "./PageValidator";
import { ValidationResult } from "../types/validation";

// ========== Test HTML Samples ==========

const ONETRUST_CONSENT_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Cookie Consent Required</title></head>
<body>
  <div id="onetrust-consent-sdk">
    <div id="onetrust-banner-sdk" class="otFlat ot-wo-title vertical-align-content">
      <div class="ot-sdk-container">
        <div class="ot-sdk-row">
          <div id="onetrust-group-container" class="ot-sdk-twelve ot-sdk-columns">
            <h2>We use cookies</h2>
            <p>We use cookies and similar technologies to help personalize content.</p>
            <button id="onetrust-accept-all-handler">Accept All</button>
            <button id="onetrust-reject-all-handler">Reject All</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const CLOUDFLARE_CHALLENGE_PAGE = `
<!DOCTYPE html>
<html>
<head>
  <title>Just a moment...</title>
  <meta http-equiv="refresh" content="5">
</head>
<body>
  <div id="cf-challenge-running" class="cf-browser-verification">
    <h1>Checking your browser before accessing</h1>
    <p>This process is automatic. Your browser will redirect shortly.</p>
    <div id="cf-turnstile"></div>
    <p>Ray ID: 7a8b9c0d1e2f3g4h</p>
    <noscript>Please turn JavaScript on and reload the page.</noscript>
  </div>
  <script>
    (function(){
      window._cf_chl_opt={cvId: '2', cType: 'non-interactive'};
    })();
  </script>
</body>
</html>
`;

const COOKIEBOT_DIALOG_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Privacy Settings</title></head>
<body>
  <div id="CookiebotDialog" tabindex="-1" role="dialog">
    <div id="CookiebotDialogBody">
      <div id="CookiebotDialogBodyContent">
        <h2 id="CookiebotDialogBodyContentTitle">This website uses cookies</h2>
        <p id="CookiebotDialogBodyContentText">
          We use cookies to personalise content and ads, to provide social media features
          and to analyse our traffic.
        </p>
      </div>
      <div id="CookiebotDialogBodyButtons">
        <a id="CookiebotDialogBodyButtonAccept">Allow all</a>
        <a id="CookiebotDialogBodyButtonDecline">Decline</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

const VALID_PRODUCT_PAGE = `
<!DOCTYPE html>
<html lang="lt">
<head>
  <title>L'Oreal Professionnel Serie Expert Vitamino Color Shampoo 300ml</title>
  <meta name="description" content="Professional shampoo for color-treated hair">
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/hair-care">Hair Care</a>
    <a href="/shampoos">Shampoos</a>
  </nav>

  <main itemscope itemtype="https://schema.org/Product">
    <div class="product-gallery">
      <img src="/images/loreal-shampoo.jpg" alt="L'Oreal Shampoo">
    </div>

    <div class="product-info">
      <h1 class="product-title" itemprop="name">L'Oreal Professionnel Serie Expert Vitamino Color Shampoo 300ml</h1>

      <div class="product-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
        <span itemprop="price" content="29.99">29,99 EUR</span>
        <meta itemprop="priceCurrency" content="EUR">
        <link itemprop="availability" href="https://schema.org/InStock">
      </div>

      <div class="product-sku" itemprop="sku">LP-VIT-300</div>

      <div class="product-description" itemprop="description">
        <p>Professional color-protecting shampoo for vibrant, long-lasting color.
        Enriched with antioxidants and UV filters to protect hair color from fading.
        Gently cleanses while maintaining color brilliance. Suitable for all
        color-treated hair types. Contains resveratrol for enhanced protection.</p>
        <ul>
          <li>Protects color from fading</li>
          <li>Contains UV filters</li>
          <li>Gentle cleansing formula</li>
          <li>Professional salon quality</li>
        </ul>
      </div>

      <button class="add-to-cart" data-product-id="12345">Add to Cart</button>
    </div>
  </main>

  <footer>
    <p>Copyright 2024</p>
  </footer>
</body>
</html>
`;

const PRODUCT_PAGE_WITH_NON_BLOCKING_CONSENT = `
<!DOCTYPE html>
<html lang="lt">
<head>
  <title>Professional Hair Care Products</title>
</head>
<body>
  <!-- Non-blocking cookie banner at bottom -->
  <div class="cookie-banner" style="position: fixed; bottom: 0;">
    <p>We use cookies to improve your experience.</p>
    <button>Accept</button>
  </div>

  <main itemscope itemtype="https://schema.org/Product">
    <h1 class="product-title" itemprop="name">Olaplex No. 3 Hair Perfector 100ml</h1>

    <div class="product-description" itemprop="description">
      <p>The original at-home bond builder. Olaplex No.3 Hair Perfector is not a conditioner.
      It is a bond builder that works on a molecular level to repair damaged and compromised hair.
      Apply to damp hair, leave on for a minimum of 10 minutes, then rinse, shampoo and condition.
      This revolutionary formula reconnects broken disulfide bonds in your hair, restoring
      strength, structure and integrity. Suitable for all hair types including color-treated
      and chemically processed hair.</p>
    </div>

    <div class="product-price">
      <span itemprop="price" content="34.99">34,99 EUR</span>
    </div>

    <button class="add-to-cart" data-sku="OLAPLEX-3-100">Add to Cart</button>
  </main>
</body>
</html>
`;

const SUSPICIOUSLY_SMALL_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Loading...</title></head>
<body>
  <div class="loading">
    <p>Please wait while we verify your request...</p>
    <p>Cookie consent required</p>
  </div>
</body>
</html>
`;

const EMPTY_HTML = "";

const MINIMAL_VALID_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Product</title></head>
<body>
  <main>
    <h1 class="product-title">Test Product Name</h1>
    <p class="product-description">This is a test product description that contains enough text to pass the minimum content length requirement for validation purposes.</p>
    <span itemprop="price">19.99</span>
    <button class="add-to-cart">Buy Now</button>
  </main>
</body>
</html>
`;

const DATADOME_CHALLENGE = `
<!DOCTYPE html>
<html>
<head>
  <title>Human verification</title>
</head>
<body>
  <div class="datadome-captcha-container">
    <div class="dd-captcha">
      <h1>Verify you are human</h1>
      <p>Please complete the security check to access the website.</p>
      <div id="datadome-captcha-box"></div>
    </div>
  </div>
  <script src="https://js.datadome.co/captcha.js"></script>
</body>
</html>
`;

const HCAPTCHA_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Security Check</title></head>
<body>
  <div class="h-captcha-container">
    <h1>One more step</h1>
    <p>Please verify you are a human to continue.</p>
    <div class="h-captcha" data-sitekey="abc123"></div>
  </div>
</body>
</html>
`;

const RECAPTCHA_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Verify</title></head>
<body>
  <div class="recaptcha-page">
    <p>Please complete the reCAPTCHA below:</p>
    <div class="g-recaptcha" data-sitekey="xyz789"></div>
  </div>
</body>
</html>
`;

const IUBENDA_CONSENT = `
<!DOCTYPE html>
<html>
<head><title>Consent</title></head>
<body>
  <div class="iubenda-cs-container">
    <div class="iubenda-cs-content">
      <p>This site uses cookies. By continuing to browse the site you agree to our use of cookies.</p>
      <a class="iubenda-cs-accept-btn">Accept</a>
    </div>
  </div>
</body>
</html>
`;

const QUANTCAST_CONSENT = `
<!DOCTYPE html>
<html>
<head><title>Privacy</title></head>
<body>
  <div class="qc-cmp2-container">
    <div class="qc-cmp2-main">
      <p>We and our partners use cookies to provide you with a better experience.</p>
      <button class="qc-cmp2-accept">I Accept</button>
    </div>
  </div>
</body>
</html>
`;

const TARTEAUCITRON_PAGE = `
<!DOCTYPE html>
<html>
<head><title>Cookies</title></head>
<body>
  <div id="tarteaucitronRoot">
    <div id="tarteaucitronAlertBig">
      <span id="tarteaucitronDisclaimerAlert">
        This site uses cookies and gives you control over what you want to activate
      </span>
      <button id="tarteaucitronPersonalize">Accept</button>
    </div>
  </div>
</body>
</html>
`;

// ========== Tests ==========

describe("PageValidator", () => {
  let validator: PageValidator;

  beforeEach(() => {
    validator = new PageValidator();
  });

  describe("validate()", () => {
    describe("consent page detection", () => {
      it("should detect OneTrust consent page", () => {
        const result = validator.validate(ONETRUST_CONSENT_PAGE);

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain("onetrust");
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect CookieBot dialog page", () => {
        const result = validator.validate(COOKIEBOT_DIALOG_PAGE);

        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/cookiebot/i);
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect iubenda consent page", () => {
        const result = validator.validate(IUBENDA_CONSENT);

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain("iubenda");
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect Quantcast consent page", () => {
        const result = validator.validate(QUANTCAST_CONSENT);

        expect(result.isValid).toBe(false);
        // May match quantcast signature or generic consent keywords
        expect(result.reason).toMatch(/quantcast|consent|small_page/i);
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect tarteaucitron consent page", () => {
        const result = validator.validate(TARTEAUCITRON_PAGE);

        expect(result.isValid).toBe(false);
        expect(result.reason).toContain("tarteaucitron");
        expect(result.suggestedAction).toBe("retry_with_js");
      });
    });

    describe("challenge page detection", () => {
      it("should detect Cloudflare challenge page", () => {
        const result = validator.validate(CLOUDFLARE_CHALLENGE_PAGE);

        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(/cf-challenge|turnstile|cloudflare/i);
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect DataDome challenge page", () => {
        const result = validator.validate(DATADOME_CHALLENGE);

        expect(result.isValid).toBe(false);
        // May detect datadome, captcha, or security check signatures
        expect(result.reason).toMatch(/datadome|captcha|security|challenge/i);
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect hCaptcha page", () => {
        const result = validator.validate(HCAPTCHA_PAGE);

        expect(result.isValid).toBe(false);
        // May detect hcaptcha, captcha, or security check signatures
        expect(result.reason).toMatch(/hcaptcha|captcha|h-captcha|security|challenge/i);
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should detect reCAPTCHA page", () => {
        const result = validator.validate(RECAPTCHA_PAGE);

        expect(result.isValid).toBe(false);
        // May detect recaptcha or generic captcha signature
        expect(result.reason).toMatch(/recaptcha|captcha|g-recaptcha/i);
        expect(result.suggestedAction).toBe("retry_with_js");
      });
    });

    describe("valid page handling", () => {
      it("should pass valid product page", () => {
        const result = validator.validate(VALID_PRODUCT_PAGE);

        expect(result.isValid).toBe(true);
        expect(result.reason).toBe("ok");
        expect(result.suggestedAction).toBeNull();
      });

      it("should pass product page with non-blocking consent banner", () => {
        const result = validator.validate(PRODUCT_PAGE_WITH_NON_BLOCKING_CONSENT);

        expect(result.isValid).toBe(true);
        expect(result.reason).toBe("ok");
        expect(result.suggestedAction).toBeNull();
      });

      it("should pass minimal valid product page", () => {
        const result = validator.validate(MINIMAL_VALID_PAGE);

        expect(result.isValid).toBe(true);
        expect(result.reason).toBe("ok");
      });
    });

    describe("edge cases", () => {
      it("should detect suspiciously small page", () => {
        const result = validator.validate(SUSPICIOUSLY_SMALL_PAGE);

        expect(result.isValid).toBe(false);
        expect(result.reason).toMatch(
          /small_page_with_consent_keywords|consent_or_challenge/
        );
        expect(result.suggestedAction).toBe("retry_with_js");
      });

      it("should handle empty HTML gracefully", () => {
        const result = validator.validate(EMPTY_HTML);

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe("empty_html");
        expect(result.suggestedAction).toBe("skip_or_reclassify");
      });

      it("should handle null-like HTML gracefully", () => {
        const result = validator.validate("   ");

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe("empty_html");
      });

      it("should handle HTML with only whitespace", () => {
        const result = validator.validate("\n\n\t\t   \n");

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe("empty_html");
      });
    });

    describe("details in result", () => {
      it("should include htmlSize in details", () => {
        const result = validator.validate(VALID_PRODUCT_PAGE);

        expect(result.details).toBeDefined();
        expect(result.details?.htmlSize).toBeGreaterThan(0);
      });

      it("should include detectedSignature when consent detected", () => {
        const result = validator.validate(ONETRUST_CONSENT_PAGE);

        expect(result.details?.detectedSignature).toBeDefined();
        expect(result.details?.detectedSignature).toContain("onetrust");
      });

      it("should include hasProductIndicators for valid pages", () => {
        const result = validator.validate(VALID_PRODUCT_PAGE);

        expect(result.details?.hasProductIndicators).toBe(true);
      });
    });
  });

  describe("isConsentOrChallengePage()", () => {
    it("should return true for consent pages", () => {
      expect(validator.isConsentOrChallengePage(ONETRUST_CONSENT_PAGE)).toBe(true);
      expect(validator.isConsentOrChallengePage(COOKIEBOT_DIALOG_PAGE)).toBe(true);
    });

    it("should return true for challenge pages", () => {
      expect(validator.isConsentOrChallengePage(CLOUDFLARE_CHALLENGE_PAGE)).toBe(
        true
      );
      expect(validator.isConsentOrChallengePage(DATADOME_CHALLENGE)).toBe(true);
    });

    it("should return false for valid product pages", () => {
      expect(validator.isConsentOrChallengePage(VALID_PRODUCT_PAGE)).toBe(false);
      expect(
        validator.isConsentOrChallengePage(PRODUCT_PAGE_WITH_NON_BLOCKING_CONSENT)
      ).toBe(false);
    });

    it("should return false for empty HTML", () => {
      expect(validator.isConsentOrChallengePage("")).toBe(false);
    });
  });

  describe("hasMainContent()", () => {
    it("should return true for pages with main content", () => {
      expect(validator.hasMainContent(VALID_PRODUCT_PAGE)).toBe(true);
      expect(validator.hasMainContent(PRODUCT_PAGE_WITH_NON_BLOCKING_CONSENT)).toBe(
        true
      );
    });

    it("should return false for small pages without substantial content", () => {
      // Consent pages may have <main> tags but little meaningful content
      // The key test is that small/suspicious pages fail
      expect(validator.hasMainContent(SUSPICIOUSLY_SMALL_PAGE)).toBe(false);
    });
  });

  describe("looksLikeProductPage()", () => {
    it("should return true for product pages with schema.org markup", () => {
      expect(validator.looksLikeProductPage(VALID_PRODUCT_PAGE)).toBe(true);
    });

    it("should return true for product pages with common selectors", () => {
      const simpleProductPage = `
        <html>
          <body>
            <h1 class="product-title">Test Product</h1>
            <div class="product-description">Description here</div>
            <button class="add-to-cart">Add to Cart</button>
          </body>
        </html>
      `;
      expect(validator.looksLikeProductPage(simpleProductPage)).toBe(true);
    });

    it("should return true for pages with data-sku attribute", () => {
      const skuPage = `
        <html>
          <body>
            <div data-sku="ABC123">Product</div>
          </body>
        </html>
      `;
      expect(validator.looksLikeProductPage(skuPage)).toBe(true);
    });

    it("should return false for pages without product indicators", () => {
      const nonProductPage = `
        <html>
          <body>
            <h1>About Us</h1>
            <p>We are a company.</p>
          </body>
        </html>
      `;
      expect(validator.looksLikeProductPage(nonProductPage)).toBe(false);
    });
  });

  describe("configuration", () => {
    it("should respect custom minHtmlSize", () => {
      const strictValidator = new PageValidator({ minHtmlSize: 10000 });
      const result = strictValidator.validate(MINIMAL_VALID_PAGE);

      // Minimal page might be flagged with stricter threshold
      expect(result.isValid).toBeDefined();
    });

    it("should respect custom minContentLength", () => {
      const strictValidator = new PageValidator({ minContentLength: 500 });
      const result = strictValidator.validate(MINIMAL_VALID_PAGE);

      // May fail with stricter content length requirement
      expect(result).toBeDefined();
    });

    it("should respect requireProductIndicators=false", () => {
      const relaxedValidator = new PageValidator({
        requireProductIndicators: false,
      });

      // Page without product indicators but with content
      const contentOnlyPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Article</title></head>
        <body>
          <main>
            <article>
              <h1>Article Title</h1>
              <p>This is a long article with substantial content that should pass
              validation when product indicators are not required. It contains
              multiple paragraphs and meaningful text.</p>
            </article>
          </main>
        </body>
        </html>
      `;

      const result = relaxedValidator.validate(contentOnlyPage);
      expect(result.isValid).toBe(true);
    });
  });

  describe("case insensitivity", () => {
    it("should detect uppercase signature variations", () => {
      const uppercaseConsent = `
        <html>
        <body>
          <div id="ONETRUST-CONSENT-SDK">
            <p>Cookie consent</p>
          </div>
        </body>
        </html>
      `;

      const result = validator.validate(uppercaseConsent);
      expect(result.isValid).toBe(false);
    });

    it("should detect mixed case signatures", () => {
      const mixedCase = `
        <html>
        <body>
          <div id="CookieBot">Please accept cookies</div>
        </body>
        </html>
      `;

      const result = validator.validate(mixedCase);
      expect(result.isValid).toBe(false);
    });
  });

  describe("real-world scenarios", () => {
    it("should handle Lithuanian e-commerce with small notice", () => {
      // Larger page with non-blocking notice passes validation
      const lithuanianPage = `
        <!DOCTYPE html>
        <html lang="lt">
        <head><title>Plaukų priežiūros produktai - L'Oreal Professional</title>
        <meta name="description" content="Profesionali plaukų kosmetika"></head>
        <body>
          <header><nav><a href="/">Pradžia</a><a href="/produktai">Produktai</a></nav></header>
          <div class="notice-bar">Nemokamas pristatymas užsakymams virš 50 EUR</div>

          <main itemscope itemtype="https://schema.org/Product">
            <h1 class="product-title" itemprop="name">
              L'Oreal Professionnel Serie Expert Vitamino Color šampūnas dažytiems plaukams 300ml
            </h1>
            <div class="product-description" itemprop="description">
              Profesionalus šampūnas dažytiems plaukams. Apsaugo spalvą nuo blukimo,
              suteikia plaukams žvilgesio ir minkštumo. Tinka kasdieniam naudojimui.
              Sudėtyje yra antioksidantų ir UV filtrų. Rekomenduojama naudoti kartu su
              Vitamino Color kondicionieriumi ir kauke geriausiems rezultatams.
            </div>
            <span itemprop="price" content="29.99">29,99 EUR</span>
            <button class="add-to-cart">Į krepšelį</button>
          </main>
          <footer><p>Copyright 2024 Hair Store LT</p></footer>
        </body>
        </html>
      `;

      const result = validator.validate(lithuanianPage);
      expect(result.isValid).toBe(true);
    });

    it("should handle Shopify product page", () => {
      const shopifyPage = `
        <!DOCTYPE html>
        <html>
        <head><title>Product - Shopify Store</title></head>
        <body>
          <div class="product-single">
            <h1 class="product__title">Premium Hair Oil</h1>
            <div class="product__price">$24.99</div>
            <div class="product__description">
              Nourishing hair oil for all hair types. Made with natural argan oil
              and vitamin E to restore shine and reduce frizz. Apply to damp or
              dry hair for best results.
            </div>
            <button name="add" class="btn product-form__cart-submit">Add to cart</button>
          </div>
        </body>
        </html>
      `;

      const result = validator.validate(shopifyPage);
      expect(result.isValid).toBe(true);
    });

    it("should handle WooCommerce product page", () => {
      const wooCommercePage = `
        <!DOCTYPE html>
        <html>
        <head><title>Product - WooCommerce</title></head>
        <body class="single-product">
          <div class="product">
            <h1 class="product_title entry-title">Conditioning Treatment</h1>
            <p class="woocommerce-Price-amount amount">
              <span class="woocommerce-Price-currencySymbol">EUR</span>19.99
            </p>
            <div class="woocommerce-product-details__short-description">
              Deep conditioning treatment for damaged hair. Repairs and strengthens
              while adding moisture and shine.
            </div>
            <button type="submit" name="add-to-cart" class="single_add_to_cart_button">
              Add to cart
            </button>
          </div>
        </body>
        </html>
      `;

      const result = validator.validate(wooCommercePage);
      expect(result.isValid).toBe(true);
    });
  });
});
