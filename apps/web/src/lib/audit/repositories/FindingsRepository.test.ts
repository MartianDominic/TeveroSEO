import { describe, it, expect, beforeEach } from "vitest";
import {
  FindingsRepository,
  createInMemoryFindingsRepository,
} from "./FindingsRepository";
import type { CheckResult, CheckSeverity } from "../checks/types";

// Mock check results
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
    passed: false,
    severity: "critical",
    message: "Missing meta description",
    autoEditable: true,
    editRecipe: "add-meta-desc",
  },
  {
    checkId: "T2-01",
    passed: true,
    severity: "high",
    message: "Word count meets minimum",
    autoEditable: false,
  },
];

describe("FindingsRepository", () => {
  let repository: FindingsRepository;

  beforeEach(() => {
    repository = createInMemoryFindingsRepository();
  });

  describe("insertFindings", () => {
    it("batch inserts CheckResult[] to audit_findings", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const findings = await repository.getFindingsByAudit("audit-1");
      expect(findings).toHaveLength(3);
    });

    it("maps CheckResult to AuditFinding correctly", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const findings = await repository.getFindingsByAudit("audit-1");
      const titleFinding = findings.find((f) => f.checkId === "T1-01");

      expect(titleFinding).toBeDefined();
      expect(titleFinding?.auditId).toBe("audit-1");
      expect(titleFinding?.pageId).toBe("page-1");
      expect(titleFinding?.passed).toBe(true);
      expect(titleFinding?.severity).toBe("critical");
      expect(titleFinding?.message).toBe("Title tag is present");
      expect(titleFinding?.autoEditable).toBe(true);
      expect(titleFinding?.editRecipe).toBe("add-title");
      expect(titleFinding?.tier).toBe(1);
      expect(titleFinding?.category).toBe("title");
    });

    it("extracts tier from checkId", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const findings = await repository.getFindingsByAudit("audit-1");

      const t1Finding = findings.find((f) => f.checkId === "T1-01");
      const t2Finding = findings.find((f) => f.checkId === "T2-01");

      expect(t1Finding?.tier).toBe(1);
      expect(t2Finding?.tier).toBe(2);
    });

    it("extracts category from check definition", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const findings = await repository.getFindingsByAudit("audit-1");

      const titleFinding = findings.find((f) => f.checkId === "T1-01");
      const metaFinding = findings.find((f) => f.checkId === "T1-02");
      const contentFinding = findings.find((f) => f.checkId === "T2-01");

      expect(titleFinding?.category).toBe("title");
      expect(metaFinding?.category).toBe("meta");
      expect(contentFinding?.category).toBe("content");
    });

    it("generates unique IDs for each finding", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const findings = await repository.getFindingsByAudit("audit-1");
      const ids = findings.map((f) => f.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(findings.length);
    });
  });

  describe("getFindingsByAudit", () => {
    it("returns all findings for an audit", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);
      await repository.insertFindings("audit-1", "page-2", mockCheckResults);
      await repository.insertFindings("audit-2", "page-1", mockCheckResults);

      const audit1Findings = await repository.getFindingsByAudit("audit-1");
      const audit2Findings = await repository.getFindingsByAudit("audit-2");

      expect(audit1Findings).toHaveLength(6); // 3 + 3
      expect(audit2Findings).toHaveLength(3);
    });

    it("returns empty array for non-existent audit", async () => {
      const findings = await repository.getFindingsByAudit("non-existent");
      expect(findings).toHaveLength(0);
    });
  });

  describe("getFindingsByPage", () => {
    it("returns findings for a specific page", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);
      await repository.insertFindings("audit-1", "page-2", mockCheckResults);

      const page1Findings = await repository.getFindingsByPage("audit-1", "page-1");
      const page2Findings = await repository.getFindingsByPage("audit-1", "page-2");

      expect(page1Findings).toHaveLength(3);
      expect(page2Findings).toHaveLength(3);

      page1Findings.forEach((f) => expect(f.pageId).toBe("page-1"));
      page2Findings.forEach((f) => expect(f.pageId).toBe("page-2"));
    });
  });

  describe("getFindingsBySeverity", () => {
    it("filters by severity", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const criticalFindings = await repository.getFindingsBySeverity(
        "audit-1",
        "critical"
      );
      const highFindings = await repository.getFindingsBySeverity("audit-1", "high");

      expect(criticalFindings).toHaveLength(2);
      expect(highFindings).toHaveLength(1);

      criticalFindings.forEach((f) => expect(f.severity).toBe("critical"));
      highFindings.forEach((f) => expect(f.severity).toBe("high"));
    });
  });

  describe("deleteFindingsByAudit", () => {
    it("removes all findings for an audit", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);
      await repository.insertFindings("audit-2", "page-1", mockCheckResults);

      await repository.deleteFindingsByAudit("audit-1");

      const audit1Findings = await repository.getFindingsByAudit("audit-1");
      const audit2Findings = await repository.getFindingsByAudit("audit-2");

      expect(audit1Findings).toHaveLength(0);
      expect(audit2Findings).toHaveLength(3); // Untouched
    });
  });

  describe("getFailedFindingsByAudit", () => {
    it("returns only failed findings", async () => {
      await repository.insertFindings("audit-1", "page-1", mockCheckResults);

      const failedFindings = await repository.getFailedFindingsByAudit("audit-1");

      expect(failedFindings).toHaveLength(1);
      expect(failedFindings[0]?.checkId).toBe("T1-02");
      expect(failedFindings[0]?.passed).toBe(false);
    });
  });
});
