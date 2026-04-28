import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any; // Test file - runtime assertions matter, not compile-time

// Mock the analytics queue before importing the route
vi.mock("@/server/queues/analyticsQueue", () => ({
  analyticsQueue: {
    getJobs: vi.fn(),
    getJob: vi.fn(),
    add: vi.fn(),
  },
  ANALYTICS_QUEUE_NAME: "analytics-sync",
}));

// Mock environment variables
const originalEnv = process.env;

describe("DLQ Admin API", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, INTERNAL_API_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("GET /api/admin/dlq", () => {
    it("returns 401 when X-Internal-Api-Key header is missing", async () => {
      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "GET",
      });

      const response: Response = await handlers.GET({ request });
      expect(response.status).toBe(401);

      const body = (await response.json()) as ApiResponse;
      expect(body.success).toBe(false);
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when X-Internal-Api-Key header is invalid", async () => {
      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "GET",
        headers: { "X-Internal-Api-Key": "wrong-key" },
      });

      const response: Response = await handlers.GET({ request });
      expect(response.status).toBe(401);
    });

    it("returns empty list when no DLQ jobs exist", async () => {
      const { analyticsQueue } = await import("@/server/queues/analyticsQueue");
      vi.mocked(analyticsQueue.getJobs).mockResolvedValue([]);

      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "GET",
        headers: { "X-Internal-Api-Key": "test-api-key" },
      });

      const response: Response = await handlers.GET({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });

    it("returns DLQ jobs with correct structure", async () => {
      const mockDLQJob = {
        id: "dlq-job-123",
        name: "dlq:analytics-sync",
        data: {
          originalJobId: "original-123",
          originalJobName: "sync-client-analytics",
          data: { clientId: "client-uuid-456", provider: "google", mode: "incremental" },
          error: "API rate limit exceeded",
          failedAt: "2026-04-19T10:00:00.000Z",
          attemptsMade: 3,
        },
      };

      const { analyticsQueue } = await import("@/server/queues/analyticsQueue");
      // getJobs is called twice: once for waiting, once for delayed
      vi.mocked(analyticsQueue.getJobs)
        .mockResolvedValueOnce([mockDLQJob as never]) // waiting
        .mockResolvedValueOnce([]); // delayed

      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "GET",
        headers: { "X-Internal-Api-Key": "test-api-key" },
      });

      const response: Response = await handlers.GET({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: "dlq-job-123",
        originalJobId: "original-123",
        originalJobName: "sync-client-analytics",
        clientId: "client-uuid-456",
        error: "API rate limit exceeded",
        failedAt: "2026-04-19T10:00:00.000Z",
        attemptsMade: 3,
      });
    });

    it("filters out non-DLQ jobs", async () => {
      const mockJobs = [
        {
          id: "regular-job",
          name: "sync-client-analytics",
          data: { clientId: "client-1" },
        },
        {
          id: "dlq-job",
          name: "dlq:analytics-sync",
          data: {
            originalJobId: "original-1",
            originalJobName: "sync-client-analytics",
            data: { clientId: "client-2" },
            error: "Failed",
            failedAt: "2026-04-19T10:00:00.000Z",
            attemptsMade: 3,
          },
        },
      ];

      const { analyticsQueue } = await import("@/server/queues/analyticsQueue");
      // getJobs is called twice: once for waiting, once for delayed
      vi.mocked(analyticsQueue.getJobs)
        .mockResolvedValueOnce(mockJobs as never) // waiting
        .mockResolvedValueOnce([]); // delayed

      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "GET",
        headers: { "X-Internal-Api-Key": "test-api-key" },
      });

      const response: Response = await handlers.GET({ request });
      const body = (await response.json()) as ApiResponse;

      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe("dlq-job");
    });
  });

  describe("DELETE /api/admin/dlq", () => {
    it("returns 401 without valid API key", async () => {
      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "DELETE",
      });

      const response: Response = await handlers.DELETE({ request });
      expect(response.status).toBe(401);
    });

    it("purges all DLQ jobs", async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      const mockDLQJob = {
        id: "dlq-job-123",
        name: "dlq:analytics-sync",
        data: {},
        remove: mockRemove,
      };

      const { analyticsQueue } = await import("@/server/queues/analyticsQueue");
      // getJobs is called twice: once for waiting, once for delayed
      vi.mocked(analyticsQueue.getJobs)
        .mockResolvedValueOnce([mockDLQJob as never]) // waiting
        .mockResolvedValueOnce([]); // delayed

      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "DELETE",
        headers: { "X-Internal-Api-Key": "test-api-key" },
      });

      const response: Response = await handlers.DELETE({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(body.data.removed).toContain("dlq-job-123");
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/dlq (replay-all)", () => {
    it("returns 401 without valid API key", async () => {
      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "POST",
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(401);
    });

    it("replays DLQ jobs with rate limiting (max 10)", async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      const mockDLQJobs = Array.from({ length: 15 }, (_, i) => ({
        id: `dlq-job-${i}`,
        name: "dlq:analytics-sync",
        data: {
          originalJobId: `original-${i}`,
          originalJobName: "sync-client-analytics",
          data: { clientId: `client-${i}`, provider: "google", mode: "incremental" },
          error: "Failed",
          failedAt: "2026-04-19T10:00:00.000Z",
          attemptsMade: 3,
        },
        remove: mockRemove,
      }));

      const { analyticsQueue } = await import("@/server/queues/analyticsQueue");
      // getJobs is called twice: once for waiting, once for delayed
      vi.mocked(analyticsQueue.getJobs)
        .mockResolvedValueOnce(mockDLQJobs as never) // waiting
        .mockResolvedValueOnce([]); // delayed
      vi.mocked(analyticsQueue.add).mockResolvedValue({ id: "new-job" } as never);

      const { Route } = await import("@/routes/api/admin/dlq");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handlers = (Route.options.server as any)?.handlers;

      const request = new Request("http://localhost/api/admin/dlq", {
        method: "POST",
        headers: { "X-Internal-Api-Key": "test-api-key" },
      });

      const response: Response = await handlers.POST({ request });
      expect(response.status).toBe(200);

      const body = (await response.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(body.data.replayed).toHaveLength(10); // Max batch size
      expect(body.data.remaining).toBe(5); // 15 - 10 = 5 remaining
      expect(vi.mocked(analyticsQueue.add)).toHaveBeenCalledTimes(10);
    });
  });
});
