import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// Mock jose module before importing the module under test
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from "jose";
import { verifyClerkJWT, resetJWKSCache } from "./clerk-jwt";

const mockedJwtVerify = jwtVerify as unknown as ReturnType<typeof vi.fn>;

describe("verifyClerkJWT", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    resetJWKSCache();
    process.env = { ...originalEnv };
    // Valid CLERK_PUBLISHABLE_KEY format (base64 of "test.clerk.accounts.dev")
    process.env.CLERK_PUBLISHABLE_KEY =
      "pk_test_" + Buffer.from("test.clerk.accounts.dev").toString("base64");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns user info for valid token", async () => {
    const mockPayload = {
      sub: "user_123",
      email: "test@example.com",
      name: "Test User",
    };
    mockedJwtVerify.mockResolvedValueOnce({
      payload: mockPayload,
      protectedHeader: { alg: "RS256" },
    });

    const result = await verifyClerkJWT("valid.jwt.token");

    expect(result).toEqual({
      userId: "user_123",
      email: "test@example.com",
      name: "Test User",
    });
  });

  it("returns user info without name when name is absent", async () => {
    const mockPayload = {
      sub: "user_456",
      email: "noname@example.com",
    };
    mockedJwtVerify.mockResolvedValueOnce({
      payload: mockPayload,
      protectedHeader: { alg: "RS256" },
    });

    const result = await verifyClerkJWT("valid.jwt.token");

    expect(result).toEqual({
      userId: "user_456",
      email: "noname@example.com",
      name: undefined,
    });
  });

  it("throws UNAUTHENTICATED for invalid token", async () => {
    mockedJwtVerify.mockRejectedValueOnce(new Error("Invalid signature"));

    await expect(verifyClerkJWT("invalid.token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws UNAUTHENTICATED when sub claim is missing", async () => {
    mockedJwtVerify.mockResolvedValueOnce({
      payload: { email: "test@example.com" },
      protectedHeader: { alg: "RS256" },
    });

    await expect(verifyClerkJWT("no-sub.token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws UNAUTHENTICATED when email claim is missing", async () => {
    mockedJwtVerify.mockResolvedValueOnce({
      payload: { sub: "user_123" },
      protectedHeader: { alg: "RS256" },
    });

    await expect(verifyClerkJWT("no-email.token")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws error when CLERK_PUBLISHABLE_KEY is not set", async () => {
    delete process.env.CLERK_PUBLISHABLE_KEY;
    resetJWKSCache();

    await expect(verifyClerkJWT("any.token")).rejects.toThrow(
      "CLERK_PUBLISHABLE_KEY",
    );
  });

  it("throws error when CLERK_PUBLISHABLE_KEY has invalid format", async () => {
    process.env.CLERK_PUBLISHABLE_KEY = "invalid_key_format";
    resetJWKSCache();

    await expect(verifyClerkJWT("any.token")).rejects.toThrow(
      "Invalid CLERK_PUBLISHABLE_KEY format",
    );
  });
});
