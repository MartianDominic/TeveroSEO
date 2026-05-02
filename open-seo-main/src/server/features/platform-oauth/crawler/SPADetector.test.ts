/**
 * SPADetector Tests
 *
 * Tests for SPA framework detection.
 * Per D-18: SPA detection identifies React/Next/Vue/Nuxt indicators.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SPADetector,
  detectSPA,
  needsJsRendering,
  type SPADetectionResult,
  type SPAFramework,
} from "./SPADetector";

describe("SPADetector", () => {
  describe("detect", () => {
    it("returns { isSPA: true, framework: 'react' } for div#root with no content", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>React App</title></head>
<body>
  <div id="root"></div>
  <script src="/static/js/main.js"></script>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("react");
      expect(result.hasContent).toBe(false);
    });

    it("returns { isSPA: true, framework: 'next' } for __NEXT_DATA__ script", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Next.js App</title></head>
<body>
  <div id="__next"></div>
  <script id="__NEXT_DATA__" type="application/json">{"props":{}}</script>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("next");
    });

    it("returns { isSPA: true, framework: 'vue' } for div#app with no content", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Vue App</title></head>
<body>
  <div id="app"></div>
  <script src="/js/app.js"></script>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("vue");
      expect(result.hasContent).toBe(false);
    });

    it("returns { isSPA: true, framework: 'nuxt' } for __NUXT__ window variable", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Nuxt App</title></head>
<body>
  <div id="__nuxt"></div>
  <script>window.__NUXT__={data:{}}</script>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("nuxt");
    });

    it("returns { isSPA: false } for static HTML with content", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Static Page</title></head>
<body>
  <h1>Welcome to Our Website</h1>
  <article>
    <p>This is a fully rendered static page with lots of content that was
    generated on the server side. It contains meaningful text, images, and
    other HTML elements that don't require JavaScript to be displayed.</p>
    <p>Another paragraph with more content to show this is real content.</p>
  </article>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(false);
      expect(result.hasContent).toBe(true);
    });

    it("detects Angular ng-app attribute", () => {
      const html = `<!DOCTYPE html>
<html ng-app="myApp">
<head><title>Angular App</title></head>
<body>
  <div ng-controller="MainCtrl"></div>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("angular");
    });

    it("detects Angular ng-version attribute", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Angular App</title></head>
<body>
  <app-root ng-version="17.0.0"></app-root>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("angular");
    });

    it("detects data-reactroot attribute", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>React App</title></head>
<body>
  <div data-reactroot=""></div>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.isSPA).toBe(true);
      expect(result.framework).toBe("react");
    });

    it("returns indicators array with matched patterns", () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Next.js App</title></head>
<body>
  <div id="__next"></div>
  <script id="__NEXT_DATA__">{"props":{}}</script>
</body>
</html>`;

      const result = SPADetector.detect(html);

      expect(result.indicators.length).toBeGreaterThan(0);
      expect(result.indicators).toContain("__NEXT_DATA__");
    });
  });

  describe("needsJsRendering", () => {
    it("returns true only when SPA detected AND no meaningful content", () => {
      // SPA with no content - needs JS
      const emptySpa = `<!DOCTYPE html>
<html>
<head><title>React App</title></head>
<body>
  <div id="root"></div>
</body>
</html>`;

      expect(needsJsRendering(emptySpa)).toBe(true);
    });

    it("returns false for SPA with SSR content", () => {
      // Next.js with SSR content - doesn't need JS rendering
      const ssrSpa = `<!DOCTYPE html>
<html>
<head><title>Next.js SSR</title></head>
<body>
  <div id="__next">
    <h1>Server Side Rendered Content</h1>
    <article>
      <p>This content was rendered on the server with meaningful text that
      spans multiple sentences and provides real value to the reader.</p>
    </article>
  </div>
  <script id="__NEXT_DATA__">{"props":{}}</script>
</body>
</html>`;

      expect(needsJsRendering(ssrSpa)).toBe(false);
    });

    it("returns false for static HTML", () => {
      const staticHtml = `<!DOCTYPE html>
<html>
<head><title>Static</title></head>
<body>
  <h1>Welcome</h1>
  <p>This is static content with enough text to be considered meaningful.</p>
</body>
</html>`;

      expect(needsJsRendering(staticHtml)).toBe(false);
    });
  });

  describe("checkUrl", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.resetAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("fetches URL and checks for JS rendering need", async () => {
      const spaHtml = `<!DOCTYPE html>
<html>
<head><title>SPA</title></head>
<body><div id="root"></div></body>
</html>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(spaHtml),
      });

      const result = await SPADetector.checkUrl("https://example.com");

      expect(result.needsJs).toBe(true);
      expect(result.detection.isSPA).toBe(true);
    });

    it("returns needsJs: false for static content", async () => {
      const staticHtml = `<!DOCTYPE html>
<html>
<head><title>Static</title></head>
<body>
  <h1>Content</h1>
  <article>Real content here with meaningful text.</article>
</body>
</html>`;

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(staticHtml),
      });

      const result = await SPADetector.checkUrl("https://example.com");

      expect(result.needsJs).toBe(false);
    });

    it("returns needsJs: false on fetch error", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      const result = await SPADetector.checkUrl("https://example.com");

      expect(result.needsJs).toBe(false);
    });
  });

  describe("convenience functions", () => {
    it("detectSPA is alias for SPADetector.detect", () => {
      const html = `<div id="root"></div>`;
      const result1 = detectSPA(html);
      const result2 = SPADetector.detect(html);

      expect(result1.isSPA).toBe(result2.isSPA);
      expect(result1.framework).toBe(result2.framework);
    });

    it("needsJsRendering works as standalone function", () => {
      const html = `<div id="root"></div>`;
      expect(typeof needsJsRendering(html)).toBe("boolean");
    });
  });
});
