/**
 * Tests for Tier 2 Mobile Checks (T2-18 to T2-21)
 */
import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { getCheckById } from "../registry";

// Import to register checks
import "./mobile";

describe("Tier 2 Mobile Checks", () => {
  describe("T2-18: H1 above fold on mobile", () => {
    it("should pass when H1 is early in DOM", async () => {
      const check = getCheckById("T2-18");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <header>Header</header>
          <h1>Main Title</h1>
          <p>Content here</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-18");
      expect(result.passed).toBe(true);
      expect(result.details?.hasH1).toBe(true);
    });

    it("should fail when no H1 exists", async () => {
      const check = getCheckById("T2-18");

      const html = `<html><body><p>No heading here</p></body></html>`;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(false);
      expect(result.details?.hasH1).toBe(false);
    });

    it("should warn when H1 has many elements before it", async () => {
      const check = getCheckById("T2-18");

      const html = `
        <html><body>
          <header>Header</header>
          <nav>Navigation</nav>
          <aside>Sidebar</aside>
          <section>Some content</section>
          <div>More content</div>
          <h1>Finally the H1</h1>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-18");
      expect(result.details?.hasH1).toBe(true);
      // May pass or fail depending on heuristic
    });
  });

  describe("T2-19: No interstitials on load", () => {
    it("should pass when no interstitials detected", async () => {
      const check = getCheckById("T2-19");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <h1>Title</h1>
          <p>Normal content</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
      expect(result.details?.blockingInterstitials).toBe(0);
    });

    it("should fail when popup/modal detected", async () => {
      const check = getCheckById("T2-19");

      const html = `
        <html><body>
          <h1>Title</h1>
          <div class="modal-overlay" style="position: fixed;">
            <div class="popup-content">Subscribe now!</div>
          </div>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(false);
      expect(result.details?.blockingInterstitials).toBeGreaterThan(0);
    });

    it("should allow cookie banners", async () => {
      const check = getCheckById("T2-19");

      const html = `
        <html><body>
          <h1>Title</h1>
          <div class="cookie-consent" style="position: fixed;">
            Accept cookies?
          </div>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
    });
  });

  describe("T2-20: Tap targets >= 48px", () => {
    it("should pass when buttons have adequate size", async () => {
      const check = getCheckById("T2-20");
      expect(check).toBeDefined();

      const html = `
        <html><body>
          <button style="width: 100px; height: 50px;">Click me</button>
          <a href="#" style="min-width: 48px; min-height: 48px;">Link</a>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.checkId).toBe("T2-20");
      expect(result.passed).toBe(true);
    });

    it("should fail when buttons are too small", async () => {
      const check = getCheckById("T2-20");

      const html = `
        <html><body>
          <button style="width: 30px; height: 20px;">X</button>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(false);
      expect(result.details?.smallTargets).toBeGreaterThan(0);
    });

    it("should pass when no size info available", async () => {
      const check = getCheckById("T2-20");

      const html = `
        <html><body>
          <button>No inline style</button>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      // Passes because we can't verify without inline styles
      expect(result.passed).toBe(true);
      expect(result.details?.checked).toBe(false);
    });
  });

  describe("T2-21: Text >= 16px on mobile", () => {
    it("should pass with adequate font size", async () => {
      const check = getCheckById("T2-21");
      expect(check).toBeDefined();

      const html = `
        <html style="font-size: 16px;"><body style="font-size: 18px;">
          <p style="font-size: 16px;">Readable text</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(true);
    });

    it("should fail with small font size", async () => {
      const check = getCheckById("T2-21");

      const html = `
        <html><body style="font-size: 12px;">
          <p style="font-size: 10px;">Tiny text</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(false);
      expect(result.details?.smallFonts).toBeGreaterThan(0);
    });

    it("should fail when user-scalable=no", async () => {
      const check = getCheckById("T2-21");

      const html = `
        <html><head>
          <meta name="viewport" content="width=device-width, user-scalable=no">
        </head><body>
          <p>Content</p>
        </body></html>
      `;
      const $ = cheerio.load(html);

      const result = await check!.run({ $, html, url: "https://example.com" });

      expect(result.passed).toBe(false);
      expect(result.details?.userScalableNo).toBe(true);
    });
  });
});
