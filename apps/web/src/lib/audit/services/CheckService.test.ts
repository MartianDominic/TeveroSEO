import { describe, it, expect, beforeEach, vi } from "vitest";
import { CheckService, createCheckService } from "./CheckService";
import { createInMemoryFindingsRepository } from "../repositories";
import type { FindingsRepository } from "../repositories";

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
<body><p>Minimal content</p></body>
</html>
`;

describe("CheckService", () => {
  let service: CheckService;
  let repository: FindingsRepository;

  beforeEach(() => {
    repository = createInMemoryFindingsRepository();
    service = createCheckService(repository);
  });

  describe("runPageChecks", () => {
    it("executes checks and returns score", async () => {
      const result = await service.runPageChecks({
        auditId: "audit-1",
        pageId: "page-1",
        url: "https://example.com/test",
        html: sampleHtml,
      });

      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      expect(typeof result.score.score).toBe("number");
      expect(result.score.score).toBeGreaterThanOrEqual(0);
      expect(result.score.score).toBeLessThanOrEqual(100);
      expect(result.resultCount).toBe(107);
    });

    it("persists findings via FindingsRepository", async () => {
      await service.runPageChecks({
        auditId: "audit-1",
        pageId: "page-1",
        url: "https://example.com/test",
        html: sampleHtml,
      });

      const findings = await repository.getFindingsByAudit("audit-1");
      expect(findings.length).toBe(107);
    });

    it("includes keyword in checks when provided", async () => {
      await service.runPageChecks({
        auditId: "audit-1",
        pageId: "page-1",
        url: "https://example.com/test",
        html: sampleHtml,
        keyword: "test page",
      });

      const findings = await repository.getFindingsByAudit("audit-1");
      expect(findings.length).toBe(107);

      // Keyword checks should have relevant details
      const keywordCheck = findings.find((f) => f.checkId === "T1-07");
      expect(keywordCheck).toBeDefined();
    });

    it("returns lower score for minimal HTML", async () => {
      const goodResult = await service.runPageChecks({
        auditId: "audit-1",
        pageId: "page-1",
        url: "https://example.com/test",
        html: sampleHtml,
      });

      // Create new repository and service for the second test
      const repository2 = createInMemoryFindingsRepository();
      const service2 = createCheckService(repository2);

      const badResult = await service2.runPageChecks({
        auditId: "audit-2",
        pageId: "page-1",
        url: "https://example.com/test",
        html: minimalHtml,
      });

      expect(badResult.score.score).toBeLessThan(goodResult.score.score);
    });
  });

  describe("runAuditChecks", () => {
    it("runs checks for all pages in audit", async () => {
      const pages = [
        { pageId: "page-1", url: "https://example.com/page1", html: sampleHtml },
        { pageId: "page-2", url: "https://example.com/page2", html: sampleHtml },
        { pageId: "page-3", url: "https://example.com/page3", html: minimalHtml },
      ];

      const scores = await service.runAuditChecks("audit-1", pages);

      expect(scores.size).toBe(3);
      expect(scores.has("page-1")).toBe(true);
      expect(scores.has("page-2")).toBe(true);
      expect(scores.has("page-3")).toBe(true);

      // All findings should be persisted
      const findings = await repository.getFindingsByAudit("audit-1");
      expect(findings.length).toBe(107 * 3); // 107 checks * 3 pages
    });

    it("returns map of pageId to score", async () => {
      const pages = [
        { pageId: "page-1", url: "https://example.com/page1", html: sampleHtml },
        { pageId: "page-2", url: "https://example.com/page2", html: minimalHtml },
      ];

      const scores = await service.runAuditChecks("audit-1", pages);

      const page1Score = scores.get("page-1");
      const page2Score = scores.get("page-2");

      expect(page1Score).toBeDefined();
      expect(page2Score).toBeDefined();
      expect(page1Score!.score).toBeGreaterThan(page2Score!.score);
    });

    it("passes keyword to all page checks", async () => {
      const pages = [
        { pageId: "page-1", url: "https://example.com/page1", html: sampleHtml },
      ];

      await service.runAuditChecks("audit-1", pages, "test page");

      const findings = await repository.getFindingsByPage("audit-1", "page-1");

      // Check that keyword-related checks were run
      const keywordCheck = findings.find((f) => f.checkId === "T1-07");
      expect(keywordCheck).toBeDefined();
    });
  });

  describe("getAuditScore", () => {
    it("aggregates scores across pages", async () => {
      const pages = [
        { pageId: "page-1", url: "https://example.com/page1", html: sampleHtml },
        { pageId: "page-2", url: "https://example.com/page2", html: sampleHtml },
      ];

      await service.runAuditChecks("audit-1", pages);

      const auditScore = await service.getAuditScore("audit-1");

      expect(auditScore).toBeDefined();
      expect(typeof auditScore.averageScore).toBe("number");
      expect(auditScore.averageScore).toBeGreaterThanOrEqual(0);
      expect(auditScore.averageScore).toBeLessThanOrEqual(100);
    });

    it("returns score breakdown by page", async () => {
      const pages = [
        { pageId: "page-1", url: "https://example.com/page1", html: sampleHtml },
        { pageId: "page-2", url: "https://example.com/page2", html: minimalHtml },
      ];

      await service.runAuditChecks("audit-1", pages);

      const auditScore = await service.getAuditScore("audit-1");

      expect(auditScore.byPage.size).toBe(2);
      expect(auditScore.byPage.has("page-1")).toBe(true);
      expect(auditScore.byPage.has("page-2")).toBe(true);
    });

    it("returns score breakdown by severity", async () => {
      const pages = [
        { pageId: "page-1", url: "https://example.com/page1", html: minimalHtml },
      ];

      await service.runAuditChecks("audit-1", pages);

      const auditScore = await service.getAuditScore("audit-1");

      expect(auditScore.bySeverity).toBeDefined();
      expect(typeof auditScore.bySeverity.critical).toBe("number");
      expect(typeof auditScore.bySeverity.high).toBe("number");
      expect(typeof auditScore.bySeverity.medium).toBe("number");
      expect(typeof auditScore.bySeverity.low).toBe("number");
    });
  });

  describe("clearAuditFindings", () => {
    it("deletes all findings for an audit", async () => {
      await service.runPageChecks({
        auditId: "audit-1",
        pageId: "page-1",
        url: "https://example.com/test",
        html: sampleHtml,
      });

      let findings = await repository.getFindingsByAudit("audit-1");
      expect(findings.length).toBe(107);

      await service.clearAuditFindings("audit-1");

      findings = await repository.getFindingsByAudit("audit-1");
      expect(findings.length).toBe(0);
    });
  });
});
