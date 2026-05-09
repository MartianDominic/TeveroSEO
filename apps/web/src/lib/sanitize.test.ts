/**
 * Security Tests for HTML Sanitization
 * Phase 57 Security Fix: XSS Prevention (P57-C1)
 *
 * Tests verify that DOMPurify properly sanitizes malicious HTML content.
 */
import { describe, it, expect } from "vitest";

import { sanitizeHtml, sanitizeMinimalHtml, stripHtml } from "./sanitize";

describe("sanitizeHtml - XSS Prevention", () => {
  describe("Script tag removal", () => {
    it("should remove inline script tags", () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("alert");
    });

    it("should remove script tags with src", () => {
      const malicious = '<script src="https://evil.com/xss.js"></script>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("<script");
      expect(result).not.toContain("evil.com");
    });

    it("should remove malformed script tags", () => {
      const malicious = '<scr<script>ipt>alert(1)</script>';
      const result = sanitizeHtml(malicious);
      // Script tags should be removed - text content may remain but is not executable
      expect(result).not.toContain("<script");
      expect(result).not.toContain("</script>");
    });
  });

  describe("Event handler removal", () => {
    it("should remove onerror handlers from img tags", () => {
      const malicious = '<img src="x" onerror="alert(1)">';
      const result = sanitizeHtml(malicious);
      // Event handler should be stripped
      expect(result).not.toContain("onerror");
      // img tag itself is allowed, just stripped of dangerous attributes
      expect(result).toContain("<img");
    });

    it("should remove onload handlers from svg tags", () => {
      const malicious = '<svg onload="alert(1)"></svg>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("onload");
      expect(result).not.toContain("alert");
      // svg is not in allowed tags, so it gets stripped
      expect(result).not.toContain("<svg");
    });

    it("should remove onclick handlers", () => {
      const malicious = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("onclick");
      expect(result).not.toContain("alert");
      expect(result).toContain("Click me");
    });

    it("should remove onmouseover handlers", () => {
      const malicious = '<div onmouseover="alert(1)">Hover</div>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("onmouseover");
      expect(result).not.toContain("alert");
    });

    it("should remove onfocus handlers", () => {
      const malicious = '<input onfocus="alert(1)" autofocus>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("onfocus");
      expect(result).not.toContain("alert");
    });
  });

  describe("JavaScript URL removal", () => {
    it("should remove javascript: URLs in href", () => {
      const malicious = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("javascript:");
      expect(result).toContain("Click");
    });

    it("should remove javascript: URLs with entities", () => {
      const malicious = '<a href="&#106;avascript:alert(1)">Click</a>';
      const result = sanitizeHtml(malicious);
      expect(result).not.toContain("javascript");
      expect(result).not.toContain("alert");
    });

    it("should allow safe URLs", () => {
      const safe = '<a href="https://example.com">Link</a>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('href="https://example.com"');
    });

    it("should allow mailto URLs", () => {
      const safe = '<a href="mailto:test@example.com">Email</a>';
      const result = sanitizeHtml(safe);
      expect(result).toContain("mailto:test@example.com");
    });
  });

  describe("Data attribute removal", () => {
    it("should remove data-* attributes", () => {
      const html = '<div data-payload="malicious">Content</div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("data-payload");
      expect(result).toContain("Content");
    });
  });

  describe("Allowed tags preservation", () => {
    it("should preserve safe formatting tags", () => {
      const safe = "<p><strong>Bold</strong> and <em>italic</em></p>";
      const result = sanitizeHtml(safe);
      expect(result).toBe("<p><strong>Bold</strong> and <em>italic</em></p>");
    });

    it("should preserve headings", () => {
      const safe = "<h1>Title</h1><h2>Subtitle</h2>";
      const result = sanitizeHtml(safe);
      expect(result).toContain("<h1>Title</h1>");
      expect(result).toContain("<h2>Subtitle</h2>");
    });

    it("should preserve lists", () => {
      const safe = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const result = sanitizeHtml(safe);
      expect(result).toBe("<ul><li>Item 1</li><li>Item 2</li></ul>");
    });

    it("should preserve tables", () => {
      const safe = "<table><tr><td>Cell</td></tr></table>";
      const result = sanitizeHtml(safe);
      expect(result).toContain("<table>");
      expect(result).toContain("<td>Cell</td>");
    });

    it("should preserve allowed attributes", () => {
      const safe = '<a href="https://example.com" class="link" title="Example">Link</a>';
      const result = sanitizeHtml(safe);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('class="link"');
      expect(result).toContain('title="Example"');
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("should handle null-ish values", () => {
      expect(sanitizeHtml(null as unknown as string)).toBe("");
      expect(sanitizeHtml(undefined as unknown as string)).toBe("");
    });

    it("should handle plain text", () => {
      const text = "Just plain text without HTML";
      expect(sanitizeHtml(text)).toBe(text);
    });

    it("should handle text with special characters", () => {
      const text = "Price: $100 & 50% off < today";
      const result = sanitizeHtml(text);
      // DOMPurify preserves the text content
      expect(result).toContain("Price:");
      expect(result).toContain("50%");
    });
  });
});

describe("sanitizeMinimalHtml", () => {
  it("should allow basic formatting", () => {
    const html = "<p><strong>Bold</strong> and <em>italic</em></p>";
    const result = sanitizeMinimalHtml(html);
    expect(result).toBe(html);
  });

  it("should remove complex tags not in minimal set", () => {
    const html = "<table><tr><td>Cell</td></tr></table>";
    const result = sanitizeMinimalHtml(html);
    expect(result).not.toContain("<table>");
    expect(result).toContain("Cell");
  });

  it("should remove headings from minimal content", () => {
    const html = "<h1>Title</h1><p>Content</p>";
    const result = sanitizeMinimalHtml(html);
    expect(result).not.toContain("<h1>");
    expect(result).toContain("Title");
    expect(result).toContain("<p>Content</p>");
  });
});

describe("stripHtml", () => {
  it("should remove all HTML tags", () => {
    const html = "<p><strong>Bold</strong> and <em>italic</em></p>";
    const result = stripHtml(html);
    expect(result).toBe("Bold and italic");
  });

  it("should handle nested tags", () => {
    const html = "<div><p><span>Nested</span> content</p></div>";
    const result = stripHtml(html);
    expect(result).toBe("Nested content");
  });

  it("should handle empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});
