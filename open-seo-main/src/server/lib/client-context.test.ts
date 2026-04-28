import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/lib/alwrity-db", () => ({
  alwrityPool: { query: vi.fn() },
}));

import { alwrityPool } from "@/server/lib/alwrity-db";
import { AppError } from "@/server/lib/errors";
import { resolveClientId } from "@/server/lib/client-context";

const mockedQuery = alwrityPool.query as unknown as ReturnType<typeof vi.fn>;

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

describe("resolveClientId", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("returns null when X-Client-ID header is absent", async () => {
    await expect(resolveClientId(makeHeaders())).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when header is not a UUID", async () => {
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": "not-a-uuid" })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" } satisfies Partial<AppError>);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("returns the id when client exists in alwrity.clients", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": id })),
    ).resolves.toBe(id);
  });

  it("throws FORBIDDEN when the client UUID is unknown/archived", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveClientId(makeHeaders({ "X-Client-ID": id })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("accepts lowercase and mixed-case header name", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(makeHeaders({ "x-client-id": id })),
    ).resolves.toBe(id);
  });

  // --- URL query param fallback tests (SHELL-04) ---

  it("resolves null when neither header nor URL carries client_id", async () => {
    await expect(
      resolveClientId(makeHeaders(), "https://app.openseo.so/audits"),
    ).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("resolves client_id from URL query param when header absent", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id }] });
    await expect(
      resolveClientId(
        makeHeaders(),
        `https://app.openseo.so/?client_id=${id}`,
      ),
    ).resolves.toBe(id);
  });

  it("throws FORBIDDEN when URL query param is malformed (not a UUID)", async () => {
    await expect(
      resolveClientId(
        makeHeaders(),
        "https://app.openseo.so/?client_id=not-a-uuid",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("throws FORBIDDEN when URL query param is an unknown UUID", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    mockedQuery.mockResolvedValueOnce({ rows: [] });
    await expect(
      resolveClientId(makeHeaders(), `https://app.openseo.so/?client_id=${id}`),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("header wins when both header and URL param are present", async () => {
    const headerId = "66666666-6666-4666-8666-666666666666";
    const urlId = "77777777-7777-4777-8777-777777777777";
    mockedQuery.mockResolvedValueOnce({ rows: [{ id: headerId }] });
    const result = await resolveClientId(
      makeHeaders({ "X-Client-ID": headerId }),
      `https://app.openseo.so/?client_id=${urlId}`,
    );
    expect(result).toBe(headerId);
    // DB was called once — with the header UUID, not the URL UUID
    expect(mockedQuery).toHaveBeenCalledOnce();
    expect(mockedQuery.mock.calls[0][1]).toEqual([headerId]);
  });

  it("tolerates malformed URL string without throwing", async () => {
    await expect(
      resolveClientId(makeHeaders(), "not a url"),
    ).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});
