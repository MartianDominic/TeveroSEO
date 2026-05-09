import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { runAllChecks } from "./facade";
import {
  isValidScoreResult,
  isValidScoreBreakdown,
  isValidCheckResult,
  isValidCheckResponse,
  isValidAllChecksResult,
} from "./types";

import type { CheckTier, CheckResult, ScoreResult, ScoreBreakdown } from "./types";

// -----------------------------------------------------------------------------
// Test fixtures
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

const minimalHtml = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <p>Minimal content</p>
</body>
</html>
`;

const validCheckResult: CheckResult = {
  checkId: "T1-01",
  passed: true,
  severity: "critical",
  message: "Title tag is present",
  autoEditable: true,
  editRecipe: "add-title",
  tier: 1,
};

const validScoreBreakdown: ScoreBreakdown = {
  base: 60,
  tier1: 15,
  tier2: 10,
  tier3: 10,
};

const validScoreResult: ScoreResult = {
  score: 85,
  gates: ["TITLE_PRESENT"],
  breakdown: validScoreBreakdown,
};

// -----------------------------------------------------------------------------
// Type Guard Tests
// -----------------------------------------------------------------------------

describe("isValidScoreBreakdown", () => {
  it("should accept valid breakdown with base and tier1-3", () => {
    const valid: ScoreBreakdown = {
      base: 60,
      tier1: 15,
      tier2: 10,
      tier3: 10,
    };
    expect(isValidScoreBreakdown(valid)).toBe(true);
  });

  it("should accept valid breakdown with optional tier4", () => {
    const valid: ScoreBreakdown = {
      base: 60,
      tier1: 15,
      tier2: 10,
      tier3: 10,
      tier4: 5,
    };
    expect(isValidScoreBreakdown(valid)).toBe(true);
  });

  it("should accept breakdown without base (legacy model)", () => {
    const legacyValid = {
      tier1: 25,
      tier2: 25,
      tier3: 25,
      tier4: 25,
    };
    expect(isValidScoreBreakdown(legacyValid)).toBe(true);
  });

  it("should reject missing tier1", () => {
    const invalid = {
      base: 60,
      tier2: 10,
      tier3: 10,
    };
    expect(isValidScoreBreakdown(invalid)).toBe(false);
  });

  it("should reject missing tier2", () => {
    const invalid = {
      base: 60,
      tier1: 15,
      tier3: 10,
    };
    expect(isValidScoreBreakdown(invalid)).toBe(false);
  });

  it("should reject missing tier3", () => {
    const invalid = {
      base: 60,
      tier1: 15,
      tier2: 10,
    };
    expect(isValidScoreBreakdown(invalid)).toBe(false);
  });

  it("should reject non-numeric tier values", () => {
    const invalid = {
      tier1: "25",
      tier2: 25,
      tier3: 25,
    };
    expect(isValidScoreBreakdown(invalid)).toBe(false);
  });

  it("should reject non-numeric base when provided", () => {
    const invalid = {
      base: "60",
      tier1: 15,
      tier2: 10,
      tier3: 10,
    };
    expect(isValidScoreBreakdown(invalid)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isValidScoreBreakdown(null)).toBe(false);
    expect(isValidScoreBreakdown(undefined)).toBe(false);
    expect(isValidScoreBreakdown("string")).toBe(false);
    expect(isValidScoreBreakdown(123)).toBe(false);
    expect(isValidScoreBreakdown([])).toBe(false);
  });
});

describe("isValidScoreResult", () => {
  it("should accept valid score result", () => {
    const valid = {
      score: 85,
      gates: ["TITLE_PRESENT"],
      breakdown: { base: 10, tier1: 25, tier2: 25, tier3: 25 },
    };
    expect(isValidScoreResult(valid)).toBe(true);
  });

  it("should accept score result with empty gates", () => {
    const valid = {
      score: 100,
      gates: [],
      breakdown: { tier1: 25, tier2: 25, tier3: 25, tier4: 25 },
    };
    expect(isValidScoreResult(valid)).toBe(true);
  });

  it("should accept score of 0", () => {
    const valid = {
      score: 0,
      gates: ["CRITICAL_FAILURE"],
      breakdown: { tier1: 0, tier2: 0, tier3: 0 },
    };
    expect(isValidScoreResult(valid)).toBe(true);
  });

  it("should accept negative score (error indicator)", () => {
    const valid = {
      score: -1,
      gates: ["API_UNAVAILABLE"],
      breakdown: { tier1: 0, tier2: 0, tier3: 0 },
    };
    expect(isValidScoreResult(valid)).toBe(true);
  });

  it("should reject missing score", () => {
    const invalid = {
      gates: [],
      breakdown: { base: 0, tier1: 0, tier2: 0, tier3: 0 },
    };
    expect(isValidScoreResult(invalid)).toBe(false);
  });

  it("should reject non-numeric score", () => {
    const invalid = {
      score: "85",
      gates: [],
      breakdown: { tier1: 0, tier2: 0, tier3: 0 },
    };
    expect(isValidScoreResult(invalid)).toBe(false);
  });

  it("should reject missing gates", () => {
    const invalid = {
      score: 85,
      breakdown: { tier1: 25, tier2: 25, tier3: 25 },
    };
    expect(isValidScoreResult(invalid)).toBe(false);
  });

  it("should reject non-array gates", () => {
    const invalid = {
      score: 85,
      gates: "TITLE_PRESENT",
      breakdown: { tier1: 25, tier2: 25, tier3: 25 },
    };
    expect(isValidScoreResult(invalid)).toBe(false);
  });

  it("should reject missing breakdown", () => {
    const invalid = {
      score: 85,
      gates: [],
    };
    expect(isValidScoreResult(invalid)).toBe(false);
  });

  it("should reject invalid breakdown structure", () => {
    const invalid = {
      score: 85,
      gates: [],
      breakdown: { tier1: 0, tier2: 0 }, // Missing tier3
    };
    expect(isValidScoreResult(invalid)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isValidScoreResult(null)).toBe(false);
    expect(isValidScoreResult(undefined)).toBe(false);
    expect(isValidScoreResult("string")).toBe(false);
    expect(isValidScoreResult(123)).toBe(false);
  });
});

describe("isValidCheckResult", () => {
  it("should accept valid check result with all required fields", () => {
    const valid = {
      checkId: "T1-01",
      passed: true,
      severity: "critical",
      message: "Title is present",
      autoEditable: true,
    };
    expect(isValidCheckResult(valid)).toBe(true);
  });

  it("should accept valid check result with optional fields", () => {
    const valid = {
      checkId: "T1-01",
      passed: false,
      severity: "high",
      message: "Title too short",
      autoEditable: true,
      editRecipe: "extend-title",
      tier: 1,
      details: { currentLength: 10, minLength: 30 },
    };
    expect(isValidCheckResult(valid)).toBe(true);
  });

  it("should accept all valid severity values", () => {
    const severities = ["critical", "high", "medium", "low", "info"];
    for (const severity of severities) {
      const valid = {
        checkId: "test",
        passed: true,
        severity,
        message: "Test",
        autoEditable: false,
      };
      expect(isValidCheckResult(valid)).toBe(true);
    }
  });

  it("should accept all valid tier values", () => {
    const tiers = [1, 2, 3, 4];
    for (const tier of tiers) {
      const valid = {
        checkId: `T${tier}-01`,
        passed: true,
        severity: "low",
        message: "Test",
        autoEditable: false,
        tier,
      };
      expect(isValidCheckResult(valid)).toBe(true);
    }
  });

  it("should reject invalid severity", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "invalid-severity",
      message: "Test",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject invalid tier values", () => {
    const invalidTiers = [0, 5, -1, 1.5];
    for (const tier of invalidTiers) {
      const invalid = {
        checkId: "test",
        passed: true,
        severity: "low",
        message: "Test",
        autoEditable: false,
        tier,
      };
      expect(isValidCheckResult(invalid)).toBe(false);
    }
  });

  it("should reject missing checkId", () => {
    const invalid = {
      passed: true,
      severity: "low",
      message: "Test",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-string checkId", () => {
    const invalid = {
      checkId: 123,
      passed: true,
      severity: "low",
      message: "Test",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject missing passed", () => {
    const invalid = {
      checkId: "test",
      severity: "low",
      message: "Test",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-boolean passed", () => {
    const invalid = {
      checkId: "test",
      passed: "true",
      severity: "low",
      message: "Test",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject missing severity", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      message: "Test",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject missing message", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-string message", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      message: 123,
      autoEditable: false,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject missing autoEditable", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      message: "Test",
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-boolean autoEditable", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      message: "Test",
      autoEditable: "true",
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-string editRecipe when provided", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      message: "Test",
      autoEditable: true,
      editRecipe: 123,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-object details when provided", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      message: "Test",
      autoEditable: false,
      details: "invalid",
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject null details", () => {
    const invalid = {
      checkId: "test",
      passed: true,
      severity: "low",
      message: "Test",
      autoEditable: false,
      details: null,
    };
    expect(isValidCheckResult(invalid)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isValidCheckResult(null)).toBe(false);
    expect(isValidCheckResult(undefined)).toBe(false);
    expect(isValidCheckResult("string")).toBe(false);
    expect(isValidCheckResult(123)).toBe(false);
  });
});

describe("isValidCheckResponse", () => {
  it("should accept valid API response", () => {
    const valid = {
      findings: [
        {
          checkId: "T1-01",
          passed: true,
          severity: "low",
          message: "OK",
          autoEditable: false,
        },
      ],
      score: {
        score: 100,
        gates: [],
        breakdown: { base: 25, tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidCheckResponse(valid)).toBe(true);
  });

  it("should accept response with empty findings", () => {
    const valid = {
      findings: [],
      score: {
        score: 0,
        gates: [],
        breakdown: { tier1: 0, tier2: 0, tier3: 0 },
      },
    };
    expect(isValidCheckResponse(valid)).toBe(true);
  });

  it("should accept response with multiple findings", () => {
    const valid = {
      findings: [
        {
          checkId: "T1-01",
          passed: true,
          severity: "critical",
          message: "OK",
          autoEditable: false,
        },
        {
          checkId: "T1-02",
          passed: false,
          severity: "high",
          message: "Missing meta",
          autoEditable: true,
          editRecipe: "add-meta",
        },
        {
          checkId: "T2-01",
          passed: true,
          severity: "medium",
          message: "Content adequate",
          autoEditable: false,
          tier: 2,
        },
      ],
      score: {
        score: 75,
        gates: ["META_MISSING"],
        breakdown: { base: 40, tier1: 15, tier2: 10, tier3: 10 },
      },
    };
    expect(isValidCheckResponse(valid)).toBe(true);
  });

  it("should reject missing findings", () => {
    const invalid = {
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidCheckResponse(invalid)).toBe(false);
  });

  it("should reject non-array findings", () => {
    const invalid = {
      findings: "not-an-array",
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidCheckResponse(invalid)).toBe(false);
  });

  it("should reject response with invalid findings", () => {
    const invalid = {
      findings: [{ invalid: true }],
      score: {
        score: 100,
        gates: [],
        breakdown: { base: 25, tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidCheckResponse(invalid)).toBe(false);
  });

  it("should reject response with partially invalid findings", () => {
    const invalid = {
      findings: [
        {
          checkId: "T1-01",
          passed: true,
          severity: "low",
          message: "OK",
          autoEditable: false,
        },
        { invalid: true }, // Second finding is invalid
      ],
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidCheckResponse(invalid)).toBe(false);
  });

  it("should reject missing score", () => {
    const invalid = {
      findings: [],
    };
    expect(isValidCheckResponse(invalid)).toBe(false);
  });

  it("should reject invalid score", () => {
    const invalid = {
      findings: [],
      score: {
        score: "100", // Should be number
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidCheckResponse(invalid)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isValidCheckResponse(null)).toBe(false);
    expect(isValidCheckResponse(undefined)).toBe(false);
    expect(isValidCheckResponse("string")).toBe(false);
    expect(isValidCheckResponse(123)).toBe(false);
  });
});

describe("isValidAllChecksResult", () => {
  it("should accept valid AllChecksResult", () => {
    const valid = {
      results: [
        {
          checkId: "T1-01",
          passed: true,
          severity: "low",
          message: "OK",
          autoEditable: false,
        },
      ],
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidAllChecksResult(valid)).toBe(true);
  });

  it("should accept AllChecksResult with error", () => {
    const valid = {
      results: [],
      score: {
        score: -1,
        gates: ["API_UNAVAILABLE"],
        breakdown: { tier1: 0, tier2: 0, tier3: 0 },
      },
      error: "Request timed out",
    };
    expect(isValidAllChecksResult(valid)).toBe(true);
  });

  it("should accept AllChecksResult without error", () => {
    const valid = {
      results: [],
      score: {
        score: 0,
        gates: [],
        breakdown: { tier1: 0, tier2: 0, tier3: 0 },
      },
    };
    expect(isValidAllChecksResult(valid)).toBe(true);
  });

  it("should reject missing results", () => {
    const invalid = {
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidAllChecksResult(invalid)).toBe(false);
  });

  it("should reject non-array results", () => {
    const invalid = {
      results: "not-array",
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidAllChecksResult(invalid)).toBe(false);
  });

  it("should reject invalid results", () => {
    const invalid = {
      results: [{ invalid: true }],
      score: {
        score: 100,
        gates: [],
        breakdown: { tier1: 25, tier2: 25, tier3: 25 },
      },
    };
    expect(isValidAllChecksResult(invalid)).toBe(false);
  });

  it("should reject non-string error when provided", () => {
    const invalid = {
      results: [],
      score: {
        score: -1,
        gates: [],
        breakdown: { tier1: 0, tier2: 0, tier3: 0 },
      },
      error: 123, // Should be string
    };
    expect(isValidAllChecksResult(invalid)).toBe(false);
  });

  it("should reject non-object values", () => {
    expect(isValidAllChecksResult(null)).toBe(false);
    expect(isValidAllChecksResult(undefined)).toBe(false);
    expect(isValidAllChecksResult("string")).toBe(false);
    expect(isValidAllChecksResult(123)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Facade Function Tests
// -----------------------------------------------------------------------------

describe("runAllChecks", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("API failure scenarios", () => {
    it("should return error indicator on fetch error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.score.score).toBe(-1);
      expect(result.score.gates).toContain("API_UNAVAILABLE");
      expect(result.error).toBe("Network error");
      expect(result.results).toEqual([]);
    });

    it("should return error indicator on HTTP error status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.score.score).toBe(-1);
      expect(result.score.gates).toContain("API_UNAVAILABLE");
      expect(result.error).toBe("API returned status 500");
    });

    it("should return error indicator on 404", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.score.score).toBe(-1);
      expect(result.error).toBe("API returned status 404");
    });

    it("should return error indicator on timeout", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.score.score).toBe(-1);
      expect(result.score.gates).toContain("API_UNAVAILABLE");
      expect(result.error).toBe("Request timed out");
    });

    it("should return error indicator on invalid JSON response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      });

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.score.score).toBe(-1);
      expect(result.error).toBe("Invalid JSON");
    });

    it("should return error indicator on invalid response format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: "response" }),
      });

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.score.score).toBe(-1);
      expect(result.error).toBe("Invalid response format from API");
    });
  });

  describe("successful API responses", () => {
    it("should return valid results on successful API call", async () => {
      const mockResponse = {
        findings: [
          {
            checkId: "T1-01",
            passed: true,
            severity: "critical",
            message: "Title present",
            autoEditable: true,
          },
        ],
        score: {
          score: 85,
          gates: [],
          breakdown: { base: 60, tier1: 10, tier2: 8, tier3: 7 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      expect(result.error).toBeUndefined();
      expect(result.score.score).toBe(85);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.checkId).toBe("T1-01");
    });

    it("should filter out invalid check results from response", async () => {
      const mockResponse = {
        findings: [
          {
            checkId: "T1-01",
            passed: true,
            severity: "critical",
            message: "Valid check",
            autoEditable: true,
          },
          {
            // Invalid: missing required fields
            checkId: "T1-02",
            passed: true,
            // Missing severity, message, autoEditable
          },
          {
            checkId: "T1-03",
            passed: false,
            severity: "high",
            message: "Another valid check",
            autoEditable: false,
          },
        ],
        score: {
          score: 75,
          gates: [],
          breakdown: { tier1: 25, tier2: 25, tier3: 25 },
        },
      };

      // The isValidCheckResponse will fail because of invalid finding
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await runAllChecks(sampleHtml, "https://example.com", {});

      // Since response validation fails, we get error
      expect(result.score.score).toBe(-1);
      expect(result.error).toBe("Invalid response format from API");
    });

    it("should pass options to the API correctly", async () => {
      const mockResponse = {
        findings: [],
        score: {
          score: 100,
          gates: [],
          breakdown: { tier1: 25, tier2: 25, tier3: 25 },
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      global.fetch = mockFetch;

      await runAllChecks(sampleHtml, "https://example.com/test", {
        keyword: "test keyword",
        tiers: [1, 2],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: sampleHtml,
            url: "https://example.com/test",
            keyword: "test keyword",
            tiers: [1, 2],
          }),
        })
      );
    });

    it("should use default tiers when not specified", async () => {
      const mockResponse = {
        findings: [],
        score: {
          score: 100,
          gates: [],
          breakdown: { tier1: 25, tier2: 25, tier3: 25 },
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      global.fetch = mockFetch;

      await runAllChecks(sampleHtml, "https://example.com", {});

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
      );
      expect(callBody.tiers).toEqual([1, 2, 3, 4]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty HTML", async () => {
      const mockResponse = {
        findings: [],
        score: {
          score: 0,
          gates: ["NO_CONTENT"],
          breakdown: { tier1: 0, tier2: 0, tier3: 0 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await runAllChecks("", "https://example.com", {});

      expect(result.score.score).toBe(0);
    });

    it("should handle special characters in URL", async () => {
      const mockResponse = {
        findings: [],
        score: {
          score: 100,
          gates: [],
          breakdown: { tier1: 25, tier2: 25, tier3: 25 },
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });
      global.fetch = mockFetch;

      const urlWithSpecialChars = "https://example.com/path?query=test&foo=bar#section";
      await runAllChecks(sampleHtml, urlWithSpecialChars, {});

      const callBody = JSON.parse(
        (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string
      );
      expect(callBody.url).toBe(urlWithSpecialChars);
    });

    it("should handle Unicode in HTML content", async () => {
      const unicodeHtml = `
        <!DOCTYPE html>
        <html lang="ja">
        <head><title>Japanese Page</title></head>
        <body>
          <h1>日本語のページ</h1>
          <p>これはテストです。絵文字も含みます: 🎉🚀</p>
        </body>
        </html>
      `;

      const mockResponse = {
        findings: [
          {
            checkId: "T1-01",
            passed: true,
            severity: "low",
            message: "Title present",
            autoEditable: false,
          },
        ],
        score: {
          score: 80,
          gates: [],
          breakdown: { tier1: 20, tier2: 20, tier3: 20, tier4: 20 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await runAllChecks(unicodeHtml, "https://example.jp", {});

      expect(result.error).toBeUndefined();
      expect(result.score.score).toBe(80);
    });

    it("should handle large HTML content", async () => {
      const largeHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Large Page</title></head>
        <body>
          <h1>Large Content Test</h1>
          ${"<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>".repeat(1000)}
        </body>
        </html>
      `;

      const mockResponse = {
        findings: [],
        score: {
          score: 90,
          gates: [],
          breakdown: { tier1: 25, tier2: 25, tier3: 20, tier4: 20 },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await runAllChecks(largeHtml, "https://example.com", {});

      expect(result.error).toBeUndefined();
      expect(result.score.score).toBe(90);
    });
  });
});

// -----------------------------------------------------------------------------
// Integration Tests (requires actual open-seo-main running)
// These tests are skipped by default but can be run with appropriate setup
// -----------------------------------------------------------------------------

describe.skip("runAllChecks (integration)", () => {
  it("returns CheckResult[] for all 107 checks", async () => {
    const result = await runAllChecks(sampleHtml, "https://example.com/test");

    expect(result).toBeDefined();
    expect(result.results).toBeInstanceOf(Array);
    // Should have results for all 107 checks
    expect(result.results.length).toBe(107);

    // Each result should have required properties
    for (const check of result.results) {
      expect(check).toHaveProperty("checkId");
      expect(check).toHaveProperty("passed");
      expect(check).toHaveProperty("severity");
      expect(check).toHaveProperty("message");
      expect(check).toHaveProperty("autoEditable");
    }
  });

  it("runs keyword-based checks when keyword provided", async () => {
    const result = await runAllChecks(sampleHtml, "https://example.com/test", {
      keyword: "test page",
    });

    expect(result.results).toBeInstanceOf(Array);
    expect(result.results.length).toBe(107);

    // Find keyword-related checks (e.g., keyword in title, meta, H1)
    const keywordChecks = result.results.filter(
      (r: CheckResult) =>
        r.checkId.includes("keyword") ||
        r.message.toLowerCase().includes("keyword")
    );
    expect(keywordChecks.length).toBeGreaterThan(0);
  });

  it("returns ScoreResult with correct score and gates", async () => {
    const result = await runAllChecks(sampleHtml, "https://example.com/test");

    expect(result.score).toBeDefined();
    expect(typeof result.score.score).toBe("number");
    expect(result.score.score).toBeGreaterThanOrEqual(0);
    expect(result.score.score).toBeLessThanOrEqual(100);

    expect(result.score.gates).toBeInstanceOf(Array);
    expect(result.score.breakdown).toBeDefined();
    expect(result.score.breakdown).toHaveProperty("tier1");
    expect(result.score.breakdown).toHaveProperty("tier2");
    expect(result.score.breakdown).toHaveProperty("tier3");
    // tier4 is optional in new scoring model
  });

  it("respects tier filtering options", async () => {
    const tiers: CheckTier[] = [1, 2];
    const result = await runAllChecks(sampleHtml, "https://example.com/test", {
      tiers,
    });

    expect(result.results).toBeInstanceOf(Array);
    // Should only have T1 and T2 checks (27 + 25 = 52)
    expect(result.results.length).toBe(52);

    // All results should be from tier 1 or 2
    for (const check of result.results) {
      const tier = parseInt(check.checkId.split("-")[0].replace("T", ""));
      expect(tiers).toContain(tier);
    }
  });

  it("detects critical issues in minimal HTML", async () => {
    const result = await runAllChecks(minimalHtml, "https://example.com/test");

    // Should have gates for missing critical elements
    expect(result.score.gates.length).toBeGreaterThan(0);

    // Find checks for missing title, meta description, H1
    const titleCheck = result.results.find(
      (r: CheckResult) => r.checkId === "T1-01"
    );
    const metaCheck = result.results.find(
      (r: CheckResult) => r.checkId === "T1-02"
    );
    const h1Check = result.results.find(
      (r: CheckResult) => r.checkId === "T1-03"
    );

    expect(titleCheck?.passed).toBe(false);
    expect(metaCheck?.passed).toBe(false);
    expect(h1Check?.passed).toBe(false);
  });

  it("marks passing checks for well-formed HTML", async () => {
    const result = await runAllChecks(sampleHtml, "https://example.com/test");

    // Title check should pass
    const titleCheck = result.results.find(
      (r: CheckResult) => r.checkId === "T1-01"
    );
    expect(titleCheck?.passed).toBe(true);

    // Meta description check should pass
    const metaCheck = result.results.find(
      (r: CheckResult) => r.checkId === "T1-02"
    );
    expect(metaCheck?.passed).toBe(true);

    // H1 check should pass
    const h1Check = result.results.find(
      (r: CheckResult) => r.checkId === "T1-03"
    );
    expect(h1Check?.passed).toBe(true);
  });
});
