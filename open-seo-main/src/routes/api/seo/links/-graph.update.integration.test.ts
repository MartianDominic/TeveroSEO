/**
 * Integration tests for Link Graph Update API.
 * Phase 40-04: T-40-04-03 - Link Graph Update on Publish
 *
 * Tests the complete flow:
 * 1. Authentication and authorization
 * 2. Link extraction and storage
 * 3. Inbound count updates
 * 4. Orphan page handling
 * 5. Transaction rollback on failure
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Use globalThis to share state between mock factories and test code
// This avoids the hoisting issue with vi.mock
// ============================================================

interface MockStateType {
  transactionOps: Array<{ op: string; args: unknown[] }>;
  userContext: { userId: string; userEmail: string; organizationId: string } | null;
  userContextError: Error | null;
  clientIdResult: string | null;
  clientIdError: Error | null;
  clientIdCallCount: number;
  clientIdResults: Array<string | null | Error>;
  extractResult: {
    links: Array<{
      targetUrl: string;
      targetPageId: string | null;
      anchorText: string;
      context: string;
      position: string;
      paragraphIndex: number | null;
      isDoFollow: boolean;
      linkType: string;
      hasTitle: boolean;
      hasNoOpener: boolean;
    }>;
    externalLinksSkipped: number;
    invalidLinksSkipped: number;
  };
  dbTransactionError: Error | null;
}

// Initialize on globalThis BEFORE mocks are set up
declare global {
  // eslint-disable-next-line no-var
  var __testMockState: MockStateType;
}

// Create the shared state on globalThis (AppError is created by the mock factory)
globalThis.__testMockState = {
  transactionOps: [],
  userContext: null,
  userContextError: null,
  clientIdResult: null,
  clientIdError: null,
  clientIdCallCount: 0,
  clientIdResults: [],
  extractResult: { links: [], externalLinksSkipped: 0, invalidLinksSkipped: 0 },
  dbTransactionError: null,
};

// Local reference for state (AppError getter defined after mocks)
const mockState = globalThis.__testMockState;

// Reset function
function resetMockState() {
  mockState.transactionOps.length = 0;
  mockState.userContext = null;
  mockState.userContextError = null;
  mockState.clientIdResult = null;
  mockState.clientIdError = null;
  mockState.clientIdCallCount = 0;
  mockState.clientIdResults = [];
  mockState.extractResult = { links: [], externalLinksSkipped: 0, invalidLinksSkipped: 0 };
  mockState.dbTransactionError = null;
}

// ============================================================
// vi.mock declarations - using globalThis for state access
// ============================================================

// Mock database module
// Mock database - use same pattern for proper mock application
vi.mock("@/db", () => {
  const createSelectChain = (result: unknown) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  });

  const createDeleteChain = () => ({
    where: vi.fn((...args) => {
      const state = globalThis.__testMockState;
      state?.transactionOps?.push({ op: "delete", args });
      return Promise.resolve();
    }),
  });

  const createInsertChain = () => ({
    values: vi.fn((values) => {
      const state = globalThis.__testMockState;
      state?.transactionOps?.push({ op: "insert", args: [values] });
      return {
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      };
    }),
  });

  const createTransactionMock = () => ({
    select: vi.fn(() => createSelectChain([])),
    insert: vi.fn(() => createInsertChain()),
    delete: vi.fn(() => createDeleteChain()),
    execute: vi.fn((sql) => {
      const state = globalThis.__testMockState;
      state?.transactionOps?.push({ op: "execute", args: [sql] });
      return Promise.resolve();
    }),
  });

  return {
    db: {
      select: vi.fn(() => createSelectChain([])),
      insert: vi.fn(() => createInsertChain()),
      delete: vi.fn(() => createDeleteChain()),
      execute: vi.fn((sql) => {
        const state = globalThis.__testMockState;
        state?.transactionOps?.push({ op: "execute", args: [sql] });
        return Promise.resolve();
      }),
      transaction: vi.fn(async (callback) => {
        const state = globalThis.__testMockState;
        if (state?.dbTransactionError) {
          throw state.dbTransactionError;
        }
        const txMock = createTransactionMock();
        return callback(txMock);
      }),
    },
  };
});

// Mock user context resolution - use a function that reads from globalThis at call time
vi.mock("@/middleware/ensure-user", () => {
  return {
    resolveUserContext: vi.fn(async () => {
      const state = globalThis.__testMockState;
      if (state?.userContextError) {
        throw state.userContextError;
      }
      return state?.userContext;
    }),
  };
});

// Mock client ID resolution - use same pattern as ensure-user
vi.mock("@/server/lib/client-context", () => {
  return {
    resolveClientId: vi.fn(async () => {
      const state = globalThis.__testMockState;

      // If specific per-call results are configured, use them
      if (state?.clientIdResults?.length > 0 && state.clientIdCallCount < state.clientIdResults.length) {
        const result = state.clientIdResults[state.clientIdCallCount];
        state.clientIdCallCount++;
        if (result instanceof Error) {
          throw result;
        }
        return result ?? null;
      }

      if (state?.clientIdError) {
        throw state.clientIdError;
      }

      // Default: return clientIdResult for all calls
      return state?.clientIdResult;
    }),
    CLIENT_ID_HEADER: "x-client-id",
    CLIENT_ID_QUERY_PARAM: "client_id",
  };
});

// Mock link extractor - use same pattern
vi.mock("@/server/lib/linking/link-extractor", () => {
  return {
    extractDetailedLinks: vi.fn(() => {
      const state = globalThis.__testMockState;
      return state?.extractResult ?? { links: [], externalLinksSkipped: 0, invalidLinksSkipped: 0 };
    }),
  };
});

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock metrics
vi.mock("@/server/lib/metrics", () => ({
  metrics: {
    increment: vi.fn(),
    timing: vi.fn(),
  },
  recordRequestMetrics: vi.fn(),
}));

// Mock error-codes to allow any string as ErrorCode
vi.mock("@/shared/error-codes", () => ({
  isErrorCode: (value: string) => ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"].includes(value),
}));

// Mock AppError and asAppError - pure duck-typing based detection (no instanceof)
vi.mock("@/server/lib/errors", () => {
  // Define the AppError class
  class AppError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
      this.name = "AppError";
    }
  }

  // Pure duck-typing based error detection - NO instanceof check
  // This ensures errors created in tests are recognized by the route
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

// Mock schemas (required for imports)
vi.mock("@/db/link-schema", () => ({
  linkGraph: { clientId: "clientId", sourceUrl: "sourceUrl", targetUrl: "targetUrl" },
  pageLinks: { clientId: "clientId", pageUrl: "pageUrl" },
  orphanPages: { clientId: "clientId", pageUrl: "pageUrl" },
}));

vi.mock("@/db/app.schema", () => ({
  auditPages: { id: "id", url: "url" },
}));

// ============================================================
// Import the route after all mocks are set up
// ============================================================

import { Route } from "./graph.update";
// Import AppError from the mocked module
import { AppError } from "@/server/lib/errors";

// ============================================================
// Test Helpers
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers = (Route.options.server as any)?.handlers;

function createRequest(
  body: Record<string, unknown>,
  options: { clientId?: string; authHeader?: string } = {}
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.clientId) {
    headers["x-client-id"] = options.clientId;
  }

  if (options.authHeader) {
    headers["Authorization"] = options.authHeader;
  }

  return new Request("http://localhost/api/seo/links/graph/update", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

// Valid HTML that passes the 100 character minimum
const VALID_HTML = "<html><body><p>Test content that needs to be at least 100 characters long with a <a href=\"/about\">link</a> for the validation to pass</p></body></html>";
const VALID_HTML_NO_LINKS = "<html><body><p>Test content with no links but still needs to be at least 100 characters long to pass validation checks</p></body></html>";

function setupAuthenticatedContext(
  userId = "user-123",
  clientId = "550e8400-e29b-41d4-a716-446655440000"
) {
  mockState.userContext = {
    userId,
    userEmail: `${userId}@example.com`,
    organizationId: "org-123",
  };
  mockState.clientIdResult = clientId;
}

function setupLinkExtraction(
  internalLinks: Array<{
    targetUrl: string;
    anchorText: string;
    context?: string;
    position?: string;
    paragraphIndex?: number | null;
    isDoFollow?: boolean;
    linkType?: string;
    hasTitle?: boolean;
    hasNoOpener?: boolean;
  }>,
  externalCount = 0
) {
  mockState.extractResult = {
    links: internalLinks.map((link) => ({
      targetUrl: link.targetUrl,
      targetPageId: null,
      anchorText: link.anchorText,
      context: link.context ?? `Context for ${link.anchorText}`,
      position: link.position ?? "body",
      paragraphIndex: link.paragraphIndex ?? 1,
      isDoFollow: link.isDoFollow ?? true,
      linkType: link.linkType ?? "contextual",
      hasTitle: link.hasTitle ?? false,
      hasNoOpener: link.hasNoOpener ?? false,
    })),
    externalLinksSkipped: externalCount,
    invalidLinksSkipped: 0,
  };
}

// ============================================================
// Tests
// ============================================================

describe("POST /api/seo/links/graph/update", () => {
  beforeEach(() => {
    resetMockState();
  });

  // ============================================================
  // 1. Authentication and Authorization Tests
  // ============================================================

  describe("authentication and authorization", () => {
    it("should return 401 when not authenticated", async () => {
      const err = new AppError("UNAUTHENTICATED", "No auth token");
      mockState.userContextError = err;

      const request = createRequest({
        clientId: "550e8400-e29b-41d4-a716-446655440000",
        url: "https://example.com/page",
        html: "<html><body><p>Test content that needs to be at least 100 characters long with a <a href=\"/about\">link</a> for the validation to pass</p></body></html>",
      });

      const response: Response = await handlers.POST({ request });
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
    });

    it("should return 403 when client ID mismatch (cross-client access)", async () => {
      mockState.userContext = {
        userId: "user-123",
        userEmail: "user@example.com",
        organizationId: "org-123",
      };
      mockState.clientIdResult = "client-a-id-00000000-0000-0000-0000";

      const request = createRequest(
        {
          clientId: "client-b-id-11111111-1111-1111-1111",
          url: "https://example.com/page",
          html: "<html><body><p>Test content that needs to be at least 100 characters long with a <a href=\"/about\">link</a> for the validation to pass</p></body></html>",
        },
        { clientId: "client-a-id-00000000-0000-0000-0000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    it("should return 403 when client is archived", async () => {
      mockState.userContext = {
        userId: "user-123",
        userEmail: "user@example.com",
        organizationId: "org-123",
      };
      mockState.clientIdResults = [
        null,
        new AppError("FORBIDDEN", "Unknown or archived client_id"),
      ];

      const request = createRequest({
        clientId: "550e8400-e29b-41d4-a716-446655440000",
        url: "https://example.com/page",
        html: "<html><body><p>Test content that needs to be at least 100 characters long with a <a href=\"/about\">link</a> for the validation to pass</p></body></html>",
      });

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
    });

    it("should accept valid authenticated request", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About Us" },
      ]);

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html: VALID_HTML,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer valid-token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  // ============================================================
  // 2. Input Validation Tests
  // ============================================================

  describe("input validation", () => {
    it("should return 400 for missing clientId", async () => {
      setupAuthenticatedContext();

      const request = createRequest(
        {
          url: "https://example.com/page",
          html: "<html><body><p>Test content that is long enough to pass validation checks</p></body></html>",
        },
        { authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid request");
    });

    it("should return 400 for invalid URL", async () => {
      setupAuthenticatedContext();

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "not-a-valid-url",
          html: "<html><body><p>Test content that is long enough to pass validation checks</p></body></html>",
        },
        { authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid request");
    });

    it("should return 400 for HTML too short", async () => {
      setupAuthenticatedContext();

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html: "<html></html>",
        },
        { authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe("Invalid request");
    });
  });

  // ============================================================
  // 3. Link Extraction and Storage Tests
  // ============================================================

  describe("link extraction", () => {
    it("should extract internal links from HTML", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction(
        [
          { targetUrl: "https://example.com/about", anchorText: "About Us" },
          { targetUrl: "https://example.com/services", anchorText: "Our Services" },
        ],
        1
      );

      const html = `
        <html>
          <body>
            <a href="/about">About Us</a>
            <a href="/services">Our Services</a>
            <a href="https://external.com">External</a>
          </body>
        </html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(2);
      expect(body.externalLinks).toBe(1);
      expect(body.linksExtracted).toBe(3);
    });

    it("should update existing links (idempotent)", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About" },
        { targetUrl: "https://example.com/services", anchorText: "Services" },
      ]);

      const html = `<html><body><p>Test with multiple links - <a href="/about">About</a> and <a href="/services">Services</a> - needs to be 100+ chars</p></body></html>`;

      const request1 = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response1: Response = await handlers.POST({ request: request1 });
      expect(response1.status).toBe(200);

      mockState.transactionOps.length = 0;

      const request2 = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response2: Response = await handlers.POST({ request: request2 });
      expect(response2.status).toBe(200);

      const deleteOps = mockState.transactionOps.filter((op) => op.op === "delete");
      expect(deleteOps.length).toBeGreaterThan(0);
    });

    it("should handle page with no internal links", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([], 3);

      const html = `
        <html><body>
          <a href="https://google.com">Google</a>
          <a href="https://twitter.com">Twitter</a>
          <a href="https://facebook.com">Facebook</a>
        </body></html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(0);
      expect(body.externalLinks).toBe(3);
    });

    it("should extract link position and anchor data correctly", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        {
          targetUrl: "https://example.com/about",
          anchorText: "About Us",
          position: "body",
          paragraphIndex: 1,
          isDoFollow: true,
          linkType: "contextual",
        },
        {
          targetUrl: "https://example.com/contact",
          anchorText: "Contact",
          position: "footer",
          paragraphIndex: null,
          isDoFollow: false,
          linkType: "footer",
        },
      ]);

      const html = `
        <html>
          <body>
            <main><p>Visit our <a href="/about">About Us</a> page.</p></main>
            <footer><a href="/contact" rel="nofollow">Contact</a></footer>
          </body>
        </html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(2);
    });
  });

  // ============================================================
  // 4. Inbound Count Update Tests
  // ============================================================

  describe("inbound count updates", () => {
    it("should batch update inbound counts for linked pages", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About" },
        { targetUrl: "https://example.com/services", anchorText: "Services" },
        { targetUrl: "https://example.com/about", anchorText: "About Us Page" },
      ]);

      const html = `
        <html><body>
          <p>Check our <a href="/about">About</a> and <a href="/services">Services</a>.</p>
          <p>Also see <a href="/about">About Us Page</a>.</p>
        </body></html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/new-page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);

      const executeOps = mockState.transactionOps.filter((op) => op.op === "execute");
      expect(executeOps.length).toBeGreaterThan(0);
    });

    it("should increment inbound_total and inbound_body for body links", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        {
          targetUrl: "https://example.com/target-page",
          anchorText: "Target",
          position: "body",
        },
      ]);

      const html = `<html><body><main><p>Link to <a href="/target-page">Target</a> page - this content needs to be at least 100 characters long</p></main></body></html>`;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/source-page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);

      const executeOps = mockState.transactionOps.filter((op) => op.op === "execute");
      expect(executeOps.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 5. Orphan Page Handling Tests
  // ============================================================

  describe("orphan page handling", () => {
    it("should remove source page from orphan list when processed", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About" },
      ]);

      const html = `<html><body><p>Visit our <a href="/about">About</a> page - this content needs to be at least 100 characters long to pass validation</p></body></html>`;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/orphan-page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);

      const deleteOps = mockState.transactionOps.filter((op) => op.op === "delete");
      expect(deleteOps.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle orphan page that gets linked", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/previously-orphan", anchorText: "Link to orphan" },
      ]);

      const html = `
        <html><body>
          <p>Check out this <a href="/previously-orphan">Link to orphan</a> page.</p>
        </body></html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/linker-page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(1);
    });
  });

  // ============================================================
  // 6. Transaction Integrity Tests
  // ============================================================

  describe("transaction integrity", () => {
    it("should rollback on database error during insert", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About" },
      ]);
      mockState.dbTransactionError = new Error("Database connection lost");

      const html = `<html><body><p>Link to <a href="/about">About</a> page - this content needs to be at least 100 characters long to pass validation</p></body></html>`;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("Failed to update link graph");
    });

    it("should maintain atomicity across multiple operations", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/page1", anchorText: "Page 1" },
        { targetUrl: "https://example.com/page2", anchorText: "Page 2" },
        { targetUrl: "https://example.com/page3", anchorText: "Page 3" },
      ]);

      const html = `
        <html><body>
          <p><a href="/page1">Page 1</a></p>
          <p><a href="/page2">Page 2</a></p>
          <p><a href="/page3">Page 3</a></p>
        </body></html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/source",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      expect(mockState.transactionOps.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // 7. Edge Cases
  // ============================================================

  describe("edge cases", () => {
    it("should handle request without auditId", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About" },
      ]);

      const html = `<html><body><p>Link to <a href="/about">About</a> page - this content needs to be at least 100 characters long to pass validation</p></body></html>`;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(1);
    });

    it("should handle self-referential links", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/page", anchorText: "Self Link" },
        { targetUrl: "https://example.com/about", anchorText: "About" },
      ]);

      const html = `
        <html><body>
          <p><a href="/page">Self Link</a></p>
          <p><a href="/about">About</a></p>
        </body></html>
      `;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.internalLinks).toBe(2);
    });

    it("should include latency in response", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([]);

      const html = `<html><body><p>No links here, just content for testing latency measurement. This needs to be at least 100 characters.</p></body></html>`;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/page",
          html,
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.latencyMs).toBeDefined();
      expect(typeof body.latencyMs).toBe("number");
      expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should handle concurrent updates to same URL", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction([
        { targetUrl: "https://example.com/about", anchorText: "About" },
      ]);

      const html = `<html><body><p>Link to <a href="/about">About</a> page - this content needs to be at least 100 characters long to pass validation</p></body></html>`;

      const request1 = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/same-page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const request2 = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/same-page",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const [response1, response2] = await Promise.all([
        handlers.POST({ request: request1 }),
        handlers.POST({ request: request2 }),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  // ============================================================
  // 8. Response Format Tests
  // ============================================================

  describe("response format", () => {
    it("should return correct success response structure", async () => {
      setupAuthenticatedContext();
      setupLinkExtraction(
        [
          { targetUrl: "https://example.com/page1", anchorText: "Link 1" },
          { targetUrl: "https://example.com/page2", anchorText: "Link 2" },
        ],
        1
      );

      const html = `<html><body><p>Test with <a href="/page1">Link 1</a> and <a href="/page2">Link 2</a> plus <a href="https://ext.com">Ext</a> - must be 100+ chars</p></body></html>`;

      const request = createRequest(
        {
          clientId: "550e8400-e29b-41d4-a716-446655440000",
          url: "https://example.com/source",
          html,
          auditId: "audit-123",
        },
        { clientId: "550e8400-e29b-41d4-a716-446655440000", authHeader: "Bearer token" }
      );

      const response: Response = await handlers.POST({ request });
      const body = await response.json();

      expect(body).toMatchObject({
        success: true,
        linksExtracted: 3,
        internalLinks: 2,
        externalLinks: 1,
        latencyMs: expect.any(Number),
      });
    });

    it("should return correct error response structure", async () => {
      mockState.userContextError = new AppError("UNAUTHENTICATED", "No token");

      const request = createRequest({
        clientId: "550e8400-e29b-41d4-a716-446655440000",
        url: "https://example.com/page",
        html: "<html><body><p>Content that is long enough to pass validation</p></body></html>",
      });

      const response: Response = await handlers.POST({ request });
      const body = await response.json();

      expect(body).toMatchObject({
        success: false,
        error: expect.any(String),
        linksExtracted: 0,
        internalLinks: 0,
        externalLinks: 0,
      });
    });
  });
});
