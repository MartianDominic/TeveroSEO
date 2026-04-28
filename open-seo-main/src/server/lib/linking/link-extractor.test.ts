import { describe, it, expect } from "vitest";
import {
  extractDetailedLinks,
  classifyLinkPosition,
  getParagraphIndex,
  extractContext,
} from "./link-extractor";
import type { UrlToPageMap } from "./types";

describe("link-extractor", () => {
  const siteOrigin = "https://example.com";
  const pageUrl = "https://example.com/page1";

  describe("extractDetailedLinks", () => {
    it("extracts all internal links from HTML", () => {
      const html = `
        <html>
          <body>
            <p>Check out our <a href="/about">about page</a> for more info.</p>
            <p>Also see our <a href="/contact">contact page</a>.</p>
          </body>
        </html>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links).toHaveLength(2);
      expect(result.links[0].targetUrl).toBe("https://example.com/about");
      expect(result.links[0].anchorText).toBe("about page");
      expect(result.links[1].targetUrl).toBe("https://example.com/contact");
      expect(result.links[1].anchorText).toBe("contact page");
    });

    it("resolves relative URLs correctly", () => {
      const html = `
        <body>
          <a href="/page2">Absolute path</a>
          <a href="page3">Relative path</a>
          <a href="../page4">Parent path</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links).toHaveLength(3);
      expect(result.links[0].targetUrl).toBe("https://example.com/page2");
      expect(result.links[1].targetUrl).toBe("https://example.com/page3");
      expect(result.links[2].targetUrl).toBe("https://example.com/page4");
    });

    it("filters out external links", () => {
      const html = `
        <body>
          <a href="https://example.com/internal">Internal</a>
          <a href="https://other.com/external">External</a>
          <a href="http://another.org/external">Another external</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links).toHaveLength(1);
      expect(result.links[0].targetUrl).toBe("https://example.com/internal");
      expect(result.externalLinksSkipped).toBe(2);
    });

    it("filters out javascript, mailto, tel, and hash-only links", () => {
      const html = `
        <body>
          <a href="javascript:void(0)">JS link</a>
          <a href="mailto:test@example.com">Email</a>
          <a href="tel:+1234567890">Phone</a>
          <a href="#">Hash only</a>
          <a href="#section">Section hash</a>
          <a href="/valid">Valid</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links).toHaveLength(1);
      expect(result.links[0].targetUrl).toBe("https://example.com/valid");
      expect(result.invalidLinksSkipped).toBe(5);
    });

    it("detects rel=nofollow links", () => {
      const html = `
        <body>
          <a href="/page1">Dofollow</a>
          <a href="/page2" rel="nofollow">Nofollow</a>
          <a href="/page3" rel="nofollow noopener">Nofollow + Noopener</a>
          <a href="/page4" rel="ugc nofollow">UGC Nofollow</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].isDoFollow).toBe(true);
      expect(result.links[1].isDoFollow).toBe(false);
      expect(result.links[2].isDoFollow).toBe(false);
      expect(result.links[3].isDoFollow).toBe(false);
    });

    it("detects rel=noopener attribute", () => {
      const html = `
        <body>
          <a href="/page1">Normal</a>
          <a href="/page2" rel="noopener">With noopener</a>
          <a href="/page3" rel="noopener noreferrer">With both</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].hasNoOpener).toBe(false);
      expect(result.links[1].hasNoOpener).toBe(true);
      expect(result.links[2].hasNoOpener).toBe(true);
    });

    it("detects title attribute", () => {
      const html = `
        <body>
          <a href="/page1">No title</a>
          <a href="/page2" title="Page 2 Title">With title</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].hasTitle).toBe(false);
      expect(result.links[1].hasTitle).toBe(true);
    });

    it("maps target URLs to page IDs when available", () => {
      const html = `
        <body>
          <a href="/known">Known page</a>
          <a href="/unknown">Unknown page</a>
        </body>
      `;

      const urlToPageMap: UrlToPageMap = new Map([
        ["https://example.com/known", "page-123"],
      ]);

      const result = extractDetailedLinks({
        html,
        pageUrl,
        siteOrigin,
        urlToPageMap,
      });

      expect(result.links[0].targetPageId).toBe("page-123");
      expect(result.links[1].targetPageId).toBeNull();
    });

    it("extracts context around link (~50 chars)", () => {
      const html = `
        <body>
          <p>This is some text before the link. Check out <a href="/page">our amazing product page</a> for more details about our offerings.</p>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].context).toBeDefined();
      // Context should be roughly 100 chars (50 before + anchor + 50 after), allow some buffer
      expect(result.links[0].context.length).toBeLessThanOrEqual(150);
      expect(result.links[0].context).toContain("Check out");
    });

    it("classifies image links as image type", () => {
      const html = `
        <body>
          <a href="/page"><img src="/image.jpg" alt="Product"></a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].linkType).toBe("image");
    });

    it("handles empty anchor text gracefully", () => {
      const html = `
        <body>
          <a href="/page"></a>
          <a href="/page2">   </a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].anchorText).toBe("");
      expect(result.links[1].anchorText).toBe("");
    });

    it("strips trailing slashes for URL normalization", () => {
      const html = `
        <body>
          <a href="/page/">With slash</a>
          <a href="/page">Without slash</a>
        </body>
      `;

      const result = extractDetailedLinks({ html, pageUrl, siteOrigin });

      expect(result.links[0].targetUrl).toBe("https://example.com/page");
      expect(result.links[1].targetUrl).toBe("https://example.com/page");
    });
  });

  describe("classifyLinkPosition", () => {
    it("identifies nav links", () => {
      const html = `
        <nav>
          <a href="/home" id="test-link">Home</a>
        </nav>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("nav");
    });

    it("identifies header links", () => {
      const html = `
        <header>
          <a href="/home" id="test-link">Home</a>
        </header>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("header");
    });

    it("identifies footer links", () => {
      const html = `
        <footer>
          <a href="/privacy" id="test-link">Privacy</a>
        </footer>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("footer");
    });

    it("identifies sidebar links", () => {
      const html = `
        <aside class="sidebar">
          <a href="/related" id="test-link">Related</a>
        </aside>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("sidebar");
    });

    it("identifies body links in main content", () => {
      const html = `
        <main>
          <article>
            <p>Read more in our <a href="/guide" id="test-link">guide</a>.</p>
          </article>
        </main>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("body");
    });

    it("identifies nav by class name", () => {
      const html = `
        <div class="navigation">
          <a href="/home" id="test-link">Home</a>
        </div>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("nav");
    });

    it("identifies sidebar by widget class", () => {
      const html = `
        <div class="widget-area">
          <a href="/related" id="test-link">Related</a>
        </div>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("sidebar");
    });

    it("defaults to body for ambiguous positions", () => {
      const html = `
        <div>
          <a href="/page" id="test-link">Page</a>
        </div>
      `;

      const position = classifyLinkPosition(html, "#test-link");

      expect(position).toBe("body");
    });
  });

  describe("getParagraphIndex", () => {
    it("returns correct paragraph index for first paragraph", () => {
      const html = `
        <article>
          <p>First paragraph with <a href="/link1" id="test-link">link</a>.</p>
          <p>Second paragraph.</p>
        </article>
      `;

      const index = getParagraphIndex(html, "#test-link");

      expect(index).toBe(1);
    });

    it("returns correct paragraph index for second paragraph", () => {
      const html = `
        <article>
          <p>First paragraph.</p>
          <p>Second paragraph with <a href="/link" id="test-link">link</a>.</p>
        </article>
      `;

      const index = getParagraphIndex(html, "#test-link");

      expect(index).toBe(2);
    });

    it("returns null for links not in a paragraph", () => {
      const html = `
        <nav>
          <a href="/home" id="test-link">Home</a>
        </nav>
      `;

      const index = getParagraphIndex(html, "#test-link");

      expect(index).toBeNull();
    });

    it("counts paragraphs only within main content", () => {
      const html = `
        <header><p>Header paragraph.</p></header>
        <main>
          <p>First main paragraph.</p>
          <p>Second main paragraph with <a href="/link" id="test-link">link</a>.</p>
        </main>
      `;

      const index = getParagraphIndex(html, "#test-link");

      expect(index).toBe(2);
    });
  });

  describe("extractContext", () => {
    it("extracts surrounding text", () => {
      const html = `
        <p>This is some text before the link. Check out <a href="/page" id="test-link">our product</a> for more details about our offerings.</p>
      `;

      const context = extractContext(html, "#test-link");

      expect(context).toContain("Check out");
      expect(context).toContain("for more");
    });

    it("handles link at start of text", () => {
      const html = `
        <p><a href="/page" id="test-link">Our product</a> is the best on the market.</p>
      `;

      const context = extractContext(html, "#test-link");

      expect(context).toContain("is the best");
    });

    it("handles link at end of text", () => {
      const html = `
        <p>Check out our <a href="/page" id="test-link">product page</a></p>
      `;

      const context = extractContext(html, "#test-link");

      expect(context).toContain("Check out");
    });

    it("limits context to ~50 chars before and after", () => {
      const longText = "a".repeat(100);
      const html = `
        <p>${longText}<a href="/page" id="test-link">link</a>${longText}</p>
      `;

      const context = extractContext(html, "#test-link");

      // Should be roughly 100 chars total (50 before + 50 after)
      expect(context.length).toBeLessThanOrEqual(110);
    });
  });
});
