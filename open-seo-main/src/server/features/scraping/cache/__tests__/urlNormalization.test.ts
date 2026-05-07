/**
 * URL Normalization & Cache Key Generation Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  normalizeUrlSafe,
  getCacheKey,
  getContentHash,
  getQuickHash,
  extractDomain,
  urlsMatch,
  isValidUrl,
  getPathSegments,
  isHomepage,
} from "../urlNormalization";

// =============================================================================
// normalizeUrl Tests
// =============================================================================

describe("normalizeUrl", () => {
  describe("basic normalization", () => {
    it("should lowercase hostname", () => {
      expect(normalizeUrl("https://EXAMPLE.COM/page")).toBe(
        "https://example.com/page"
      );
    });

    it("should add https if protocol missing", () => {
      expect(normalizeUrl("example.com/page")).toBe(
        "https://example.com/page"
      );
    });

    it("should preserve existing http protocol", () => {
      expect(normalizeUrl("http://example.com/page")).toBe(
        "http://example.com/page"
      );
    });

    it("should remove default https port 443", () => {
      expect(normalizeUrl("https://example.com:443/page")).toBe(
        "https://example.com/page"
      );
    });

    it("should remove default http port 80", () => {
      expect(normalizeUrl("http://example.com:80/page")).toBe(
        "http://example.com/page"
      );
    });

    it("should preserve non-default ports", () => {
      expect(normalizeUrl("https://example.com:8080/page")).toBe(
        "https://example.com:8080/page"
      );
    });
  });

  describe("path normalization", () => {
    it("should remove trailing slash from path", () => {
      expect(normalizeUrl("https://example.com/page/")).toBe(
        "https://example.com/page"
      );
    });

    it("should keep trailing slash for root path", () => {
      expect(normalizeUrl("https://example.com/")).toBe(
        "https://example.com/"
      );
    });

    it("should add root path if missing", () => {
      expect(normalizeUrl("https://example.com")).toBe(
        "https://example.com/"
      );
    });

    it("should handle empty path", () => {
      expect(normalizeUrl("https://example.com")).toBe(
        "https://example.com/"
      );
    });

    it("should preserve path case", () => {
      expect(normalizeUrl("https://example.com/PageName")).toBe(
        "https://example.com/PageName"
      );
    });
  });

  describe("tracking parameter removal", () => {
    it("should remove utm_source", () => {
      expect(normalizeUrl("https://example.com/page?utm_source=google")).toBe(
        "https://example.com/page"
      );
    });

    it("should remove utm_medium", () => {
      expect(normalizeUrl("https://example.com/page?utm_medium=cpc")).toBe(
        "https://example.com/page"
      );
    });

    it("should remove utm_campaign", () => {
      expect(normalizeUrl("https://example.com/page?utm_campaign=sale")).toBe(
        "https://example.com/page"
      );
    });

    it("should remove all utm parameters", () => {
      const url =
        "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=sale&utm_term=test&utm_content=ad1";
      expect(normalizeUrl(url)).toBe("https://example.com/page");
    });

    it("should remove fbclid", () => {
      expect(
        normalizeUrl("https://example.com/page?fbclid=abc123")
      ).toBe("https://example.com/page");
    });

    it("should remove gclid", () => {
      expect(
        normalizeUrl("https://example.com/page?gclid=xyz789")
      ).toBe("https://example.com/page");
    });

    it("should remove msclkid", () => {
      expect(
        normalizeUrl("https://example.com/page?msclkid=abc")
      ).toBe("https://example.com/page");
    });

    it("should remove _ga parameter", () => {
      expect(
        normalizeUrl("https://example.com/page?_ga=2.123.456")
      ).toBe("https://example.com/page");
    });

    it("should preserve non-tracking parameters", () => {
      expect(
        normalizeUrl("https://example.com/page?category=shoes&color=red")
      ).toBe("https://example.com/page?category=shoes&color=red");
    });

    it("should remove tracking but keep content parameters", () => {
      expect(
        normalizeUrl(
          "https://example.com/page?category=shoes&utm_source=google&color=red"
        )
      ).toBe("https://example.com/page?category=shoes&color=red");
    });
  });

  describe("parameter sorting", () => {
    it("should sort parameters alphabetically", () => {
      expect(
        normalizeUrl("https://example.com/page?z=1&a=2&m=3")
      ).toBe("https://example.com/page?a=2&m=3&z=1");
    });

    it("should maintain sort after tracking removal", () => {
      expect(
        normalizeUrl("https://example.com/page?z=1&utm_source=x&a=2")
      ).toBe("https://example.com/page?a=2&z=1");
    });
  });

  describe("fragment removal", () => {
    it("should remove fragment", () => {
      expect(normalizeUrl("https://example.com/page#section")).toBe(
        "https://example.com/page"
      );
    });

    it("should remove fragment with parameters", () => {
      expect(
        normalizeUrl("https://example.com/page?id=1#section")
      ).toBe("https://example.com/page?id=1");
    });
  });

  describe("error handling", () => {
    it("should throw for relative URL", () => {
      expect(() => normalizeUrl("/page")).toThrow(
        "Cannot normalize relative URL without base"
      );
    });

    it("should throw for invalid URL", () => {
      expect(() => normalizeUrl("not a url at all :::")).toThrow();
    });
  });
});

describe("normalizeUrlSafe", () => {
  it("should return normalized URL for valid input", () => {
    expect(normalizeUrlSafe("https://example.com/page")).toBe(
      "https://example.com/page"
    );
  });

  it("should return null for invalid input", () => {
    expect(normalizeUrlSafe("/relative")).toBeNull();
  });

  it("should return null for malformed URL", () => {
    expect(normalizeUrlSafe(":::invalid:::")).toBeNull();
  });
});

// =============================================================================
// Cache Key Generation Tests
// =============================================================================

describe("getCacheKey", () => {
  it("should return 16-character hash", () => {
    const key = getCacheKey("https://example.com/page");
    expect(key).toHaveLength(16);
  });

  it("should return hexadecimal characters only", () => {
    const key = getCacheKey("https://example.com/page");
    expect(key).toMatch(/^[a-f0-9]+$/);
  });

  it("should return same hash for same URL", () => {
    const key1 = getCacheKey("https://example.com/page");
    const key2 = getCacheKey("https://example.com/page");
    expect(key1).toBe(key2);
  });

  it("should return different hash for different URL", () => {
    const key1 = getCacheKey("https://example.com/page1");
    const key2 = getCacheKey("https://example.com/page2");
    expect(key1).not.toBe(key2);
  });

  it("should produce consistent results", () => {
    // Specific known value test for consistency
    const key = getCacheKey("https://example.com/");
    expect(key).toMatch(/^[a-f0-9]{16}$/);
    // Same input always produces same output
    expect(getCacheKey("https://example.com/")).toBe(key);
  });
});

describe("getContentHash", () => {
  it("should return 32-character hash", () => {
    const hash = getContentHash("<html><body>Test</body></html>");
    expect(hash).toHaveLength(32);
  });

  it("should return hexadecimal characters only", () => {
    const hash = getContentHash("<html><body>Test</body></html>");
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("should return same hash for same content", () => {
    const content = "<html><body>Test Content</body></html>";
    const hash1 = getContentHash(content);
    const hash2 = getContentHash(content);
    expect(hash1).toBe(hash2);
  });

  it("should return different hash for different content", () => {
    const hash1 = getContentHash("<html><body>Content 1</body></html>");
    const hash2 = getContentHash("<html><body>Content 2</body></html>");
    expect(hash1).not.toBe(hash2);
  });

  it("should detect even small changes", () => {
    const hash1 = getContentHash("<html><body>Test</body></html>");
    const hash2 = getContentHash("<html><body>test</body></html>"); // lowercase t
    expect(hash1).not.toBe(hash2);
  });
});

describe("getQuickHash", () => {
  it("should return 8-character hash", () => {
    const hash = getQuickHash("some content");
    expect(hash).toHaveLength(8);
  });

  it("should return hexadecimal characters only", () => {
    const hash = getQuickHash("some content");
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("should be deterministic", () => {
    expect(getQuickHash("test")).toBe(getQuickHash("test"));
  });
});

// =============================================================================
// URL Utility Tests
// =============================================================================

describe("extractDomain", () => {
  it("should extract domain from HTTPS URL", () => {
    expect(extractDomain("https://example.com/page")).toBe("example.com");
  });

  it("should extract domain from HTTP URL", () => {
    expect(extractDomain("http://example.com/page")).toBe("example.com");
  });

  it("should extract domain with subdomain", () => {
    expect(extractDomain("https://www.example.com/page")).toBe(
      "www.example.com"
    );
  });

  it("should lowercase domain", () => {
    expect(extractDomain("https://EXAMPLE.COM/page")).toBe("example.com");
  });

  it("should return null for invalid URL", () => {
    expect(extractDomain("not a url")).toBeNull();
  });
});

describe("urlsMatch", () => {
  it("should return true for identical URLs", () => {
    expect(
      urlsMatch("https://example.com/page", "https://example.com/page")
    ).toBe(true);
  });

  it("should return true for URLs that normalize the same", () => {
    expect(
      urlsMatch(
        "https://EXAMPLE.COM/page/",
        "https://example.com/page"
      )
    ).toBe(true);
  });

  it("should return true when only tracking params differ", () => {
    expect(
      urlsMatch(
        "https://example.com/page?utm_source=google",
        "https://example.com/page"
      )
    ).toBe(true);
  });

  it("should return false for different pages", () => {
    expect(
      urlsMatch("https://example.com/page1", "https://example.com/page2")
    ).toBe(false);
  });

  it("should return false for different domains", () => {
    expect(
      urlsMatch("https://example1.com/page", "https://example2.com/page")
    ).toBe(false);
  });

  it("should return false for invalid URLs", () => {
    expect(urlsMatch("not a url", "https://example.com")).toBe(false);
  });
});

describe("isValidUrl", () => {
  it("should return true for HTTPS URL", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });

  it("should return true for HTTP URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("should return true for URL without protocol", () => {
    expect(isValidUrl("example.com")).toBe(true);
  });

  it("should return true for URL with path", () => {
    expect(isValidUrl("https://example.com/path/to/page")).toBe(true);
  });

  it("should return false for invalid URL", () => {
    expect(isValidUrl("not a url at all")).toBe(false);
  });

  it("should return false for javascript protocol", () => {
    // javascript: URLs are not allowed
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("getPathSegments", () => {
  it("should return segments for path", () => {
    expect(getPathSegments("https://example.com/a/b/c")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("should return empty array for root", () => {
    expect(getPathSegments("https://example.com/")).toEqual([]);
  });

  it("should handle trailing slash", () => {
    expect(getPathSegments("https://example.com/a/b/")).toEqual(["a", "b"]);
  });

  it("should return empty array for invalid URL", () => {
    expect(getPathSegments("not a url")).toEqual([]);
  });
});

describe("isHomepage", () => {
  it("should return true for root path", () => {
    expect(isHomepage("https://example.com/")).toBe(true);
  });

  it("should return true for root without slash", () => {
    expect(isHomepage("https://example.com")).toBe(true);
  });

  it("should return false for path", () => {
    expect(isHomepage("https://example.com/page")).toBe(false);
  });

  it("should return false for root with query params", () => {
    expect(isHomepage("https://example.com/?id=1")).toBe(false);
  });

  it("should return true when only tracking params present", () => {
    // After normalization, tracking params are removed
    expect(isHomepage("https://example.com/?utm_source=google")).toBe(true);
  });

  it("should return false for invalid URL", () => {
    expect(isHomepage("not a url")).toBe(false);
  });
});
