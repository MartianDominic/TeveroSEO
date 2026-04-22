import { describe, it, expect } from "vitest";
import { runAllChecks } from "./facade";
import type { CheckTier } from "./types";

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

describe("runAllChecks", () => {
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
      (r) =>
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
    expect(result.score.breakdown).toHaveProperty("tier4");
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
    const titleCheck = result.results.find((r) => r.checkId === "T1-01");
    const metaCheck = result.results.find((r) => r.checkId === "T1-02");
    const h1Check = result.results.find((r) => r.checkId === "T1-03");

    expect(titleCheck?.passed).toBe(false);
    expect(metaCheck?.passed).toBe(false);
    expect(h1Check?.passed).toBe(false);
  });

  it("marks passing checks for well-formed HTML", async () => {
    const result = await runAllChecks(sampleHtml, "https://example.com/test");

    // Title check should pass
    const titleCheck = result.results.find((r) => r.checkId === "T1-01");
    expect(titleCheck?.passed).toBe(true);

    // Meta description check should pass
    const metaCheck = result.results.find((r) => r.checkId === "T1-02");
    expect(metaCheck?.passed).toBe(true);

    // H1 check should pass
    const h1Check = result.results.find((r) => r.checkId === "T1-03");
    expect(h1Check?.passed).toBe(true);
  });
});
