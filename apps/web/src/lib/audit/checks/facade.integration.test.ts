/**
 * Integration Tests for Check Proxy Flow (apps/web -> open-seo-main)
 *
 * These tests verify the complete flow of SEO check execution through the proxy.
 * Uses vitest mocking to simulate open-seo-main responses.
 *
 * Test Categories:
 * 1. End-to-end check execution
 * 2. Error handling (connection, timeout, malformed responses)
 * 3. Rate limiting passthrough
 * 4. Type safety verification
 * 5. Performance constraints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runAllChecks } from "./facade";

import type { CheckResult, ScoreResult, ScoreBreakdown } from "./types";

// -----------------------------------------------------------------------------
// Test Fixtures
// -----------------------------------------------------------------------------

const sampleHtml = `
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
  <img src="/test.jpg" alt="Test image with alt text" width="800" height="600">
  <a href="https://example.com">External link</a>
  <a href="/internal">Internal link</a>
</body>
</html>
`;

const largeHtml = `
<!DOCTYPE html>
<html>
<head><title>Large Page</title></head>
<body>
  <h1>Large Content Test</h1>
  ${"<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>".repeat(500)}
</body>
</html>
`;

const testUrl = "https://example.com/test";

/**
 * Creates a valid API response matching open-seo-main format
 */
function createValidResponse(overrides: Partial<{
  findings: CheckResult[];
  score: ScoreResult;
}> = {}): { findings: CheckResult[]; score: ScoreResult } {
  return {
    findings: overrides.findings ?? [
      {
        checkId: "T1-01",
        passed: true,
        severity: "critical" as const,
        message: "Title tag is present",
        autoEditable: true,
        editRecipe: "add-title",
        tier: 1 as const,
      },
      {
        checkId: "T1-02",
        passed: true,
        severity: "critical" as const,
        message: "Meta description is present",
        autoEditable: true,
        editRecipe: "add-meta-description",
        tier: 1 as const,
      },
      {
        checkId: "T2-01",
        passed: true,
        severity: "high" as const,
        message: "Word count meets minimum threshold",
        autoEditable: false,
        tier: 2 as const,
      },
    ],
    score: overrides.score ?? {
      score: 85,
      gates: [],
      breakdown: {
        base: 60,
        tier1: 15,
        tier2: 5,
        tier3: 5,
      },
    },
  };
}

// -----------------------------------------------------------------------------
// 1. End-to-end Check Execution
// -----------------------------------------------------------------------------

describe("check proxy integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should successfully proxy checks to open-seo-main", async () => {
    const mockResponse = createValidResponse();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body><h1>Welcome</h1><p>Content here.</p></body>
      </html>
    `;

    const result = await runAllChecks(html, "https://example.com/test", {
      keyword: "test keyword",
      tiers: [1, 2],
    });

    expect(result.score.score).toBeGreaterThanOrEqual(0);
    expect(result.results).toBeInstanceOf(Array);
    expect(result.error).toBeUndefined();
  });

  it("should include all check results from API response", async () => {
    const mockFindings: CheckResult[] = [
      {
        checkId: "T1-01",
        passed: true,
        severity: "critical",
        message: "Title present",
        autoEditable: true,
      },
      {
        checkId: "T1-02",
        passed: false,
        severity: "critical",
        message: "Meta description missing",
        autoEditable: true,
        editRecipe: "add-meta-description",
      },
      {
        checkId: "T2-01",
        passed: true,
        severity: "high",
        message: "Word count OK",
        autoEditable: false,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse({ findings: mockFindings })),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.results).toHaveLength(3);
    expect(result.results[0]?.checkId).toBe("T1-01");
    expect(result.results[1]?.checkId).toBe("T1-02");
    expect(result.results[2]?.checkId).toBe("T2-01");
  });

  it("should pass keyword option to API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, { keyword: "seo audit" });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"keyword":"seo audit"'),
      })
    );
  });

  it("should pass tier filtering to API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, { tiers: [1, 2] });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"tiers":[1,2]'),
      })
    );
  });

  it("should use default tiers [1,2,3,4] when not specified", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, {});

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"tiers":[1,2,3,4]'),
      })
    );
  });
});

// -----------------------------------------------------------------------------
// 2. Error Handling
// -----------------------------------------------------------------------------

describe("error handling", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return error indicator when open-seo-main is unavailable", async () => {
    // Mock fetch to simulate connection refused
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.score.gates).toContain("API_UNAVAILABLE");
    expect(result.error).toBeDefined();
    expect(result.error).toBe("Connection refused");
  });

  it("should handle timeout gracefully", async () => {
    // Mock fetch to simulate AbortError (timeout)
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    vi.spyOn(global, "fetch").mockRejectedValueOnce(abortError);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.score.gates).toContain("API_UNAVAILABLE");
    expect(result.error).toBe("Request timed out");
  });

  it("should handle malformed response gracefully", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: "response" }),
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("Invalid response format from API");
  });

  it("should handle missing findings array in response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          score: { score: 85, gates: [], breakdown: { tier1: 25, tier2: 25, tier3: 25 } },
          // Missing findings array
        }),
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("Invalid response format from API");
  });

  it("should handle missing score in response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          findings: [],
          // Missing score
        }),
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("Invalid response format from API");
  });

  it("should handle HTTP 500 error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("API returned status 500");
  });

  it("should handle HTTP 503 service unavailable", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("API returned status 503");
  });

  it("should handle JSON parse error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error("Unexpected token")),
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("Unexpected token");
  });

  it("should handle network error with unknown error type", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce("Network failure");

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("Unknown error");
  });
});

// -----------------------------------------------------------------------------
// 3. Rate Limiting Passthrough
// -----------------------------------------------------------------------------

describe("rate limiting", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should pass through 429 errors from open-seo-main", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "60" }),
    } as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.error).toContain("429");
  });

  it("should handle rate limit error with retry-after header", async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      headers: new Headers({
        "Retry-After": "120",
      }),
    };
    vi.spyOn(global, "fetch").mockResolvedValueOnce(mockResponse as Response);

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
    expect(result.score.gates).toContain("API_UNAVAILABLE");
    expect(result.error).toBe("API returned status 429");
  });
});

// -----------------------------------------------------------------------------
// 4. Type Safety Verification
// -----------------------------------------------------------------------------

describe("type safety", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return correctly typed results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    // TypeScript should catch these at compile time, but verify at runtime
    expect(typeof result.score.score).toBe("number");
    expect(Array.isArray(result.score.gates)).toBe(true);
    expect(result.score.breakdown).toHaveProperty("base");
    expect(result.score.breakdown).toHaveProperty("tier1");
    expect(result.score.breakdown).toHaveProperty("tier2");
    expect(result.score.breakdown).toHaveProperty("tier3");
    // tier4 is optional in the new scoring model
    expect(result.score.breakdown).not.toHaveProperty("tier5");
  });

  it("should validate CheckResult structure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    for (const check of result.results) {
      expect(typeof check.checkId).toBe("string");
      expect(typeof check.passed).toBe("boolean");
      expect(typeof check.severity).toBe("string");
      expect(["critical", "high", "medium", "low", "info"]).toContain(check.severity);
      expect(typeof check.message).toBe("string");
      expect(typeof check.autoEditable).toBe("boolean");
    }
  });

  it("should handle optional CheckResult fields", async () => {
    const mockFindings: CheckResult[] = [
      {
        checkId: "T1-01",
        passed: true,
        severity: "critical",
        message: "Title present",
        autoEditable: true,
        editRecipe: "add-title",
        tier: 1,
        details: { length: 45, minLength: 30 },
      },
      {
        checkId: "T1-02",
        passed: false,
        severity: "high",
        message: "Meta missing",
        autoEditable: false,
        // No editRecipe, tier, or details - all optional
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse({ findings: mockFindings })),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    // First result has all optional fields
    expect(result.results[0]?.editRecipe).toBe("add-title");
    expect(result.results[0]?.tier).toBe(1);
    expect(result.results[0]?.details).toEqual({ length: 45, minLength: 30 });

    // Second result has no optional fields
    expect(result.results[1]?.editRecipe).toBeUndefined();
    expect(result.results[1]?.tier).toBeUndefined();
    expect(result.results[1]?.details).toBeUndefined();
  });

  it("should validate ScoreBreakdown structure", async () => {
    const mockScore: ScoreResult = {
      score: 92,
      gates: ["cwv-good"],
      breakdown: {
        base: 60,
        tier1: 18,
        tier2: 8,
        tier3: 6,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse({ score: mockScore })),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(typeof result.score.breakdown.base).toBe("number");
    expect(typeof result.score.breakdown.tier1).toBe("number");
    expect(typeof result.score.breakdown.tier2).toBe("number");
    expect(typeof result.score.breakdown.tier3).toBe("number");
    expect(result.score.breakdown.base).toBe(60);
  });

  it("should handle legacy tier4 in breakdown", async () => {
    const mockScore: ScoreResult = {
      score: 95,
      gates: [],
      breakdown: {
        base: 60,
        tier1: 15,
        tier2: 10,
        tier3: 5,
        tier4: 5,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse({ score: mockScore })),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.breakdown.tier4).toBe(5);
  });

  it("should reject invalid severity values", async () => {
    const mockFindings = [
      {
        checkId: "T1-01",
        passed: true,
        severity: "invalid-severity", // Invalid
        message: "Test",
        autoEditable: false,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        findings: mockFindings,
        score: { score: 85, gates: [], breakdown: { tier1: 25, tier2: 25, tier3: 25 } },
      }),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    // Should fail validation
    expect(result.score.score).toBe(-1);
    expect(result.error).toBe("Invalid response format from API");
  });
});

// -----------------------------------------------------------------------------
// 5. Performance
// -----------------------------------------------------------------------------

describe("performance", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should complete within timeout", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });

    const start = Date.now();

    await runAllChecks(largeHtml, testUrl, { tiers: [1, 2, 3, 4] });

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000); // 30s timeout
  });

  it("should handle large response efficiently", async () => {
    // Create response with many findings
    const manyFindings: CheckResult[] = Array.from({ length: 107 }, (_, i) => ({
      checkId: `T${Math.floor(i / 27) + 1}-${String((i % 27) + 1).padStart(2, "0")}`,
      passed: Math.random() > 0.3,
      severity: (["critical", "high", "medium", "low", "info"] as const)[i % 5],
      message: `Check ${i + 1} message`,
      autoEditable: Math.random() > 0.5,
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse({ findings: manyFindings })),
    });

    const start = Date.now();
    const result = await runAllChecks(sampleHtml, testUrl, {});
    const duration = Date.now() - start;

    expect(result.results.length).toBe(107);
    expect(duration).toBeLessThan(1000); // Should be very fast with mocked fetch
  });

  it("should set correct timeout for fetch request", async () => {
    let signalUsed = false;
    let signalAborted = false;

    const mockFetch = vi.fn().mockImplementation((_url, options) => {
      if (options?.signal) {
        signalUsed = true;
        signalAborted = options.signal.aborted;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createValidResponse()),
      });
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, {});

    expect(signalUsed).toBe(true);
    expect(signalAborted).toBe(false); // Should not be aborted yet
  });
});

// -----------------------------------------------------------------------------
// Edge Cases and Boundary Conditions
// -----------------------------------------------------------------------------

describe("edge cases", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should handle empty findings array", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        findings: [],
        score: { score: 0, gates: ["NO_CHECKS_RUN"], breakdown: { tier1: 0, tier2: 0, tier3: 0 } },
      }),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.results).toHaveLength(0);
    expect(result.score.score).toBe(0);
  });

  it("should handle empty HTML input", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        findings: [
          {
            checkId: "T1-01",
            passed: false,
            severity: "critical",
            message: "No title found",
            autoEditable: true,
          },
        ],
        score: { score: 0, gates: ["NO_CONTENT"], breakdown: { tier1: 0, tier2: 0, tier3: 0 } },
      }),
    });

    const result = await runAllChecks("", testUrl, {});

    expect(result.score.gates).toContain("NO_CONTENT");
  });

  it("should handle URL with special characters", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });

    const specialUrl = "https://example.com/path?query=test&param=value#section";
    await runAllChecks(sampleHtml, specialUrl, {});

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining(specialUrl),
      })
    );
  });

  it("should handle Unicode content in HTML", async () => {
    const unicodeHtml = `
      <!DOCTYPE html>
      <html lang="ja">
      <head><title>Japanese Page</title></head>
      <body>
        <h1>Welcome</h1>
        <p>Content here.</p>
      </body>
      </html>
    `;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });

    const result = await runAllChecks(unicodeHtml, testUrl, {});

    expect(result.error).toBeUndefined();
    expect(result.score.score).toBeGreaterThanOrEqual(0);
  });

  it("should handle score of exactly 0", async () => {
    const zeroScoreResponse = createValidResponse({
      score: {
        score: 0,
        gates: ["CRITICAL_FAILURES"],
        breakdown: { base: 0, tier1: 0, tier2: 0, tier3: 0 },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(zeroScoreResponse),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(0);
    expect(result.error).toBeUndefined(); // 0 is valid, not an error
  });

  it("should handle score of exactly 100", async () => {
    const perfectScoreResponse = createValidResponse({
      score: {
        score: 100,
        gates: [],
        breakdown: { base: 60, tier1: 20, tier2: 10, tier3: 10 },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(perfectScoreResponse),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(100);
    expect(result.score.gates).toHaveLength(0);
  });

  it("should handle negative score (error indicator from API)", async () => {
    const errorScoreResponse = createValidResponse({
      score: {
        score: -1,
        gates: ["API_ERROR"],
        breakdown: { base: 0, tier1: 0, tier2: 0, tier3: 0 },
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(errorScoreResponse),
    });

    const result = await runAllChecks(sampleHtml, testUrl, {});

    expect(result.score.score).toBe(-1);
  });
});

// -----------------------------------------------------------------------------
// Request Format Verification
// -----------------------------------------------------------------------------

describe("request format", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should send correct Content-Type header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, {});

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("should use POST method", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, {});

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("should call correct API endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, {});

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/audit/run-checks"),
      expect.any(Object)
    );
  });

  it("should include all required fields in request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(createValidResponse()),
    });
    global.fetch = mockFetch;

    await runAllChecks(sampleHtml, testUrl, { keyword: "test" });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);

    expect(body).toHaveProperty("html");
    expect(body).toHaveProperty("url");
    expect(body).toHaveProperty("keyword");
    expect(body).toHaveProperty("tiers");
  });
});
