/**
 * Cache Invalidation Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect } from "vitest";
import {
  urlChangedEvent,
  domainUpdatedEvent,
  auditStartedEvent,
  forceRefreshEvent,
  ttlExpiredEvent,
  getInvalidationLevels,
  shouldPreserveHistory,
  getCascadeOrder,
  shouldInvalidateLevel,
  getInvalidationKeys,
  getDomainPattern,
  shouldExtendTtlOn304,
  calculateExtendedExpiry,
  shouldServeStale,
  needsRevalidation,
  groupUrlsByDomain,
  filterChangedUrls,
  createInvalidationLog,
} from "../invalidation";

// =============================================================================
// Event Factory Tests
// =============================================================================

describe("Invalidation Event Factories", () => {
  describe("urlChangedEvent", () => {
    it("should create url_changed event", () => {
      const event = urlChangedEvent("https://example.com/page");
      expect(event.type).toBe("url_changed");
      expect(event.url).toBe("https://example.com/page");
    });
  });

  describe("domainUpdatedEvent", () => {
    it("should create domain_updated event", () => {
      const event = domainUpdatedEvent("example.com");
      expect(event.type).toBe("domain_updated");
      expect(event.domain).toBe("example.com");
    });
  });

  describe("auditStartedEvent", () => {
    it("should create audit_started event with URLs", () => {
      const urls = ["https://example.com/page1", "https://example.com/page2"];
      const event = auditStartedEvent("audit-123", urls);

      expect(event.type).toBe("audit_started");
      expect(event.auditId).toBe("audit-123");
      expect(event.urls).toEqual(urls);
    });
  });

  describe("forceRefreshEvent", () => {
    it("should create force_refresh event with reason", () => {
      const event = forceRefreshEvent("https://example.com/page", "User requested refresh");

      expect(event.type).toBe("force_refresh");
      expect(event.url).toBe("https://example.com/page");
      expect(event.reason).toBe("User requested refresh");
    });
  });

  describe("ttlExpiredEvent", () => {
    it("should create ttl_expired event", () => {
      const event = ttlExpiredEvent("https://example.com/page");
      expect(event.type).toBe("ttl_expired");
      expect(event.url).toBe("https://example.com/page");
    });
  });
});

// =============================================================================
// Invalidation Strategy Tests
// =============================================================================

describe("getInvalidationLevels", () => {
  it("should return L1-L3 for url_changed", () => {
    const levels = getInvalidationLevels("url_changed");
    expect(levels).toEqual(["L1", "L2", "L3"]);
    expect(levels).not.toContain("L4");
  });

  it("should return L1-L2 for domain_updated", () => {
    const levels = getInvalidationLevels("domain_updated");
    expect(levels).toEqual(["L1", "L2"]);
  });

  it("should return L1-L2 for force_refresh", () => {
    const levels = getInvalidationLevels("force_refresh");
    expect(levels).toEqual(["L1", "L2"]);
  });

  it("should return empty for audit_started", () => {
    const levels = getInvalidationLevels("audit_started");
    expect(levels).toEqual([]);
  });

  it("should return empty for ttl_expired", () => {
    const levels = getInvalidationLevels("ttl_expired");
    expect(levels).toEqual([]);
  });
});

describe("shouldPreserveHistory", () => {
  it("should not preserve history for url_changed", () => {
    expect(shouldPreserveHistory("url_changed")).toBe(false);
  });

  it("should preserve history for domain_updated", () => {
    expect(shouldPreserveHistory("domain_updated")).toBe(true);
  });

  it("should preserve history for force_refresh", () => {
    expect(shouldPreserveHistory("force_refresh")).toBe(true);
  });
});

// =============================================================================
// Cascade Tests
// =============================================================================

describe("getCascadeOrder", () => {
  it("should cascade L4 to L3, L2, L1", () => {
    expect(getCascadeOrder("L4")).toEqual(["L3", "L2", "L1"]);
  });

  it("should cascade L3 to L2, L1", () => {
    expect(getCascadeOrder("L3")).toEqual(["L2", "L1"]);
  });

  it("should cascade L2 to L1", () => {
    expect(getCascadeOrder("L2")).toEqual(["L1"]);
  });

  it("should return empty for L1", () => {
    expect(getCascadeOrder("L1")).toEqual([]);
  });
});

describe("shouldInvalidateLevel", () => {
  it("should invalidate L1 when source is L3", () => {
    expect(shouldInvalidateLevel("L1", "L3")).toBe(true);
  });

  it("should invalidate L2 when source is L3", () => {
    expect(shouldInvalidateLevel("L2", "L3")).toBe(true);
  });

  it("should not invalidate L3 when source is L2", () => {
    expect(shouldInvalidateLevel("L3", "L2")).toBe(false);
  });

  it("should not invalidate L4 when source is L3", () => {
    expect(shouldInvalidateLevel("L4", "L3")).toBe(false);
  });
});

// =============================================================================
// Key Generation Tests
// =============================================================================

describe("getInvalidationKeys", () => {
  it("should return all key patterns for a URL", () => {
    const keys = getInvalidationKeys("https://example.com/page");

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.some((k) => k.startsWith("html:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("meta:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("etag:"))).toBe(true);
    expect(keys.some((k) => k.startsWith("skip:"))).toBe(true);
  });

  it("should return empty array for invalid URL", () => {
    const keys = getInvalidationKeys("/relative-only");
    expect(keys).toEqual([]);
  });
});

describe("getDomainPattern", () => {
  it("should create pattern for domain", () => {
    const pattern = getDomainPattern("example.com");
    expect(pattern).toBe("*example.com*");
  });
});

// =============================================================================
// Conditional GET Tests
// =============================================================================

describe("shouldExtendTtlOn304", () => {
  it("should return true when close to expiration (less than 1 hour remaining)", () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min left
    expect(shouldExtendTtlOn304(expiresAt)).toBe(true);
  });

  it("should return false when already expired", () => {
    const expiresAt = new Date(Date.now() - 1000);
    expect(shouldExtendTtlOn304(expiresAt)).toBe(false);
  });

  it("should return false when more than 1 hour remaining", () => {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours left
    expect(shouldExtendTtlOn304(expiresAt)).toBe(false);
  });
});

describe("calculateExtendedExpiry", () => {
  it("should extend expiry by 50%", () => {
    const fetchedAt = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const expiresAt = new Date(Date.now()); // expires now
    // Original TTL: 1 hour
    // Extension: 50% = 30 minutes

    const extended = calculateExtendedExpiry(fetchedAt, expiresAt);
    const expectedMinMs = Date.now() + 25 * 60 * 1000; // at least 25 min
    const expectedMaxMs = Date.now() + 35 * 60 * 1000; // at most 35 min

    expect(extended.getTime()).toBeGreaterThan(expectedMinMs);
    expect(extended.getTime()).toBeLessThan(expectedMaxMs);
  });

  it("should use custom extension factor", () => {
    const fetchedAt = new Date(Date.now() - 60 * 60 * 1000);
    const expiresAt = new Date(Date.now());

    const extended = calculateExtendedExpiry(fetchedAt, expiresAt, 1.0);
    // 100% extension = 1 hour from now
    const expectedMs = Date.now() + 60 * 60 * 1000;

    expect(extended.getTime()).toBeGreaterThan(expectedMs - 5000);
    expect(extended.getTime()).toBeLessThan(expectedMs + 5000);
  });
});

// =============================================================================
// Stale-While-Revalidate Tests
// =============================================================================

describe("shouldServeStale", () => {
  it("should return false when not expired", () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const fetchedAt = new Date(Date.now() - 30 * 60 * 1000);

    expect(shouldServeStale(expiresAt, fetchedAt)).toBe(false);
  });

  it("should return true when expired but within stale window", () => {
    const expiresAt = new Date(Date.now() - 10 * 60 * 1000); // Expired 10 min ago
    const fetchedAt = new Date(Date.now() - 70 * 60 * 1000);

    expect(shouldServeStale(expiresAt, fetchedAt)).toBe(true);
  });

  it("should return false when beyond stale window", () => {
    const expiresAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // Expired 2h ago
    const fetchedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);

    expect(shouldServeStale(expiresAt, fetchedAt)).toBe(false);
  });

  it("should return false when disabled", () => {
    const expiresAt = new Date(Date.now() - 10 * 60 * 1000);
    const fetchedAt = new Date(Date.now() - 70 * 60 * 1000);

    expect(shouldServeStale(expiresAt, fetchedAt, { maxStaleAge: 0, enabled: false })).toBe(
      false
    );
  });
});

describe("needsRevalidation", () => {
  it("should return true when expired", () => {
    const expiresAt = new Date(Date.now() - 1000);
    expect(needsRevalidation(expiresAt)).toBe(true);
  });

  it("should return true when close to expiration", () => {
    // With 12h default TTL, 20% = 2.4h
    // If only 1h left, should need revalidation
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);
    expect(needsRevalidation(expiresAt)).toBe(true);
  });

  it("should return false when well within TTL", () => {
    // 6 hours remaining out of 12h = 50%
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    expect(needsRevalidation(expiresAt)).toBe(false);
  });
});

// =============================================================================
// Batch Helpers Tests
// =============================================================================

describe("groupUrlsByDomain", () => {
  it("should group URLs by domain", () => {
    const urls = [
      "https://example.com/page1",
      "https://example.com/page2",
      "https://other.com/page",
    ];

    const grouped = groupUrlsByDomain(urls);

    expect(grouped.get("example.com")).toEqual([
      "https://example.com/page1",
      "https://example.com/page2",
    ]);
    expect(grouped.get("other.com")).toEqual(["https://other.com/page"]);
  });

  it("should handle URLs without protocol by adding https", () => {
    // Note: normalizeUrl adds https:// to URLs without protocol
    const urls = ["https://example.com/page", "other.com/path"];
    const grouped = groupUrlsByDomain(urls);

    expect(grouped.size).toBe(2);
    expect(grouped.has("example.com")).toBe(true);
    expect(grouped.has("other.com")).toBe(true);
  });

  it("should skip truly invalid URLs", () => {
    const urls = ["https://example.com/page", "/relative-path"];
    const grouped = groupUrlsByDomain(urls);

    expect(grouped.size).toBe(1);
    expect(grouped.has("example.com")).toBe(true);
  });
});

describe("filterChangedUrls", () => {
  it("should return URLs with changed hashes", () => {
    const urlHashMap = new Map([
      ["url1", "hash1-new"],
      ["url2", "hash2-same"],
      ["url3", "hash3-new"],
    ]);

    const existingHashes = new Map([
      ["url1", "hash1-old"],
      ["url2", "hash2-same"],
      ["url3", "hash3-old"],
    ]);

    const changed = filterChangedUrls(urlHashMap, existingHashes);

    expect(changed).toContain("url1");
    expect(changed).toContain("url3");
    expect(changed).not.toContain("url2");
  });

  it("should include URLs not in existing hashes", () => {
    const urlHashMap = new Map([["new-url", "new-hash"]]);
    const existingHashes = new Map<string, string>();

    const changed = filterChangedUrls(urlHashMap, existingHashes);

    expect(changed).toContain("new-url");
  });
});

// =============================================================================
// Logging Tests
// =============================================================================

describe("createInvalidationLog", () => {
  it("should create log entry for URL event", () => {
    const event = urlChangedEvent("https://example.com/page");
    const log = createInvalidationLog(event, ["L1", "L2", "L3"], 5);

    expect(log.eventType).toBe("url_changed");
    expect(log.target).toBe("https://example.com/page");
    expect(log.levels).toEqual(["L1", "L2", "L3"]);
    expect(log.keysInvalidated).toBe(5);
    expect(log.timestamp).toBeInstanceOf(Date);
  });

  it("should create log entry for domain event", () => {
    const event = domainUpdatedEvent("example.com");
    const log = createInvalidationLog(event, ["L1", "L2"], 100);

    expect(log.target).toBe("example.com");
  });

  it("should create log entry for audit event", () => {
    const event = auditStartedEvent("audit-123", ["url1", "url2", "url3"]);
    const log = createInvalidationLog(event, [], 0);

    // Note: auditId is checked before urls in the implementation
    expect(log.target).toBe("audit-123");
  });
});
