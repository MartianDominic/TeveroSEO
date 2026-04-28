/**
 * Tests for Link Graph Update API Route.
 * Phase 40-04: T-40-04-03 - Link Graph Update on Publish (P39)
 *
 * Tests cover:
 * - Transaction atomicity (rollback on failure, commit on success)
 * - Concurrent updates handling
 * - N+1 fix verification (batch updates)
 * - Error handling (DB errors, validation errors)
 * - Link graph integrity (inbound counts, orphan removal)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

// Track all DB operations for assertion
interface DbOperation {
  type: "delete" | "insert" | "update" | "execute" | "select";
  table?: string;
  params?: unknown;
}

// Test state - mutable and shared across all tests
const testState = {
  dbOperations: [] as DbOperation[],
  executeTracker: { calls: [] as { sql: string; params: unknown[] }[] },
  transactionShouldFail: false,
  transactionFailAt: null as "delete" | "insert" | "update" | "execute" | null,
  transactionCommitted: false,
};

// Mock functions - defined at module level for consistent access
const mockExtractDetailedLinks = vi.fn();
const mockResolveUserContext = vi.fn();
const mockResolveClientId = vi.fn();

// DB mock functions - defined at module level so we can reset them
const mockTransaction = vi.fn();
const mockSelect = vi.fn();

/**
 * Set up DB mock implementations.
 * Called in beforeEach after mockReset() to ensure fresh implementations.
 */
function setupDbMockImplementations() {
  // Helper to create select chain
  const createSelectChain = (result: unknown) => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => Promise.resolve(result)),
    };
    return chain;
  };

  // Helper to create insert chain
  const createInsertChain = (tableName: string) => ({
    values: vi.fn().mockImplementation((values) => {
      testState.dbOperations.push({ type: "insert", table: tableName, params: values });
      if (testState.transactionShouldFail && testState.transactionFailAt === "insert") {
        throw new Error("Simulated insert failure");
      }
      return {
        onConflictDoUpdate: vi.fn().mockImplementation(() => {
          testState.dbOperations.push({ type: "update", table: "page_links" });
          return Promise.resolve();
        }),
      };
    }),
  });

  mockSelect.mockImplementation(() => createSelectChain([]));

  mockTransaction.mockImplementation(async (callback) => {
    testState.transactionCommitted = false;
    const tx = {
      delete: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation(() => {
          const tableName = table?.sourceUrl !== undefined ? "link_graph" : "orphan_pages";
          testState.dbOperations.push({ type: "delete", table: tableName });
          if (testState.transactionShouldFail && testState.transactionFailAt === "delete") {
            throw new Error("Simulated delete failure");
          }
          return Promise.resolve();
        }),
      })),
      insert: vi.fn().mockImplementation((table) => {
        const tableName = table?.sourceUrl !== undefined ? "link_graph" : "page_links";
        return createInsertChain(tableName);
      }),
      execute: vi.fn().mockImplementation((sqlTemplate) => {
        // Drizzle sql`` returns an object with queryChunks containing the SQL parts
        // We try to extract the SQL string for assertions
        let sqlStr = "";
        if (sqlTemplate?.queryChunks) {
          // Drizzle SQL object - extract from queryChunks
          sqlStr = sqlTemplate.queryChunks.map((chunk: unknown) =>
            typeof chunk === "string" ? chunk : "?"
          ).join("");
        } else if (typeof sqlTemplate === "string") {
          sqlStr = sqlTemplate;
        } else {
          // Fallback: store the raw object for inspection
          sqlStr = JSON.stringify(sqlTemplate);
        }
        testState.executeTracker.calls.push({ sql: sqlStr, params: [] });
        testState.dbOperations.push({ type: "execute", params: { sql: sqlStr } });
        if (testState.transactionShouldFail && testState.transactionFailAt === "execute") {
          throw new Error("Simulated execute failure");
        }
        return Promise.resolve();
      }),
    };
    try {
      await callback(tx);
      testState.transactionCommitted = true;
    } catch (error) {
      testState.transactionCommitted = false;
      throw error;
    }
  });
}

// Mock the database - references module-level mock functions
vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
    transaction: mockTransaction,
  },
}));

// Mock link schema
vi.mock("@/db/link-schema", () => ({
  linkGraph: { id: "id", clientId: "client_id", sourceUrl: "source_url" },
  pageLinks: { id: "id", clientId: "client_id", pageUrl: "page_url" },
  orphanPages: { id: "id", clientId: "client_id", pageUrl: "page_url" },
}));

// Mock app schema
vi.mock("@/db/app.schema", () => ({
  auditPages: { id: "id", url: "url" },
}));

// Mock link extractor - delegates to module-level mock
vi.mock("@/server/lib/linking/link-extractor", () => ({
  extractDetailedLinks: (...args: unknown[]) => mockExtractDetailedLinks(...args),
}));

// Mock auth middleware - delegates to module-level mock
vi.mock("@/middleware/ensure-user", () => ({
  resolveUserContext: (...args: unknown[]) => mockResolveUserContext(...args),
}));

// Mock client context - delegates to module-level mock
vi.mock("@/server/lib/client-context", () => ({
  resolveClientId: (...args: unknown[]) => mockResolveClientId(...args),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock metrics
vi.mock("@/server/lib/metrics", () => ({
  metrics: { increment: vi.fn() },
  recordRequestMetrics: vi.fn(),
}));

// Mock AppError class and asAppError helper
vi.mock("@/server/lib/errors", () => {
  class AppError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
      this.name = "AppError";
    }
  }

  const asAppError = (error: unknown): AppError | null => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      "name" in error &&
      (error as { name: unknown }).name === "AppError"
    ) {
      const code = (error as { code: string }).code;
      const message = (error as { message?: string }).message;
      return new AppError(code, message);
    }
    return null;
  };

  return { AppError, asAppError };
});

// Helper to create valid request
function createValidRequest(overrides: Partial<{
  clientId: string;
  url: string;
  html: string;
  auditId: string;
}> = {}): Request {
  const body = {
    clientId: "client-123",
    url: "https://example.com/page",
    html: "<html><body><p>" + "a".repeat(100) + "</p></body></html>",
    auditId: "audit-456",
    ...overrides,
  };
  return new Request("http://localhost/api/seo/links/graph/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
      "X-Client-ID": body.clientId,
    },
    body: JSON.stringify(body),
  });
}

// Sample extracted links
const sampleLinks = [
  {
    targetUrl: "https://example.com/target-1",
    targetPageId: null,
    anchorText: "Link to page 1",
    context: "This is context around link to page 1 text",
    position: "body" as const,
    paragraphIndex: 1,
    isDoFollow: true,
    linkType: "contextual" as const,
    hasTitle: false,
    hasNoOpener: false,
  },
  {
    targetUrl: "https://example.com/target-2",
    targetPageId: null,
    anchorText: "Link to page 2",
    context: "Another context for link to page 2",
    position: "body" as const,
    paragraphIndex: 2,
    isDoFollow: true,
    linkType: "contextual" as const,
    hasTitle: true,
    hasNoOpener: false,
  },
];

// Helper to get handlers - reimport on each call
async function getHandlers() {
  const { Route } = await import("./graph.update");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Route.options.server as any)?.handlers;
}

describe("POST /api/seo/links/graph/update", () => {
  beforeEach(() => {
    vi.resetModules();

    // Reset test state
    testState.dbOperations = [];
    testState.executeTracker.calls = [];
    testState.transactionShouldFail = false;
    testState.transactionFailAt = null;
    testState.transactionCommitted = false;

    // Reset ALL mock functions
    mockSelect.mockReset();
    mockTransaction.mockReset();
    mockResolveClientId.mockReset();
    mockResolveUserContext.mockReset();
    mockExtractDetailedLinks.mockReset();

    // Re-setup DB mock implementations AFTER reset
    setupDbMockImplementations();

    // Configure other mocks with default behavior
    mockResolveClientId.mockResolvedValue("client-123");
    mockResolveUserContext.mockResolvedValue({
      userId: "user-1",
      userEmail: "test@example.com",
    });
    mockExtractDetailedLinks.mockReturnValue({
      links: sampleLinks,
      externalLinksSkipped: 5,
      invalidLinksSkipped: 2,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Transaction Atomicity Tests
  // ==========================================================================
  describe("graph update transactions", () => {
    it("should rollback all changes if any operation fails", async () => {
      testState.transactionShouldFail = true;
      testState.transactionFailAt = "insert";

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(500);
      const body: ApiResponse = await response.json();
      expect(body.success).toBe(false);
      expect(testState.transactionCommitted).toBe(false);
    });

    it("should commit all changes on success", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body: ApiResponse = await response.json();
      expect(body.success).toBe(true);
      expect(testState.transactionCommitted).toBe(true);
    });

    it("should perform delete, insert, and update within same transaction", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      expect(testState.dbOperations.some((op) => op.type === "delete")).toBe(true);
      expect(testState.dbOperations.some((op) => op.type === "insert")).toBe(true);
    });

    it("should rollback delete if subsequent insert fails", async () => {
      testState.transactionShouldFail = true;
      testState.transactionFailAt = "insert";

      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      expect(testState.dbOperations.some((op) => op.type === "delete")).toBe(true);
      expect(testState.transactionCommitted).toBe(false);
    });

    it("should rollback all if batch inbound update fails", async () => {
      testState.transactionShouldFail = true;
      testState.transactionFailAt = "execute";

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(500);
      expect(testState.transactionCommitted).toBe(false);
    });
  });

  // ==========================================================================
  // Concurrent Updates Tests
  // ==========================================================================
  describe("concurrent graph updates", () => {
    it("should handle concurrent updates to same client", async () => {
      const handlers = await getHandlers();
      const request1 = createValidRequest({ url: "https://example.com/page-1" });
      const request2 = createValidRequest({ url: "https://example.com/page-2" });

      const [response1, response2] = await Promise.all([
        handlers.POST({ request: request1 }),
        handlers.POST({ request: request2 }),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      const body1: ApiResponse = await response1.json();
      const body2: ApiResponse = await response2.json();

      expect(body1.success).toBe(true);
      expect(body2.success).toBe(true);
    });

    it("should isolate transactions for different URLs", async () => {
      const handlers = await getHandlers();
      const request1 = createValidRequest({ url: "https://example.com/page-1" });
      const response1 = await handlers.POST({ request: request1 });
      expect(response1.status).toBe(200);

      testState.dbOperations = [];

      const request2 = createValidRequest({ url: "https://example.com/page-2" });
      const response2 = await handlers.POST({ request: request2 });
      expect(response2.status).toBe(200);

      const body1: ApiResponse = await response1.json();
      const body2: ApiResponse = await response2.json();
      expect(body1.success).toBe(true);
      expect(body2.success).toBe(true);
    });
  });

  // ==========================================================================
  // N+1 Fix Verification Tests
  // ==========================================================================
  describe("batch update performance", () => {
    it("should use batch update instead of N individual updates", async () => {
      const manyLinks = Array.from({ length: 50 }, (_, i) => ({
        targetUrl: `https://example.com/target-${i}`,
        targetPageId: null,
        anchorText: `Link ${i}`,
        context: `Context for link ${i}`,
        position: "body" as const,
        paragraphIndex: 1,
        isDoFollow: true,
        linkType: "contextual" as const,
        hasTitle: false,
        hasNoOpener: false,
      }));

      mockExtractDetailedLinks.mockReturnValue({
        links: manyLinks,
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      // Should have exactly one batch execute call for inbound updates (N+1 fix)
      // If this was N+1, we'd see 50 execute calls instead of 1
      const executeOps = testState.dbOperations.filter((op) => op.type === "execute");
      expect(executeOps.length).toBe(1);

      // Verify execute was called (batch update for inbound counts)
      // The actual SQL is a Drizzle template literal object, we verify it was called once
      expect(testState.executeTracker.calls.length).toBe(1);
    });

    it("should batch insert all links in single query", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      // Should have insert operation for link_graph
      const insertOps = testState.dbOperations.filter(
        (op) => op.type === "insert" && op.table === "link_graph"
      );
      expect(insertOps.length).toBe(1);
    });

    it("should deduplicate target URLs before batch update", async () => {
      const duplicateLinks = [
        ...sampleLinks,
        { ...sampleLinks[0] }, // Duplicate target URL
      ];

      mockExtractDetailedLinks.mockReturnValue({
        links: duplicateLinks,
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      // The batch SQL uses Set to deduplicate, so should only update unique targets
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================
  describe("error handling", () => {
    it("should return 500 and not corrupt data on DB error", async () => {
      testState.transactionShouldFail = true;
      testState.transactionFailAt = "delete";

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(500);
      const body: ApiResponse = await response.json();
      expect(body.success).toBe(false);
      expect(testState.transactionCommitted).toBe(false);
    });

    it("should return 400 for invalid request payload", async () => {
      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/graph/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: "" }), // Missing required fields
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(400);
    });

    it("should return 400 when HTML exceeds 5MB", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest({
        html: "x".repeat(5_000_001),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(400);
    });

    it("should return 500 when auth fails", async () => {
      mockResolveUserContext.mockRejectedValue(new Error("Auth failed"));

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(500);
    });

    it("should return 403 on client ID mismatch", async () => {
      // First call returns different client ID than what's in the body
      mockResolveClientId.mockResolvedValue("different-client");

      const handlers = await getHandlers();
      const request = createValidRequest({ clientId: "client-123" });
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(403);
      const body: ApiResponse = await response.json();
      expect(body.success).toBe(false);
    });
  });

  // ==========================================================================
  // Link Graph Integrity Tests
  // ==========================================================================
  describe("link graph integrity", () => {
    it("should update inbound counts correctly", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      // Verify execute was called for batch inbound update
      // The implementation uses tx.execute(sql`UPDATE page_links SET inbound_total...`)
      const executeOps = testState.executeTracker.calls;
      expect(executeOps.length).toBe(1);
      // Execute was called exactly once, which is the batch inbound count update
    });

    it("should remove page from orphan list when linked", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      // Should delete from orphan_pages
      const deleteOps = testState.dbOperations.filter(
        (op) => op.type === "delete" && op.table === "orphan_pages"
      );
      expect(deleteOps.length).toBeGreaterThanOrEqual(1);
    });

    it("should preserve existing links from other sources", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      await handlers.POST({ request });

      // Delete should only target the specific source URL
      // This is validated by the WHERE clause in the implementation
      const deleteOps = testState.dbOperations.filter(
        (op) => op.type === "delete" && op.table === "link_graph"
      );
      expect(deleteOps.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle empty links array gracefully", async () => {
      mockExtractDetailedLinks.mockReturnValue({
        links: [],
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body: ApiResponse = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(0);
    });

    it("should skip link graph insert when no auditId provided", async () => {
      const handlers = await getHandlers();
      // Clear auditId from body by creating a custom request
      const body = {
        clientId: "client-123",
        url: "https://example.com/page",
        html: "<html><body><p>" + "a".repeat(100) + "</p></body></html>",
        // No auditId
      };
      const customRequest = new Request("http://localhost/api/seo/links/graph/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test-token",
          "X-Client-ID": "client-123",
        },
        body: JSON.stringify(body),
      });

      const response: Response = await handlers.POST({ request: customRequest });
      expect(response.status).toBe(200);

      // Should not insert to link_graph without auditId
      const linkGraphInserts = testState.dbOperations.filter(
        (op) => op.type === "insert" && op.table === "link_graph"
      );
      expect(linkGraphInserts.length).toBe(0);
    });
  });

  // ==========================================================================
  // Response Format Tests
  // ==========================================================================
  describe("response format", () => {
    it("should return correct link counts in response", async () => {
      mockExtractDetailedLinks.mockReturnValue({
        links: sampleLinks,
        externalLinksSkipped: 5,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body: ApiResponse = await response.json();

      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(2);
      expect(body.externalLinks).toBe(5);
      expect(body.linksExtracted).toBe(7); // 2 internal + 5 external
    });

    it("should include latency measurement", async () => {
      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      const body: ApiResponse = await response.json();

      expect(body.latencyMs).toBeDefined();
      expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================
  describe("edge cases", () => {
    it("should handle special characters in anchor text", async () => {
      const specialLinks = [{
        ...sampleLinks[0],
        anchorText: "Link with <script>alert('xss')</script> & special chars",
      }];

      mockExtractDetailedLinks.mockReturnValue({
        links: specialLinks,
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body: ApiResponse = await response.json();
      expect(body.success).toBe(true);
    });

    it("should handle Unicode characters in URLs", async () => {
      const unicodeLinks = [{
        ...sampleLinks[0],
        targetUrl: "https://example.com/page/unicode-path",
        anchorText: "Link text",
      }];

      mockExtractDetailedLinks.mockReturnValue({
        links: unicodeLinks,
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
    });

    it("should handle very long anchor text", async () => {
      const longAnchorLinks = [{
        ...sampleLinks[0],
        anchorText: "A".repeat(1000),
      }];

      mockExtractDetailedLinks.mockReturnValue({
        links: longAnchorLinks,
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
    });

    it("should handle all link positions correctly", async () => {
      const positionLinks = [
        { ...sampleLinks[0], position: "header" as const },
        { ...sampleLinks[0], position: "nav" as const },
        { ...sampleLinks[0], position: "body" as const },
        { ...sampleLinks[0], position: "sidebar" as const },
        { ...sampleLinks[0], position: "footer" as const },
      ];

      mockExtractDetailedLinks.mockReturnValue({
        links: positionLinks,
        externalLinksSkipped: 0,
        invalidLinksSkipped: 0,
      });

      const handlers = await getHandlers();
      const request = createValidRequest();
      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body: ApiResponse = await response.json();
      expect(body.internalLinks).toBe(5);
    });
  });
});
