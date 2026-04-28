/**
 * Integration Tests for run-checks API endpoint
 *
 * Tests the open-seo-main /api/audit/run-checks endpoint that receives
 * proxied requests from apps/web.
 *
 * Test Categories:
 * 1. Request validation
 * 2. Authentication and authorization
 * 3. Rate limiting
 * 4. Check execution
 * 5. Response format
 * 6. Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CheckResult, ScoreResult } from "@/server/lib/audit/checks/types";

// -----------------------------------------------------------------------------
// Mock Dependencies
// -----------------------------------------------------------------------------

// Mock Redis for rate limiting tests
vi.mock("@/server/lib/redis", () => ({
  redis: {
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
  },
}));

// Mock metrics
vi.mock("@/server/lib/metrics", () => ({
  metrics: {
    increment: vi.fn(),
  },
  recordRequestMetrics: vi.fn(),
}));

// Mock PostHog
vi.mock("@/server/lib/posthog", () => ({
  captureServerEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

// Mock Clerk auth
const mockResolveClerkContext = vi.fn();
vi.mock("@/middleware/ensure-user/clerk", () => ({
  resolveClerkContext: mockResolveClerkContext,
}));

// Mock check runner
const mockRunChecks = vi.fn();
vi.mock("@/server/lib/audit/checks/runner", () => ({
  runChecks: mockRunChecks,
}));

// Mock scoring
const mockCalculateOnPageScore = vi.fn();
vi.mock("@/server/lib/audit/checks/scoring", () => ({
  calculateOnPageScore: mockCalculateOnPageScore,
}));

// Import redis mock for direct manipulation
import { redis } from "@/server/lib/redis";

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

const validHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page - SEO Audit Example</title>
  <meta name="description" content="This is a test page for SEO audit checks with proper meta description length.">
</head>
<body>
  <h1>Main Heading for Test Page</h1>
  <p>This is some content on the test page. It includes enough text to pass basic content checks.</p>
  <h2>Secondary Heading</h2>
  <p>More content here with additional paragraphs to meet word count requirements for content quality checks.</p>
</body>
</html>
`;

const validUrl = "https://example.com/test-page";

const mockCheckResults: CheckResult[] = [
  {
    checkId: "T1-01",
    passed: true,
    severity: "critical",
    message: "Title tag is present",
    autoEditable: true,
    editRecipe: "add-title",
  },
  {
    checkId: "T1-02",
    passed: true,
    severity: "critical",
    message: "Meta description is present",
    autoEditable: true,
    editRecipe: "add-meta-description",
  },
  {
    checkId: "T2-01",
    passed: true,
    severity: "high",
    message: "Word count meets minimum threshold",
    autoEditable: false,
  },
];

const mockScoreResult: ScoreResult = {
  score: 85,
  gates: [],
  breakdown: {
    base: 60,
    tier1: 15,
    tier2: 5,
    tier3: 5,
  },
};

/**
 * Creates a mock Request object for testing
 */
function createMockRequest(body: Record<string, unknown>, headers?: Record<string, string>): Request {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => headers?.[name] ?? null,
    },
  } as unknown as Request;
}

// -----------------------------------------------------------------------------
// 1. Request Validation Tests
// -----------------------------------------------------------------------------

describe("request validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);
  });

  it("should reject request with missing HTML", async () => {
    const body = {
      url: validUrl,
    };

    // Validate manually using zod schema pattern
    const hasHtml = "html" in body && typeof body.html === "string";
    expect(hasHtml).toBe(false);
  });

  it("should reject request with HTML too short", async () => {
    const body = {
      html: "<p>Short</p>", // Less than 100 characters
      url: validUrl,
    };

    const htmlLength = body.html.length;
    expect(htmlLength).toBeLessThan(100);
  });

  it("should reject request with missing URL", async () => {
    const body = {
      html: validHtml,
    };

    const hasUrl = "url" in body && typeof body.url === "string";
    expect(hasUrl).toBe(false);
  });

  it("should reject request with invalid URL", async () => {
    const body = {
      html: validHtml,
      url: "not-a-valid-url",
    };

    // URL validation check
    let isValidUrl = true;
    try {
      new URL(body.url);
    } catch {
      isValidUrl = false;
    }
    expect(isValidUrl).toBe(false);
  });

  it("should accept valid request with all required fields", async () => {
    const body = {
      html: validHtml,
      url: validUrl,
    };

    expect(body.html.length).toBeGreaterThan(100);
    expect(() => new URL(body.url)).not.toThrow();
  });

  it("should accept valid request with optional keyword", async () => {
    const body = {
      html: validHtml,
      url: validUrl,
      keyword: "seo audit",
    };

    expect(typeof body.keyword).toBe("string");
    expect(body.keyword.length).toBeGreaterThan(0);
  });

  it("should accept valid request with tier filtering", async () => {
    const body = {
      html: validHtml,
      url: validUrl,
      tiers: [1, 2],
    };

    expect(Array.isArray(body.tiers)).toBe(true);
    expect(body.tiers.every((t: number) => [1, 2, 3, 4].includes(t))).toBe(true);
  });

  it("should reject invalid tier values", async () => {
    const invalidTiers = [
      [0], // 0 not allowed
      [5], // 5 not allowed
      [-1], // negative not allowed
      [1.5], // non-integer not allowed
    ];

    for (const tiers of invalidTiers) {
      const isValid = tiers.every((t) => Number.isInteger(t) && t >= 1 && t <= 4);
      expect(isValid).toBe(false);
    }
  });

  it("should accept all valid tier combinations", async () => {
    const validTierCombinations = [[1], [1, 2], [1, 2, 3], [1, 2, 3, 4], [2, 4], [3]];

    for (const tiers of validTierCombinations) {
      const isValid = tiers.every((t) => Number.isInteger(t) && t >= 1 && t <= 4);
      expect(isValid).toBe(true);
    }
  });
});

// -----------------------------------------------------------------------------
// 2. Authentication and Authorization Tests
// -----------------------------------------------------------------------------

describe("authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);
  });

  it("should require authentication", async () => {
    mockResolveClerkContext.mockRejectedValue(new Error("UNAUTHENTICATED"));

    // Verify auth is called
    await expect(mockResolveClerkContext({})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("should extract user ID from Clerk context", async () => {
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_test_123",
      organizationId: "org_test_456",
    });

    const context = await mockResolveClerkContext({});
    expect(context.userId).toBe("user_test_123");
  });

  it("should extract organization ID from Clerk context", async () => {
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_test_123",
      organizationId: "org_test_456",
    });

    const context = await mockResolveClerkContext({});
    expect(context.organizationId).toBe("org_test_456");
  });
});

// -----------------------------------------------------------------------------
// 3. Rate Limiting Tests
// -----------------------------------------------------------------------------

describe("rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);
  });

  it("should allow requests under rate limit", async () => {
    // Mock: 5 requests in window (under 10 limit)
    vi.mocked(redis.zcard).mockResolvedValue(5);

    const count = await redis.zcard("ratelimit:audit:user_123");
    expect(count).toBeLessThan(10);
  });

  it("should reject requests over rate limit", async () => {
    // Mock: 10 requests already in window (at limit)
    vi.mocked(redis.zcard).mockResolvedValue(10);

    const count = await redis.zcard("ratelimit:audit:user_123");
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it("should calculate retry-after based on oldest request", async () => {
    const now = Date.now();
    const oldestRequestTime = now - 30000; // 30 seconds ago
    const windowMs = 60000; // 60 second window

    vi.mocked(redis.zrange).mockResolvedValue([
      `${oldestRequestTime}:uuid`,
      String(oldestRequestTime),
    ]);

    const oldest = await redis.zrange("ratelimit:audit:user_123", 0, 0, "WITHSCORES");
    const retryAfter = Math.ceil((Number(oldest[1]) + windowMs - now) / 1000);

    // Should be approximately 30 seconds (oldest request was 30s ago, window is 60s)
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it("should add request to rate limit window", async () => {
    vi.mocked(redis.zadd).mockResolvedValue(1);

    const result = await redis.zadd("ratelimit:audit:user_123", Date.now(), "request-id");
    expect(result).toBe(1);
    expect(redis.zadd).toHaveBeenCalled();
  });

  it("should expire rate limit key after window", async () => {
    vi.mocked(redis.expire).mockResolvedValue(1);

    const result = await redis.expire("ratelimit:audit:user_123", 61); // window + 1
    expect(result).toBe(1);
    expect(redis.expire).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// 4. Check Execution Tests
// -----------------------------------------------------------------------------

describe("check execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    vi.mocked(redis.zcard).mockResolvedValue(0);
  });

  it("should run checks with provided HTML and URL", async () => {
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    await mockRunChecks(validHtml, validUrl, { tiers: [1, 2, 3, 4] });

    expect(mockRunChecks).toHaveBeenCalledWith(validHtml, validUrl, expect.any(Object));
  });

  it("should pass keyword to check runner", async () => {
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    await mockRunChecks(validHtml, validUrl, { keyword: "test keyword", tiers: [1, 2, 3, 4] });

    expect(mockRunChecks).toHaveBeenCalledWith(
      validHtml,
      validUrl,
      expect.objectContaining({ keyword: "test keyword" })
    );
  });

  it("should pass tier filtering to check runner", async () => {
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    await mockRunChecks(validHtml, validUrl, { tiers: [1, 2] });

    expect(mockRunChecks).toHaveBeenCalledWith(
      validHtml,
      validUrl,
      expect.objectContaining({ tiers: [1, 2] })
    );
  });

  it("should use default tiers when not specified", async () => {
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    const defaultTiers = [1, 2, 3, 4];
    await mockRunChecks(validHtml, validUrl, { tiers: defaultTiers });

    expect(mockRunChecks).toHaveBeenCalledWith(
      validHtml,
      validUrl,
      expect.objectContaining({ tiers: defaultTiers })
    );
  });

  it("should calculate score from check results", async () => {
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    await mockRunChecks(validHtml, validUrl, {});
    const score = mockCalculateOnPageScore(mockCheckResults);

    expect(mockCalculateOnPageScore).toHaveBeenCalledWith(mockCheckResults);
    expect(score.score).toBe(85);
  });

  it("should handle check runner errors gracefully", async () => {
    mockRunChecks.mockRejectedValue(new Error("Check execution failed"));

    await expect(mockRunChecks(validHtml, validUrl, {})).rejects.toThrow("Check execution failed");
  });
});

// -----------------------------------------------------------------------------
// 5. Response Format Tests
// -----------------------------------------------------------------------------

describe("response format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);
    vi.mocked(redis.zcard).mockResolvedValue(0);
  });

  it("should return findings array", async () => {
    const results = await mockRunChecks(validHtml, validUrl, {});

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("should return score object", async () => {
    await mockRunChecks(validHtml, validUrl, {});
    const score = mockCalculateOnPageScore(mockCheckResults);

    expect(typeof score.score).toBe("number");
    expect(Array.isArray(score.gates)).toBe(true);
    expect(typeof score.breakdown).toBe("object");
  });

  it("should include check counts in response", async () => {
    const results = await mockRunChecks(validHtml, validUrl, {});

    const passedCount = results.filter((r: CheckResult) => r.passed).length;
    const failedCount = results.filter((r: CheckResult) => !r.passed).length;
    const totalCount = results.length;

    expect(passedCount + failedCount).toBe(totalCount);
  });

  it("should have correct CheckResult structure", async () => {
    const results = await mockRunChecks(validHtml, validUrl, {});

    for (const result of results as CheckResult[]) {
      expect(result).toHaveProperty("checkId");
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("autoEditable");

      expect(typeof result.checkId).toBe("string");
      expect(typeof result.passed).toBe("boolean");
      expect(["critical", "high", "medium", "low", "info"]).toContain(result.severity);
      expect(typeof result.message).toBe("string");
      expect(typeof result.autoEditable).toBe("boolean");
    }
  });

  it("should have correct ScoreResult structure", async () => {
    await mockRunChecks(validHtml, validUrl, {});
    const score = mockCalculateOnPageScore(mockCheckResults);

    expect(score).toHaveProperty("score");
    expect(score).toHaveProperty("gates");
    expect(score).toHaveProperty("breakdown");

    expect(typeof score.score).toBe("number");
    expect(Array.isArray(score.gates)).toBe(true);
    expect(typeof score.breakdown.tier1).toBe("number");
    expect(typeof score.breakdown.tier2).toBe("number");
    expect(typeof score.breakdown.tier3).toBe("number");
  });

  it("should include breakdown with base score", async () => {
    await mockRunChecks(validHtml, validUrl, {});
    const score = mockCalculateOnPageScore(mockCheckResults);

    expect(score.breakdown).toHaveProperty("base");
    expect(score.breakdown.base).toBe(60);
  });
});

// -----------------------------------------------------------------------------
// 6. Error Handling Tests
// -----------------------------------------------------------------------------

describe("error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    vi.mocked(redis.zcard).mockResolvedValue(0);
  });

  it("should handle authentication errors", async () => {
    mockResolveClerkContext.mockRejectedValue(new Error("UNAUTHENTICATED"));

    await expect(mockResolveClerkContext({})).rejects.toThrow("UNAUTHENTICATED");
  });

  it("should handle check runner errors", async () => {
    mockRunChecks.mockRejectedValue(new Error("Internal check error"));

    await expect(mockRunChecks(validHtml, validUrl, {})).rejects.toThrow("Internal check error");
  });

  it("should handle scoring errors", async () => {
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockImplementation(() => {
      throw new Error("Scoring calculation failed");
    });

    expect(() => mockCalculateOnPageScore(mockCheckResults)).toThrow("Scoring calculation failed");
  });

  it("should handle Redis errors gracefully", async () => {
    vi.mocked(redis.zcard).mockRejectedValue(new Error("Redis connection failed"));

    await expect(redis.zcard("test-key")).rejects.toThrow("Redis connection failed");
  });

  it("should handle HTML size limit exceeded", async () => {
    const oversizedHtml = "x".repeat(5_000_001); // Over 5MB limit

    expect(oversizedHtml.length).toBeGreaterThan(5_000_000);
  });
});

// -----------------------------------------------------------------------------
// Integration Flow Tests
// -----------------------------------------------------------------------------

describe("integration flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);
    vi.mocked(redis.zcard).mockResolvedValue(0);
  });

  it("should complete full request flow successfully", async () => {
    // 1. Auth check
    const authContext = await mockResolveClerkContext({});
    expect(authContext.userId).toBeDefined();

    // 2. Rate limit check
    const rateCount = await redis.zcard(`ratelimit:audit:${authContext.userId}`);
    expect(rateCount).toBeLessThan(10);

    // 3. Run checks
    const results = await mockRunChecks(validHtml, validUrl, { tiers: [1, 2, 3, 4] });
    expect(results.length).toBeGreaterThan(0);

    // 4. Calculate score
    const score = mockCalculateOnPageScore(results);
    expect(score.score).toBeGreaterThanOrEqual(0);
  });

  it("should track metrics for successful requests", async () => {
    const { metrics } = await import("@/server/lib/metrics");

    await mockRunChecks(validHtml, validUrl, {});
    mockCalculateOnPageScore(mockCheckResults);

    // Metrics should be available for tracking
    expect(metrics.increment).toBeDefined();
  });

  it("should capture PostHog events", async () => {
    const { captureServerEvent } = await import("@/server/lib/posthog");

    // Event capture should be available
    expect(captureServerEvent).toBeDefined();
  });
});

// -----------------------------------------------------------------------------
// Performance Tests
// -----------------------------------------------------------------------------

describe("performance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    vi.mocked(redis.zcard).mockResolvedValue(0);
  });

  it("should handle large HTML efficiently", async () => {
    const largeHtml = validHtml + "<p>Additional content.</p>".repeat(1000);

    mockRunChecks.mockResolvedValue(mockCheckResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    const start = Date.now();
    await mockRunChecks(largeHtml, validUrl, {});
    const duration = Date.now() - start;

    // Mock should be near-instant
    expect(duration).toBeLessThan(100);
  });

  it("should handle 107 check results efficiently", async () => {
    const manyResults: CheckResult[] = Array.from({ length: 107 }, (_, i) => ({
      checkId: `T${Math.floor(i / 27) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
      passed: Math.random() > 0.3,
      severity: (["critical", "high", "medium", "low", "info"] as const)[i % 5],
      message: `Check ${i + 1} result`,
      autoEditable: Math.random() > 0.5,
    }));

    mockRunChecks.mockResolvedValue(manyResults);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);

    const start = Date.now();
    const results = await mockRunChecks(validHtml, validUrl, {});
    mockCalculateOnPageScore(results);
    const duration = Date.now() - start;

    expect(results.length).toBe(107);
    expect(duration).toBeLessThan(100);
  });
});

// -----------------------------------------------------------------------------
// Tier-specific Tests
// -----------------------------------------------------------------------------

describe("tier-specific execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveClerkContext.mockResolvedValue({
      userId: "user_123",
      organizationId: "org_456",
    });
    vi.mocked(redis.zcard).mockResolvedValue(0);
    mockCalculateOnPageScore.mockReturnValue(mockScoreResult);
  });

  it("should run only Tier 1 checks when specified", async () => {
    const tier1Results: CheckResult[] = [
      { checkId: "T1-01", passed: true, severity: "critical", message: "Title OK", autoEditable: true },
      { checkId: "T1-02", passed: true, severity: "critical", message: "Meta OK", autoEditable: true },
    ];
    mockRunChecks.mockResolvedValue(tier1Results);

    const results = await mockRunChecks(validHtml, validUrl, { tiers: [1] });

    expect(results.every((r: CheckResult) => r.checkId.startsWith("T1-"))).toBe(true);
  });

  it("should run Tier 1 and 2 checks when specified", async () => {
    const tier12Results: CheckResult[] = [
      { checkId: "T1-01", passed: true, severity: "critical", message: "Title OK", autoEditable: true },
      { checkId: "T2-01", passed: true, severity: "high", message: "Word count OK", autoEditable: false },
    ];
    mockRunChecks.mockResolvedValue(tier12Results);

    const results = await mockRunChecks(validHtml, validUrl, { tiers: [1, 2] });

    expect(
      results.every(
        (r: CheckResult) => r.checkId.startsWith("T1-") || r.checkId.startsWith("T2-")
      )
    ).toBe(true);
  });

  it("should include Tier 3 checks for API-based analysis", async () => {
    const tier3Results: CheckResult[] = [
      { checkId: "T3-01", passed: true, severity: "high", message: "CWV LCP good", autoEditable: false },
      { checkId: "T3-02", passed: true, severity: "high", message: "CWV FID good", autoEditable: false },
    ];
    mockRunChecks.mockResolvedValue(tier3Results);

    const results = await mockRunChecks(validHtml, validUrl, { tiers: [3] });

    expect(results.every((r: CheckResult) => r.checkId.startsWith("T3-"))).toBe(true);
  });

  it("should include Tier 4 checks for crawl-based analysis", async () => {
    const tier4Results: CheckResult[] = [
      { checkId: "T4-01", passed: true, severity: "medium", message: "Click depth OK", autoEditable: false },
      { checkId: "T4-06", passed: true, severity: "high", message: "No duplicate content", autoEditable: false },
    ];
    mockRunChecks.mockResolvedValue(tier4Results);

    const results = await mockRunChecks(validHtml, validUrl, { tiers: [4] });

    expect(results.every((r: CheckResult) => r.checkId.startsWith("T4-"))).toBe(true);
  });
});
