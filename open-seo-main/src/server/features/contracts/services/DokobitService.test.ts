/**
 * DokobitService Tests
 * Phase 48-01: Contract Generation - Task 3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock runtime-env module
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: vi.fn(),
}));

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

import { DokobitService } from "./DokobitService.js";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

describe("DokobitService.createSigningSession", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOptionalEnvValue).mockImplementation((key: string) => {
      if (key === "DOKOBIT_ACCESS_TOKEN") return Promise.resolve("test_token_123");
      if (key === "DOKOBIT_API_URL") return Promise.resolve("https://beta.dokobit.com");
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns sessionId and signingUrl on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        session_id: "dokobit_session_123",
        url: "https://dokobit.com/sign/123",
      }),
    });

    const result = await DokobitService.createSigningSession(
      "contract_123",
      Buffer.from("PDF content"),
      "https://example.com/webhook"
    );

    expect(result.sessionId).toBe("dokobit_session_123");
    expect(result.signingUrl).toBe("https://dokobit.com/sign/123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://beta.dokobit.com/api/signing/create.json",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("throws AUTH_CONFIG_MISSING when DOKOBIT_ACCESS_TOKEN not set", async () => {
    vi.mocked(getOptionalEnvValue).mockResolvedValue(undefined);

    await expect(
      DokobitService.createSigningSession(
        "contract_123",
        Buffer.from("PDF content"),
        "https://example.com/webhook"
      )
    ).rejects.toThrow("DOKOBIT_ACCESS_TOKEN not configured");
  });

  it("throws DOKOBIT_API_ERROR on non-200 response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue("Bad Request"),
    });

    await expect(
      DokobitService.createSigningSession(
        "contract_123",
        Buffer.from("PDF content"),
        "https://example.com/webhook"
      )
    ).rejects.toThrow();
  });

  it("throws DOKOBIT_API_ERROR when response missing required fields", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        // Missing session_id and url
        status: "created",
      }),
    });

    await expect(
      DokobitService.createSigningSession(
        "contract_123",
        Buffer.from("PDF content"),
        "https://example.com/webhook"
      )
    ).rejects.toThrow();
  });

  it("sends correct payload to Dokobit API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        session_id: "session_123",
        url: "https://dokobit.com/sign/123",
      }),
    });

    const pdfBuffer = Buffer.from("PDF content");
    await DokobitService.createSigningSession(
      "contract_456",
      pdfBuffer,
      "https://example.com/webhook"
    );

    const callArgs = mockFetch.mock.calls[0];
    const payload = JSON.parse(callArgs[1].body);

    expect(payload.access_token).toBe("test_token_123");
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0].name).toBe("contract-contract_456.pdf");
    expect(payload.files[0].content).toBe(pdfBuffer.toString("base64"));
    expect(payload.postback_url).toBe("https://example.com/webhook");
  });
});

describe("DokobitService.downloadSignedDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOptionalEnvValue).mockImplementation((key: string) => {
      if (key === "DOKOBIT_ACCESS_TOKEN") return Promise.resolve("test_token_123");
      if (key === "DOKOBIT_API_URL") return Promise.resolve("https://beta.dokobit.com");
      return Promise.resolve(undefined);
    });
  });

  it("returns signed PDF data on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        file_content: "base64EncodedPdfContent",
        signer_name: "John Doe",
      }),
    });

    const result = await DokobitService.downloadSignedDocument("session_123");

    expect(result.signedPdfBase64).toBe("base64EncodedPdfContent");
    expect(result.signerName).toBe("John Doe");
    expect(result.signedAt).toBeInstanceOf(Date);
  });

  it("throws AUTH_CONFIG_MISSING when token not set", async () => {
    vi.mocked(getOptionalEnvValue).mockResolvedValue(undefined);

    await expect(
      DokobitService.downloadSignedDocument("session_123")
    ).rejects.toThrow("DOKOBIT_ACCESS_TOKEN not configured");
  });

  it("throws DOKOBIT_API_ERROR on failed download", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(
      DokobitService.downloadSignedDocument("session_123")
    ).rejects.toThrow("Download failed: 404");
  });

  it("defaults signer name to Unknown when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        file_content: "base64Content",
        // signer_name missing
      }),
    });

    const result = await DokobitService.downloadSignedDocument("session_123");

    expect(result.signerName).toBe("Unknown");
  });
});
