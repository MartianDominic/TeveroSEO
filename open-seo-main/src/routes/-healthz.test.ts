import { describe, expect, it } from "vitest";

// Test the healthz route handler behavior.
// The route handler is extracted and called directly to verify HTTP contract.

describe("GET /healthz", () => {
  it("returns HTTP 200", async () => {
    // Import the handler directly from the route module
    const { Route } = await import("@/routes/healthz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;
    const response: Response = await handlers.GET();
    expect(response.status).toBe(200);
  });

  it("responds with application/json content-type", async () => {
    const { Route } = await import("@/routes/healthz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;
    const response: Response = await handlers.GET();
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("response body parses to { status: 'ok' }", async () => {
    const { Route } = await import("@/routes/healthz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;
    const response: Response = await handlers.GET();
    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  it("route handler exists and is a function", async () => {
    const { Route } = await import("@/routes/healthz");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = (Route.options.server as any)?.handlers;
    expect(typeof handlers.GET).toBe("function");
  });
});
