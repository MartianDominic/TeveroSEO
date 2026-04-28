/**
 * Integration tests for Link Suggestions API.
 * Phase 40-04: T-40-04-01 - Link Suggestions API Integration Tests
 *
 * Tests the complete flow:
 * 1. Authentication (401/403 cases)
 * 2. Suggestion matching (anchor text in content)
 * 3. Velocity limits (daily quota enforcement)
 * 4. Error handling
 */
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";

// =============================================================================
// Types
// =============================================================================

interface SuggestionsResponse {
  links: Array<{
    anchorText: string;
    targetUrl: string;
    confidence: number;
    method: string;
    position: string | null;
  }>;
  totalSuggestions: number;
  autoApplicable: number;
  remainingQuota: number;
  reason?: string;
}

interface ErrorResponse {
  error: string;
  details?: unknown;
}

// =============================================================================
// Mock Functions (hoisted)
// =============================================================================

const mockRequireApiAuth = vi.fn();
const mockResolveClientId = vi.fn();
const mockGetVelocityStats = vi.fn();
const mockDbSelect = vi.fn();

// =============================================================================
// Mock Setup (vi.mock calls are hoisted)
// =============================================================================

vi.mock("@/routes/api/seo/-middleware", () => ({
  requireApiAuth: (request: Request) => mockRequireApiAuth(request),
}));

vi.mock("@/server/lib/client-context", () => ({
  resolveClientId: (headers: Headers, url?: string) => mockResolveClientId(headers, url),
  CLIENT_ID_HEADER: "x-client-id",
  CLIENT_ID_QUERY_PARAM: "client_id",
}));

vi.mock("@/server/features/linking/services/VelocityService", () => ({
  VelocityService: class MockVelocityService {
    getVelocityStats(clientId: string) {
      return mockGetVelocityStats(clientId);
    }
    getDefaultSettings() {
      return {
        maxNewLinksPerPage: 3,
        maxTotalLinksPerPage: 10,
        maxLinksPerParagraph: 2,
        maxNewLinksPerDay: 50,
        maxNewLinksPerWeek: 200,
        minDaysBetweenPageEdits: 7,
        maxPagesEditedPerDay: 20,
      };
    }
  },
}));

vi.mock("@/db", () => ({
  db: {
    select: () => mockDbSelect(),
  },
}));

vi.mock("@/db/link-schema", () => ({
  linkSuggestions: {
    clientId: "clientId",
    status: "status",
    isAutoApplicable: "isAutoApplicable",
    anchorConfidence: "anchorConfidence",
    score: "score",
  },
}));

vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/server/lib/metrics", () => ({
  metrics: {
    increment: vi.fn(),
    timing: vi.fn(),
  },
  recordRequestMetrics: vi.fn(),
}));

// Import AppError for test assertions
import { AppError } from "@/server/lib/errors";

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a chainable mock for Drizzle queries.
 */
function createChainableMock<T>(result: T) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((cb) => Promise.resolve(result).then(cb)),
    [Symbol.toStringTag]: "Promise",
  };
  Object.setPrototypeOf(chain, Promise.prototype);
  return chain;
}

/**
 * Create an authenticated request.
 */
function createRequest(options: {
  clientId?: string;
  content?: string;
  maxLinks?: number;
  headers?: Record<string, string>;
}): Request {
  const {
    clientId = "client-123",
    content = "Test content with our services mentioned and more text to reach the minimum character requirement.",
    maxLinks = 7,
    headers = {},
  } = options;

  return new Request("http://localhost/api/seo/links/suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-ID": clientId,
      ...headers,
    },
    body: JSON.stringify({ clientId, content, maxLinks }),
  });
}

/**
 * Get route handlers from the imported module.
 */
async function getHandlers() {
  const module = await import("./suggestions");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (module.Route.options.server as any)?.handlers;
}

/**
 * Setup default mocks for successful authenticated requests.
 */
function setupDefaultMocks() {
  mockRequireApiAuth.mockResolvedValue({
    userId: "user-1",
    userEmail: "test@example.com",
    organizationId: "org-1",
  });
  mockResolveClientId.mockResolvedValue("client-123");
  mockGetVelocityStats.mockResolvedValue({
    linksToday: 10,
    linksThisWeek: 40,
    pagesEditedToday: 5,
    limits: {
      maxNewLinksPerPage: 3,
      maxTotalLinksPerPage: 10,
      maxLinksPerParagraph: 2,
      maxNewLinksPerDay: 50,
      maxNewLinksPerWeek: 200,
      minDaysBetweenPageEdits: 7,
      maxPagesEditedPerDay: 20,
    },
  });
  mockDbSelect.mockReturnValue(createChainableMock([]));
}

// =============================================================================
// Tests
// =============================================================================

describe("POST /api/seo/links/suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Authentication Tests
  // ===========================================================================

  describe("authentication", () => {
    it("should return 401 without auth header", async () => {
      mockRequireApiAuth.mockRejectedValue(
        new AppError("UNAUTHENTICATED", "Authorization header or X-Client-ID required")
      );

      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: "client-123",
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(401);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toContain("Authorization");
    });

    it("should return 401 with invalid API key", async () => {
      mockRequireApiAuth.mockRejectedValue(
        new AppError("UNAUTHENTICATED", "Invalid API key")
      );

      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-key",
        },
        body: JSON.stringify({
          clientId: "client-123",
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(401);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toContain("Invalid API key");
    });

    it("should return 403 when accessing other client data", async () => {
      // Authenticate successfully but resolve to a different client
      mockResolveClientId.mockResolvedValue("client-A");

      const handlers = await getHandlers();
      // Try to request data for client B
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": "client-A",
        },
        body: JSON.stringify({
          clientId: "client-B", // Mismatch with resolved clientId
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(403);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toContain("clientId mismatch");
    });

    it("should return 403 when X-Client-ID header is missing and cannot be resolved", async () => {
      mockResolveClientId.mockResolvedValue(null);

      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token",
        },
        body: JSON.stringify({
          clientId: "client-123",
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(403);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toContain("X-Client-ID header required");
    });

    it("should return 403 when client_id is invalid UUID format", async () => {
      mockResolveClientId.mockRejectedValue(
        new AppError("FORBIDDEN", "Invalid client_id")
      );

      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": "not-a-uuid",
        },
        body: JSON.stringify({
          clientId: "not-a-uuid",
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(403);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toContain("Invalid client_id");
    });

    it("should return 403 when client_id is unknown or archived", async () => {
      mockResolveClientId.mockRejectedValue(
        new AppError("FORBIDDEN", "Unknown or archived client_id")
      );

      const handlers = await getHandlers();
      const request = createRequest({
        clientId: "00000000-0000-0000-0000-000000000000",
        content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(403);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toContain("Unknown or archived");
    });
  });

  // ===========================================================================
  // Validation Tests
  // ===========================================================================

  describe("validation", () => {
    it("should return 400 when clientId is missing", async () => {
      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": "client-123",
        },
        body: JSON.stringify({
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(400);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toBe("Invalid request");
    });

    it("should return 400 when content is too short", async () => {
      const handlers = await getHandlers();
      const request = createRequest({
        content: "Too short",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(400);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toBe("Invalid request");
    });

    it("should return 400 when maxLinks exceeds limit", async () => {
      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": "client-123",
        },
        body: JSON.stringify({
          clientId: "client-123",
          content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
          maxLinks: 100, // Exceeds limit of 10
        }),
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(400);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toBe("Invalid request");
    });
  });

  // ===========================================================================
  // Suggestion Matching Tests
  // ===========================================================================

  describe("suggestion matching", () => {
    it("should return suggestions matching content", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "our services",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
        {
          id: "sug-2",
          clientId: "client-123",
          anchorText: "contact us",
          targetUrl: "/contact",
          anchorConfidence: 0.95,
          insertionMethod: "wrap_existing",
          existingTextMatch: "contact us",
          status: "pending",
          isAutoApplicable: true,
          score: 80,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Check out our services page for more information about what we offer. This is additional content to reach the minimum character requirement.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(1);
      expect(body.links[0].anchorText).toBe("our services");
      expect(body.links[0].targetUrl).toBe("/services");
      expect(body.totalSuggestions).toBe(2);
      expect(body.autoApplicable).toBe(1);
    });

    it("should return multiple matching suggestions", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "our services",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
        {
          id: "sug-2",
          clientId: "client-123",
          anchorText: "contact us",
          targetUrl: "/contact",
          anchorConfidence: 0.95,
          insertionMethod: "wrap_existing",
          existingTextMatch: "contact us",
          status: "pending",
          isAutoApplicable: true,
          score: 80,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Our services page and contact us form are available. This content mentions both our services and you can contact us for more info.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(2);
      expect(body.autoApplicable).toBe(2);
    });

    it("should respect maxLinks parameter", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "our services",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
        {
          id: "sug-2",
          clientId: "client-123",
          anchorText: "contact us",
          targetUrl: "/contact",
          anchorConfidence: 0.95,
          insertionMethod: "wrap_existing",
          existingTextMatch: "contact us",
          status: "pending",
          isAutoApplicable: true,
          score: 80,
        },
        {
          id: "sug-3",
          clientId: "client-123",
          anchorText: "about us",
          targetUrl: "/about",
          anchorConfidence: 0.88,
          insertionMethod: "wrap_existing",
          existingTextMatch: "about us",
          status: "pending",
          isAutoApplicable: true,
          score: 75,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Check our services, contact us, or learn about us. All three phrases are present here with enough content to pass validation.",
        maxLinks: 1,
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links.length).toBeLessThanOrEqual(1);
    });

    it("should return empty array when no suggestions match content", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "pricing plans",
          targetUrl: "/pricing",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "pricing plans",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "This content does not contain any of the anchor texts. We are just testing with random text here that is long enough.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(0);
      expect(body.totalSuggestions).toBe(1);
      expect(body.autoApplicable).toBe(0);
    });

    it("should handle Unicode-normalized matching", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "cafe menu",
          targetUrl: "/cafe",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "cafe menu",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      // Content with similar text that should match after normalization
      const request = createRequest({
        content: "Check out our cafe menu for delicious options. We have a variety of items on the cafe menu available today.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(1);
      expect(body.links[0].anchorText).toBe("cafe menu");
    });
  });

  // ===========================================================================
  // Velocity Limits Tests
  // ===========================================================================

  describe("velocity limits", () => {
    it("should return empty links when daily quota exhausted", async () => {
      mockGetVelocityStats.mockResolvedValue({
        linksToday: 50, // At daily limit
        linksThisWeek: 100,
        pagesEditedToday: 10,
        limits: {
          maxNewLinksPerPage: 3,
          maxTotalLinksPerPage: 10,
          maxLinksPerParagraph: 2,
          maxNewLinksPerDay: 50, // Limit is 50
          maxNewLinksPerWeek: 200,
          minDaysBetweenPageEdits: 7,
          maxPagesEditedPerDay: 20,
        },
      });

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Test content with our services mentioned. This has enough characters to pass validation requirements for minimum size.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(0);
      expect(body.remainingQuota).toBe(0);
      expect(body.reason).toBe("Daily link insertion quota exhausted");
    });

    it("should limit suggestions to remaining quota", async () => {
      // Only 2 links remaining in quota
      mockGetVelocityStats.mockResolvedValue({
        linksToday: 48,
        linksThisWeek: 100,
        pagesEditedToday: 10,
        limits: {
          maxNewLinksPerPage: 3,
          maxTotalLinksPerPage: 10,
          maxLinksPerParagraph: 2,
          maxNewLinksPerDay: 50, // 50 - 48 = 2 remaining
          maxNewLinksPerWeek: 200,
          minDaysBetweenPageEdits: 7,
          maxPagesEditedPerDay: 20,
        },
      });

      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "our services",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
        {
          id: "sug-2",
          clientId: "client-123",
          anchorText: "contact us",
          targetUrl: "/contact",
          anchorConfidence: 0.95,
          insertionMethod: "wrap_existing",
          existingTextMatch: "contact us",
          status: "pending",
          isAutoApplicable: true,
          score: 80,
        },
        {
          id: "sug-3",
          clientId: "client-123",
          anchorText: "about us",
          targetUrl: "/about",
          anchorConfidence: 0.88,
          insertionMethod: "wrap_existing",
          existingTextMatch: "about us",
          status: "pending",
          isAutoApplicable: true,
          score: 75,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Check our services, contact us, or learn about us. All three anchor texts are present in this content for testing.",
        maxLinks: 10, // Request more than available
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      // Should be limited to 2 (remaining quota) even though 3 match
      expect(body.links.length).toBeLessThanOrEqual(2);
    });

    it("should return correct remainingQuota after suggestions", async () => {
      mockGetVelocityStats.mockResolvedValue({
        linksToday: 45,
        linksThisWeek: 100,
        pagesEditedToday: 10,
        limits: {
          maxNewLinksPerPage: 3,
          maxTotalLinksPerPage: 10,
          maxLinksPerParagraph: 2,
          maxNewLinksPerDay: 50, // 50 - 45 = 5 remaining
          maxNewLinksPerWeek: 200,
          minDaysBetweenPageEdits: 7,
          maxPagesEditedPerDay: 20,
        },
      });

      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "our services",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Check out our services for more details. This is additional content to meet the minimum requirements for testing.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(1);
      // 5 remaining - 1 suggested = 4 remaining
      expect(body.remainingQuota).toBe(4);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      mockDbSelect.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(500);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toBe("Failed to get link suggestions");
    });

    it("should handle VelocityService errors gracefully", async () => {
      mockGetVelocityStats.mockRejectedValue(new Error("Redis connection failed"));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Test content with at least one hundred characters to pass validation requirements for minimum content size.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(500);

      const body = (await response.json()) as ErrorResponse;
      expect(body.error).toBe("Failed to get link suggestions");
    });

    it("should handle malformed JSON body", async () => {
      const handlers = await getHandlers();
      const request = new Request("http://localhost/api/seo/links/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-ID": "client-123",
        },
        body: "{ invalid json",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(500);
    });
  });

  // ===========================================================================
  // Response Format Tests
  // ===========================================================================

  describe("response format", () => {
    it("should return properly structured response with all fields", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "text match context",
          status: "pending",
          isAutoApplicable: true,
          score: 85,
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Check out our services for more information. This is additional content to meet minimum requirements for the API.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;

      // Verify response structure
      expect(body).toHaveProperty("links");
      expect(body).toHaveProperty("totalSuggestions");
      expect(body).toHaveProperty("autoApplicable");
      expect(body).toHaveProperty("remainingQuota");

      // Verify link structure
      expect(body.links[0]).toHaveProperty("anchorText");
      expect(body.links[0]).toHaveProperty("targetUrl");
      expect(body.links[0]).toHaveProperty("confidence");
      expect(body.links[0]).toHaveProperty("method");
      expect(body.links[0]).toHaveProperty("position");

      // Verify values
      expect(body.links[0].confidence).toBe(0.9);
      expect(body.links[0].method).toBe("wrap_existing");
      expect(body.links[0].position).toBe("text match context");
    });

    it("should order suggestions by score descending", async () => {
      const mockSuggestions = [
        {
          id: "sug-1",
          clientId: "client-123",
          anchorText: "our services",
          targetUrl: "/services",
          anchorConfidence: 0.9,
          insertionMethod: "wrap_existing",
          existingTextMatch: "our services",
          status: "pending",
          isAutoApplicable: true,
          score: 85, // Higher score
        },
        {
          id: "sug-2",
          clientId: "client-123",
          anchorText: "contact us",
          targetUrl: "/contact",
          anchorConfidence: 0.95,
          insertionMethod: "wrap_existing",
          existingTextMatch: "contact us",
          status: "pending",
          isAutoApplicable: true,
          score: 70, // Lower score
        },
      ];

      mockDbSelect.mockReturnValue(createChainableMock(mockSuggestions));

      const handlers = await getHandlers();
      const request = createRequest({
        content: "Check our services and contact us for help. This includes both anchor texts in the content for testing purposes.",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as SuggestionsResponse;
      expect(body.links).toHaveLength(2);
      // First link should be the one with higher score (returned from DB already sorted)
      expect(body.links[0].anchorText).toBe("our services");
    });
  });
});
