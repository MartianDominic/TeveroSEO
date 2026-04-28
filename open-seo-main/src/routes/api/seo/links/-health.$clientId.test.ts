/**
 * Tests for Link Health API Route.
 * Phase 35-05: Link Health Dashboard API
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

// Create chainable mock
const createChainableMock = (result: unknown) => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((cb) => Promise.resolve(result).then(cb)),
    [Symbol.toStringTag]: "Promise",
  };
  // Make it thenable
  Object.setPrototypeOf(chain, Promise.prototype);
  return chain;
};

// Mock the database
const mockSelect = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

// Mock auth middleware
vi.mock("@/routes/api/seo/-middleware", () => ({
  requireApiAuth: vi.fn().mockResolvedValue({
    userId: "user-1",
    userEmail: "test@example.com",
    organizationId: "org-1",
  }),
}));

// Mock link-schema
vi.mock("@/db/link-schema", () => ({
  pageLinks: { clientId: "clientId", inboundTotal: "inboundTotal", clickDepthFromHome: "clickDepthFromHome" },
  linkOpportunities: { clientId: "clientId", opportunityType: "opportunityType" },
}));

describe("GET /api/seo/links/health/:clientId", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSelect.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireApiAuth } = await import("@/routes/api/seo/-middleware");
    vi.mocked(requireApiAuth).mockRejectedValueOnce(new Error("Unauthorized"));

    const { Route } = await import("./health.$clientId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;

    const request = new Request("http://localhost/api/seo/links/health/client-1", {
      method: "GET",
    });

    const response: Response = await handlers.GET({ request, params: { clientId: "client-1" } });
    expect(response.status).toBe(401);

    const body: ApiResponse = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Unauthorized");
  });

  it("returns overview metrics for client", async () => {
    // Mock all three queries
    mockSelect
      .mockReturnValueOnce(createChainableMock([
        { totalPages: 100, orphanPages: 5, avgInboundLinks: "15.5", deepPages: 10 },
      ]))
      .mockReturnValueOnce(createChainableMock([
        { bucket: "0", count: 5 },
        { bucket: "1-10", count: 30 },
      ]))
      .mockReturnValueOnce(createChainableMock([
        { total: 20, opportunityType: "orphan_rescue" },
        { total: 30, opportunityType: "boost_high_value" },
      ]));

    const { Route } = await import("./health.$clientId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;

    const request = new Request("http://localhost/api/seo/links/health/client-1", {
      method: "GET",
      headers: { "X-Client-ID": "client-1" },
    });

    const response: Response = await handlers.GET({ request, params: { clientId: "client-1" } });
    expect(response.status).toBe(200);

    const body: ApiResponse = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.metrics.totalPages).toBe(100);
    expect(body.data.metrics.orphanPages).toBe(5);
    expect(body.data.metrics.avgInboundLinks).toBe(15.5);
  });

  it("returns link distribution buckets", async () => {
    mockSelect
      .mockReturnValueOnce(createChainableMock([
        { totalPages: 100, orphanPages: 5, avgInboundLinks: "15", deepPages: 10 },
      ]))
      .mockReturnValueOnce(createChainableMock([
        { bucket: "0", count: 5 },
        { bucket: "1-10", count: 30 },
        { bucket: "11-20", count: 25 },
        { bucket: "21-30", count: 20 },
        { bucket: "31-40", count: 15 },
        { bucket: "41-50", count: 3 },
        { bucket: "50+", count: 2 },
      ]))
      .mockReturnValueOnce(createChainableMock([]));

    const { Route } = await import("./health.$clientId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;

    const request = new Request("http://localhost/api/seo/links/health/client-1", {
      method: "GET",
      headers: { "X-Client-ID": "client-1" },
    });

    const response: Response = await handlers.GET({ request, params: { clientId: "client-1" } });
    expect(response.status).toBe(200);

    const body: ApiResponse = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.distribution).toHaveLength(7);
    expect(body.data.distribution[0].bucket).toBe("0");
    expect(body.data.distribution[0].count).toBe(5);
  });

  it("returns opportunity counts by type", async () => {
    mockSelect
      .mockReturnValueOnce(createChainableMock([
        { totalPages: 100, orphanPages: 5, avgInboundLinks: "15", deepPages: 10 },
      ]))
      .mockReturnValueOnce(createChainableMock([]))
      .mockReturnValueOnce(createChainableMock([
        { total: 20, opportunityType: "orphan_rescue" },
        { total: 30, opportunityType: "boost_high_value" },
      ]));

    const { Route } = await import("./health.$clientId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;

    const request = new Request("http://localhost/api/seo/links/health/client-1", {
      method: "GET",
      headers: { "X-Client-ID": "client-1" },
    });

    const response: Response = await handlers.GET({ request, params: { clientId: "client-1" } });
    expect(response.status).toBe(200);

    const body: ApiResponse = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.opportunities.total).toBe(50);
    expect(body.data.opportunities.byType.orphan_rescue).toBe(20);
    expect(body.data.opportunities.byType.boost_high_value).toBe(30);
  });

  it("handles database errors gracefully", async () => {
    mockSelect.mockImplementationOnce(() => {
      throw new Error("Database connection failed");
    });

    const { Route } = await import("./health.$clientId");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;

    const request = new Request("http://localhost/api/seo/links/health/client-1", {
      method: "GET",
      headers: { "X-Client-ID": "client-1" },
    });

    const response: Response = await handlers.GET({ request, params: { clientId: "client-1" } });
    expect(response.status).toBe(500);

    const body: ApiResponse = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe("Internal error");
  });
});
