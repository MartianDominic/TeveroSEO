/**
 * TTL Strategy Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect } from "vitest";
import {
  TTL_BY_CONTENT_TYPE,
  TTL_LEVEL_MULTIPLIERS,
  detectContentType,
  getTtl,
  getTtlForUrl,
  calculateExpiresAt,
  isExpired,
  getRemainingTtl,
  formatTtl,
  getTtlPolicy,
  validateTtl,
  clampTtl,
  getFreshness,
  shouldProactivelyRefresh,
} from "../ttlStrategy";

// =============================================================================
// Constants Tests
// =============================================================================

describe("TTL Constants", () => {
  describe("TTL_BY_CONTENT_TYPE", () => {
    it("should define TTL for all content types", () => {
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("corporate");
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("blog_post");
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("product");
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("category");
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("homepage");
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("dynamic");
      expect(TTL_BY_CONTENT_TYPE).toHaveProperty("generic");
    });

    it("should have corporate as longest TTL", () => {
      expect(TTL_BY_CONTENT_TYPE.corporate).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should have dynamic as shortest TTL", () => {
      expect(TTL_BY_CONTENT_TYPE.dynamic).toBe(1 * 60 * 60 * 1000);
    });
  });

  describe("TTL_LEVEL_MULTIPLIERS", () => {
    it("should define multipliers for all levels", () => {
      expect(TTL_LEVEL_MULTIPLIERS).toHaveProperty("L1");
      expect(TTL_LEVEL_MULTIPLIERS).toHaveProperty("L2");
      expect(TTL_LEVEL_MULTIPLIERS).toHaveProperty("L3");
      expect(TTL_LEVEL_MULTIPLIERS).toHaveProperty("L4");
    });

    it("should have L1 as smallest multiplier", () => {
      expect(TTL_LEVEL_MULTIPLIERS.L1).toBe(0.1);
    });

    it("should have L4 as largest multiplier", () => {
      expect(TTL_LEVEL_MULTIPLIERS.L4).toBe(3.0);
    });

    it("should have L3 as baseline (1.0)", () => {
      expect(TTL_LEVEL_MULTIPLIERS.L3).toBe(1.0);
    });
  });
});

// =============================================================================
// Content Type Detection Tests
// =============================================================================

describe("detectContentType", () => {
  describe("homepage detection", () => {
    it("should detect root path as homepage", () => {
      expect(detectContentType("https://example.com/")).toBe("homepage");
    });

    it("should detect empty path as homepage", () => {
      expect(detectContentType("https://example.com")).toBe("homepage");
    });

    it("should detect index.html as homepage", () => {
      expect(detectContentType("https://example.com/index.html")).toBe("homepage");
    });
  });

  describe("blog post detection", () => {
    it("should detect /blog/ path", () => {
      expect(detectContentType("https://example.com/blog/my-post")).toBe("blog_post");
    });

    it("should detect /article/ path", () => {
      expect(detectContentType("https://example.com/article/123")).toBe("blog_post");
    });

    it("should detect /news/ path", () => {
      expect(detectContentType("https://example.com/news/breaking")).toBe("blog_post");
    });

    it("should detect date-based URL pattern", () => {
      expect(detectContentType("https://example.com/2026/05/article-slug")).toBe("blog_post");
    });
  });

  describe("product detection", () => {
    it("should detect /product/ path", () => {
      expect(detectContentType("https://example.com/product/shoes-123")).toBe("product");
    });

    it("should detect /item/ path", () => {
      expect(detectContentType("https://example.com/item/abc")).toBe("product");
    });

    it("should detect Amazon-style /dp/ path", () => {
      expect(detectContentType("https://amazon.com/dp/B08N5WRWNW")).toBe("product");
    });
  });

  describe("category detection", () => {
    it("should detect /category/ path", () => {
      expect(detectContentType("https://example.com/category/electronics")).toBe("category");
    });

    it("should detect /shop/ path", () => {
      expect(detectContentType("https://example.com/shop/clothing")).toBe("category");
    });

    it("should detect /products listing page", () => {
      expect(detectContentType("https://example.com/products/")).toBe("category");
    });
  });

  describe("corporate detection", () => {
    it("should detect /about path", () => {
      expect(detectContentType("https://example.com/about")).toBe("corporate");
    });

    it("should detect /contact path", () => {
      expect(detectContentType("https://example.com/contact")).toBe("corporate");
    });

    it("should detect /terms path", () => {
      expect(detectContentType("https://example.com/terms")).toBe("corporate");
    });

    it("should detect /privacy path", () => {
      expect(detectContentType("https://example.com/privacy")).toBe("corporate");
    });
  });

  describe("dynamic detection", () => {
    it("should detect /search path", () => {
      expect(detectContentType("https://example.com/search")).toBe("dynamic");
    });

    it("should detect ?q= parameter", () => {
      expect(detectContentType("https://example.com/?q=test")).toBe("dynamic");
    });

    it("should detect ?search= parameter", () => {
      expect(detectContentType("https://example.com/?search=query")).toBe("dynamic");
    });
  });

  describe("schema.org detection", () => {
    it("should detect Product schema", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Product", "name": "Test"}
            </script>
          </head>
        </html>
      `;
      expect(detectContentType("https://example.com/page", html)).toBe("product");
    });

    it("should detect Article schema", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Article", "headline": "Test"}
            </script>
          </head>
        </html>
      `;
      expect(detectContentType("https://example.com/page", html)).toBe("blog_post");
    });

    it("should detect BlogPosting schema", () => {
      const html = `
        <html>
          <head>
            <script type='application/ld+json'>
              {"@type": "BlogPosting", "name": "Test"}
            </script>
          </head>
        </html>
      `;
      expect(detectContentType("https://example.com/page", html)).toBe("blog_post");
    });

    it("should detect Organization schema as corporate", () => {
      const html = `
        <html>
          <head>
            <script type="application/ld+json">
              {"@type": "Organization", "name": "Test Corp"}
            </script>
          </head>
        </html>
      `;
      expect(detectContentType("https://example.com/page", html)).toBe("corporate");
    });
  });

  describe("fallback to generic", () => {
    it("should return generic for unrecognized paths", () => {
      expect(detectContentType("https://example.com/random/path")).toBe("generic");
    });

    it("should return generic for invalid HTML schema", () => {
      const html = `<html><script type="application/ld+json">invalid json</script></html>`;
      expect(detectContentType("https://example.com/page", html)).toBe("generic");
    });
  });
});

// =============================================================================
// TTL Calculation Tests
// =============================================================================

describe("getTtl", () => {
  it("should return correct TTL for L1 blog_post", () => {
    const expected = Math.round(24 * 60 * 60 * 1000 * 0.1); // 2.4 hours
    expect(getTtl("blog_post", "L1")).toBe(expected);
  });

  it("should return correct TTL for L2 blog_post", () => {
    const expected = Math.round(24 * 60 * 60 * 1000 * 0.5); // 12 hours
    expect(getTtl("blog_post", "L2")).toBe(expected);
  });

  it("should return correct TTL for L3 blog_post", () => {
    const expected = 24 * 60 * 60 * 1000; // 24 hours
    expect(getTtl("blog_post", "L3")).toBe(expected);
  });

  it("should return correct TTL for L4 blog_post", () => {
    const expected = Math.round(24 * 60 * 60 * 1000 * 3.0); // 72 hours
    expect(getTtl("blog_post", "L4")).toBe(expected);
  });

  it("should use generic TTL for unknown content type", () => {
    const expected = Math.round(12 * 60 * 60 * 1000 * 1.0);
    expect(getTtl("generic", "L3")).toBe(expected);
  });
});

describe("getTtlForUrl", () => {
  it("should auto-detect content type and calculate TTL", () => {
    const ttl = getTtlForUrl("https://example.com/blog/post", "L3");
    expect(ttl).toBe(TTL_BY_CONTENT_TYPE.blog_post);
  });

  it("should use HTML for better detection", () => {
    const html = `<script type="application/ld+json">{"@type": "Product"}</script>`;
    const ttl = getTtlForUrl("https://example.com/page", "L3", html);
    expect(ttl).toBe(TTL_BY_CONTENT_TYPE.product);
  });
});

// =============================================================================
// Expiration Tests
// =============================================================================

describe("calculateExpiresAt", () => {
  it("should calculate correct expiration date", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const ttl = 60 * 60 * 1000; // 1 hour
    const expires = calculateExpiresAt(ttl, now);

    expect(expires.toISOString()).toBe("2026-05-07T13:00:00.000Z");
  });

  it("should use current time if not specified", () => {
    const ttl = 60 * 60 * 1000;
    const before = Date.now();
    const expires = calculateExpiresAt(ttl);
    const after = Date.now();

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + ttl);
    expect(expires.getTime()).toBeLessThanOrEqual(after + ttl);
  });
});

describe("isExpired", () => {
  it("should return true for past date", () => {
    const past = new Date(Date.now() - 1000);
    expect(isExpired(past)).toBe(true);
  });

  it("should return false for future date", () => {
    const future = new Date(Date.now() + 1000);
    expect(isExpired(future)).toBe(false);
  });

  it("should use custom now parameter", () => {
    const expiresAt = new Date("2026-05-07T12:00:00Z");
    const now = new Date("2026-05-07T11:00:00Z");
    expect(isExpired(expiresAt, now)).toBe(false);
  });
});

describe("getRemainingTtl", () => {
  it("should return remaining time for future expiration", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const expiresAt = new Date("2026-05-07T13:00:00Z");
    expect(getRemainingTtl(expiresAt, now)).toBe(60 * 60 * 1000);
  });

  it("should return 0 for past expiration", () => {
    const now = new Date("2026-05-07T14:00:00Z");
    const expiresAt = new Date("2026-05-07T13:00:00Z");
    expect(getRemainingTtl(expiresAt, now)).toBe(0);
  });
});

// =============================================================================
// TTL Formatting Tests
// =============================================================================

describe("formatTtl", () => {
  it("should format days and hours", () => {
    const ttl = 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000; // 2d 3h
    expect(formatTtl(ttl)).toBe("2d 3h");
  });

  it("should format hours and minutes", () => {
    const ttl = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // 5h 30m
    expect(formatTtl(ttl)).toBe("5h 30m");
  });

  it("should format minutes only", () => {
    const ttl = 45 * 60 * 1000; // 45m
    expect(formatTtl(ttl)).toBe("45m");
  });

  it("should format seconds for short TTL", () => {
    const ttl = 30 * 1000; // 30s
    expect(formatTtl(ttl)).toBe("30s");
  });
});

describe("getTtlPolicy", () => {
  it("should return policy for L1", () => {
    const policy = getTtlPolicy("L1");

    expect(policy).toHaveProperty("corporate");
    expect(policy).toHaveProperty("blog_post");
    expect(policy).toHaveProperty("product");
  });

  it("should show shorter times for L1 than L3", () => {
    const l1Policy = getTtlPolicy("L1");
    const l3Policy = getTtlPolicy("L3");

    // L1 should be 10% of L3, so times should be shorter
    // corporate L3 is 7d, L1 should be ~16-17h
    expect(l1Policy.corporate).not.toBe(l3Policy.corporate);
  });
});

// =============================================================================
// TTL Validation Tests
// =============================================================================

describe("validateTtl", () => {
  it("should return true for valid TTL", () => {
    expect(validateTtl(60 * 60 * 1000)).toBe(true); // 1 hour
  });

  it("should return false for TTL under 1 minute", () => {
    expect(validateTtl(30 * 1000)).toBe(false);
  });

  it("should return false for TTL over 1 year", () => {
    expect(validateTtl(366 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("clampTtl", () => {
  it("should clamp low TTL to minimum", () => {
    expect(clampTtl(1000)).toBe(60 * 1000); // Min 1 minute
  });

  it("should clamp high TTL to maximum", () => {
    const maxTtl = 365 * 24 * 60 * 60 * 1000;
    expect(clampTtl(maxTtl + 1000)).toBe(maxTtl);
  });

  it("should not modify valid TTL", () => {
    const ttl = 12 * 60 * 60 * 1000;
    expect(clampTtl(ttl)).toBe(ttl);
  });
});

// =============================================================================
// Freshness Tests
// =============================================================================

describe("getFreshness", () => {
  it("should return 100 for just cached content", () => {
    const fetchedAt = new Date();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    expect(getFreshness(fetchedAt, expiresAt)).toBe(100);
  });

  it("should return 0 for expired content", () => {
    const fetchedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000);
    expect(getFreshness(fetchedAt, expiresAt)).toBe(0);
  });

  it("should return 50 for half-expired content", () => {
    const fetchedAt = new Date(Date.now() - 30 * 60 * 1000);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    expect(getFreshness(fetchedAt, expiresAt)).toBe(50);
  });
});

describe("shouldProactivelyRefresh", () => {
  it("should return true when less than 20% fresh", () => {
    const fetchedAt = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min left
    // 10/(10+90) = 10% remaining
    expect(shouldProactivelyRefresh(fetchedAt, expiresAt)).toBe(true);
  });

  it("should return false when more than 20% fresh", () => {
    const fetchedAt = new Date(Date.now() - 30 * 60 * 1000);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    // 50% remaining
    expect(shouldProactivelyRefresh(fetchedAt, expiresAt)).toBe(false);
  });

  it("should use custom threshold", () => {
    const fetchedAt = new Date(Date.now() - 70 * 60 * 1000);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    // 30% remaining, threshold 25%
    expect(shouldProactivelyRefresh(fetchedAt, expiresAt, 25)).toBe(false);
    expect(shouldProactivelyRefresh(fetchedAt, expiresAt, 35)).toBe(true);
  });
});
