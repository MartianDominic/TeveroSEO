/**
 * Findings Repository
 *
 * Handles persistence and retrieval of SEO audit findings.
 * Supports both in-memory storage (for testing) and API-based storage.
 */

import type { CheckResult, CheckSeverity, CheckCategory, CheckTier } from "../checks/types";
import { getCheckById, getTierFromCheckId } from "../checks";

/**
 * Audit Finding entity
 */
export interface AuditFinding {
  id: string;
  auditId: string;
  pageId: string;
  checkId: string;
  tier: CheckTier;
  category: CheckCategory;
  passed: boolean;
  severity: CheckSeverity;
  message: string;
  details?: Record<string, unknown>;
  autoEditable: boolean;
  editRecipe?: string;
  createdAt: Date;
}

/**
 * Repository interface for audit findings
 */
export interface FindingsRepository {
  /**
   * Insert multiple findings for a page
   */
  insertFindings(
    auditId: string,
    pageId: string,
    results: CheckResult[]
  ): Promise<void>;

  /**
   * Get all findings for an audit
   */
  getFindingsByAudit(auditId: string): Promise<AuditFinding[]>;

  /**
   * Get findings for a specific page within an audit
   */
  getFindingsByPage(auditId: string, pageId: string): Promise<AuditFinding[]>;

  /**
   * Get findings filtered by severity
   */
  getFindingsBySeverity(
    auditId: string,
    severity: CheckSeverity
  ): Promise<AuditFinding[]>;

  /**
   * Get only failed findings for an audit
   */
  getFailedFindingsByAudit(auditId: string): Promise<AuditFinding[]>;

  /**
   * Delete all findings for an audit
   */
  deleteFindingsByAudit(auditId: string): Promise<void>;
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `finding_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Convert CheckResult to AuditFinding
 */
function checkResultToFinding(
  auditId: string,
  pageId: string,
  result: CheckResult
): AuditFinding {
  const checkDef = getCheckById(result.checkId);
  const tier = getTierFromCheckId(result.checkId);

  return {
    id: generateId(),
    auditId,
    pageId,
    checkId: result.checkId,
    tier,
    category: checkDef?.category ?? "technical",
    passed: result.passed,
    severity: result.severity,
    message: result.message,
    details: result.details,
    autoEditable: result.autoEditable,
    editRecipe: result.editRecipe,
    createdAt: new Date(),
  };
}

/**
 * In-memory implementation for testing
 */
class InMemoryFindingsRepository implements FindingsRepository {
  private findings: AuditFinding[] = [];

  async insertFindings(
    auditId: string,
    pageId: string,
    results: CheckResult[]
  ): Promise<void> {
    const newFindings = results.map((result) =>
      checkResultToFinding(auditId, pageId, result)
    );
    this.findings.push(...newFindings);
  }

  async getFindingsByAudit(auditId: string): Promise<AuditFinding[]> {
    return this.findings.filter((f) => f.auditId === auditId);
  }

  async getFindingsByPage(
    auditId: string,
    pageId: string
  ): Promise<AuditFinding[]> {
    return this.findings.filter(
      (f) => f.auditId === auditId && f.pageId === pageId
    );
  }

  async getFindingsBySeverity(
    auditId: string,
    severity: CheckSeverity
  ): Promise<AuditFinding[]> {
    return this.findings.filter(
      (f) => f.auditId === auditId && f.severity === severity
    );
  }

  async getFailedFindingsByAudit(auditId: string): Promise<AuditFinding[]> {
    return this.findings.filter(
      (f) => f.auditId === auditId && !f.passed
    );
  }

  async deleteFindingsByAudit(auditId: string): Promise<void> {
    this.findings = this.findings.filter((f) => f.auditId !== auditId);
  }
}

/**
 * Create an in-memory repository instance (for testing)
 */
export function createInMemoryFindingsRepository(): FindingsRepository {
  return new InMemoryFindingsRepository();
}

/**
 * API-based implementation (for production)
 * This will be used when integrated with the actual backend
 */
class ApiFindingsRepository implements FindingsRepository {
  constructor(private baseUrl: string) {}

  async insertFindings(
    auditId: string,
    pageId: string,
    results: CheckResult[]
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/audit/findings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auditId,
        pageId,
        results,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to insert findings: ${response.statusText}`);
    }
  }

  async getFindingsByAudit(auditId: string): Promise<AuditFinding[]> {
    const response = await fetch(
      `${this.baseUrl}/api/audit/findings?auditId=${auditId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  }

  async getFindingsByPage(
    auditId: string,
    pageId: string
  ): Promise<AuditFinding[]> {
    const response = await fetch(
      `${this.baseUrl}/api/audit/findings?auditId=${auditId}&pageId=${pageId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  }

  async getFindingsBySeverity(
    auditId: string,
    severity: CheckSeverity
  ): Promise<AuditFinding[]> {
    const response = await fetch(
      `${this.baseUrl}/api/audit/findings?auditId=${auditId}&severity=${severity}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  }

  async getFailedFindingsByAudit(auditId: string): Promise<AuditFinding[]> {
    const response = await fetch(
      `${this.baseUrl}/api/audit/findings?auditId=${auditId}&passed=false`
    );

    if (!response.ok) {
      throw new Error(`Failed to get findings: ${response.statusText}`);
    }

    return response.json();
  }

  async deleteFindingsByAudit(auditId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/audit/findings?auditId=${auditId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete findings: ${response.statusText}`);
    }
  }
}

/**
 * Create an API-based repository instance (for production)
 */
export function createApiFindingsRepository(
  baseUrl: string
): FindingsRepository {
  return new ApiFindingsRepository(baseUrl);
}

/**
 * Create the appropriate findings repository based on environment.
 * In production, ALWAYS returns API repository.
 * InMemory is ONLY used in test environment.
 */
export function createFindingsRepository(baseUrl?: string): FindingsRepository {
  if (process.env.NODE_ENV === "test") {
    return new InMemoryFindingsRepository();
  }
  // ALWAYS use API repository in production/development
  if (!baseUrl) {
    throw new Error(
      "baseUrl is required for FindingsRepository in non-test environments"
    );
  }
  return new ApiFindingsRepository(baseUrl);
}
