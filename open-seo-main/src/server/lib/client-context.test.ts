import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("@/server/lib/alwrity-db", () => ({
  alwrityPool: { query: vi.fn() },
}));

vi.mock("@/server/lib/clerk-verify", () => ({
  verifyClerkToken: vi.fn(),
  extractBearerToken: vi.fn((header: string | null) => {
    if (!header) return null;
    const parts = header.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") return null;
    return parts[1];
  }),
}));

vi.mock("@/lib/auth/client-ownership", () => ({
  validateClientOwnership: vi.fn(),
}));

import { alwrityPool } from "@/server/lib/alwrity-db";
import { verifyClerkToken } from "@/server/lib/clerk-verify";
import { validateClientOwnership } from "@/lib/auth/client-ownership";
import { AppError } from "@/server/lib/errors";
import { resolveClientId, resolveClientContext, INTERNAL_SERVICE_TOKEN_HEADER } from "@/server/lib/client-context";

const mockedQuery = alwrityPool.query as unknown as ReturnType<typeof vi.fn>;
const mockedVerifyClerkToken = verifyClerkToken as unknown as ReturnType<typeof vi.fn>;
const mockedValidateClientOwnership = validateClientOwnership as unknown as ReturnType<typeof vi.fn>;

// Valid test JWT (won't be verified in tests due to mock)
const TEST_JWT = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.signature";
const TEST_USER_ID = "user_test123";

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

function makeHeadersWithAuth(init: Record<string, string> = {}): Headers {
  return new Headers({
    Authorization: `Bearer ${TEST_JWT}`,
    ...init,
  });
}

describe("resolveClientId", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedVerifyClerkToken.mockReset();
    mockedValidateClientOwnership.mockReset();
    // Default: JWT verification succeeds
    mockedVerifyClerkToken.mockResolvedValue({
      userId: TEST_USER_ID,
      email: "test@example.com",
    });
    // Default: ownership validation succeeds
    mockedValidateClientOwnership.mockResolvedValue(undefined);
  });

  // --- JWT validation tests (AUTH-HIGH-01) ---

  it("throws UNAUTHENTICATED when Authorization header is missing", async () => {
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": "11111111-1111-4111-8111-111111111111" })),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(mockedVerifyClerkToken).not.toHaveBeenCalled();
  });

  it("throws UNAUTHENTICATED when Authorization header is invalid format", async () => {
    await expect(
      resolveClientId(makeHeaders({
        Authorization: "Basic credentials",
        "X-Client-ID": "11111111-1111-4111-8111-111111111111",
      })),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("throws UNAUTHENTICATED when JWT verification fails", async () => {
    mockedVerifyClerkToken.mockRejectedValueOnce(new AppError("UNAUTHENTICATED", "Invalid token"));
    await expect(
      resolveClientId(makeHeadersWithAuth({ "X-Client-ID": "11111111-1111-4111-8111-111111111111" })),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  // --- Internal service token bypass tests ---

  it("bypasses JWT validation with valid internal service token", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const originalEnv = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.INTERNAL_SERVICE_TOKEN = "secret-token";

    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });

    const result = await resolveClientId(
      makeHeaders({
        [INTERNAL_SERVICE_TOKEN_HEADER]: "secret-token",
        "X-Client-ID": id,
      }),
    );

    expect(result).toBe(id);
    expect(mockedVerifyClerkToken).not.toHaveBeenCalled();

    process.env.INTERNAL_SERVICE_TOKEN = originalEnv;
  });

  it("rejects invalid internal service token", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const originalEnv = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.INTERNAL_SERVICE_TOKEN = "secret-token";

    await expect(
      resolveClientId(
        makeHeaders({
          [INTERNAL_SERVICE_TOKEN_HEADER]: "wrong-token",
          "X-Client-ID": id,
        }),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    process.env.INTERNAL_SERVICE_TOKEN = originalEnv;
  });

  // --- Client ID resolution tests (with valid JWT) ---

  it("returns null when X-Client-ID header is absent (with valid JWT)", async () => {
    await expect(resolveClientId(makeHeadersWithAuth())).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when header is not a UUID", async () => {
    await expect(
      resolveClientId(makeHeadersWithAuth({ "X-Client-ID": "not-a-uuid" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AppError>);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("returns the id when client exists in alwrity.clients", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(makeHeadersWithAuth({ "X-Client-ID": id })),
    ).resolves.toBe(id);
  });

  it("throws FORBIDDEN when the client UUID is unknown/archived", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveClientId(makeHeadersWithAuth({ "X-Client-ID": id })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts lowercase and mixed-case header name", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(makeHeadersWithAuth({ "x-client-id": id })),
    ).resolves.toBe(id);
  });

  // --- Ownership validation tests (AUTH-HIGH-02) ---

  it("throws FORBIDDEN when user lacks access to client", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    mockedValidateClientOwnership.mockRejectedValueOnce(new Error("No access"));

    await expect(
      resolveClientId(makeHeadersWithAuth({ "X-Client-ID": id })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  // --- URL query param fallback tests (SHELL-04) ---

  it("resolves null when neither header nor URL carries client_id", async () => {
    await expect(
      resolveClientId(makeHeadersWithAuth(), "https://app.openseo.so/audits"),
    ).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("resolves client_id from URL query param when header absent", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(
        makeHeadersWithAuth(),
        `https://app.openseo.so/?client_id=${id}`,
      ),
    ).resolves.toBe(id);
  });

  it("throws FORBIDDEN when URL query param is malformed (not a UUID)", async () => {
    await expect(
      resolveClientId(
        makeHeadersWithAuth(),
        "https://app.openseo.so/?client_id=not-a-uuid",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when URL query param is an unknown UUID", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveClientId(makeHeadersWithAuth(), `https://app.openseo.so/?client_id=${id}`),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("header wins when both header and URL param are present", async () => {
    const headerId = "66666666-6666-4666-8666-666666666666";
    const urlId = "77777777-7777-4777-8777-777777777777";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: headerId }] });
    const result = await resolveClientId(
      makeHeadersWithAuth({ "X-Client-ID": headerId }),
      `https://app.openseo.so/?client_id=${urlId}`,
    );
    expect(result).toBe(headerId);
    // DB was called once — with the header UUID, not the URL UUID
    expect(mockedQuery).toHaveBeenCalledOnce();
    expect(mockedQuery.mock.calls[0][1]).toEqual([headerId]);
  });

  it("tolerates malformed URL string without throwing", async () => {
    await expect(
      resolveClientId(makeHeadersWithAuth(), "not a url"),
    ).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe("resolveClientContext", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedVerifyClerkToken.mockReset();
    mockedValidateClientOwnership.mockReset();
    mockedVerifyClerkToken.mockResolvedValue({
      userId: TEST_USER_ID,
      email: "test@example.com",
      orgId: "org_test123",
    });
    mockedValidateClientOwnership.mockResolvedValue(undefined);
  });

  it("returns ResolvedContext with verified userId and clientId", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: clientId }] });

    const request = new Request("https://app.openseo.so/api/test", {
      headers: makeHeadersWithAuth({ "X-Client-ID": clientId }),
    });

    const result = await resolveClientContext(request);

    expect(result).toEqual({
      userId: TEST_USER_ID,
      clientId,
      orgId: "org_test123",
    });
  });

  it("throws UNAUTHENTICATED when JWT is missing", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const request = new Request("https://app.openseo.so/api/test", {
      headers: makeHeaders({ "X-Client-ID": clientId }),
    });

    await expect(resolveClientContext(request)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws FORBIDDEN when X-Client-ID is missing", async () => {
    const request = new Request("https://app.openseo.so/api/test", {
      headers: makeHeadersWithAuth(),
    });

    await expect(resolveClientContext(request)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns service:internal userId for valid internal service token", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const originalEnv = process.env.INTERNAL_SERVICE_TOKEN;
    process.env.INTERNAL_SERVICE_TOKEN = "secret-token";

    mockedQuery.mockResolvedValueOnce({ rows: [{ id: clientId }] });

    const request = new Request("https://app.openseo.so/api/test", {
      headers: makeHeaders({
        [INTERNAL_SERVICE_TOKEN_HEADER]: "secret-token",
        "X-Client-ID": clientId,
      }),
    });

    const result = await resolveClientContext(request);

    expect(result).toEqual({
      userId: "service:internal",
      clientId,
      orgId: undefined,
    });
    expect(mockedVerifyClerkToken).not.toHaveBeenCalled();

    process.env.INTERNAL_SERVICE_TOKEN = originalEnv;
  });
});
