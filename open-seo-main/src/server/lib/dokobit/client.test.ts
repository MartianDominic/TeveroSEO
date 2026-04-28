/**
 * Tests for Dokobit API client.
 * Phase 30-05: E-Signature (Dokobit)
 *
 * TDD: Tests written FIRST before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = process.env;

describe("DokobitClient", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, DOKOBIT_ACCESS_TOKEN: "test-token-abc123" };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("createDokobitClient", () => {
    it("should throw error if DOKOBIT_ACCESS_TOKEN is not set", async () => {
      delete process.env.DOKOBIT_ACCESS_TOKEN;

      const { createDokobitClient } = await import("./client");

      expect(() => createDokobitClient()).toThrow("DOKOBIT_ACCESS_TOKEN not configured");
    });

    it("should create client when token is configured", async () => {
      const { createDokobitClient } = await import("./client");

      const client = createDokobitClient();

      expect(client).toBeDefined();
      expect(client.initiateSmartIdSigning).toBeInstanceOf(Function);
      expect(client.initiateMobileIdSigning).toBeInstanceOf(Function);
      expect(client.getSigningStatus).toBeInstanceOf(Function);
      expect(client.downloadSignedDocument).toBeInstanceOf(Function);
    });
  });

  describe("initiateSmartIdSigning", () => {
    it("should send correct request to Dokobit API", async () => {
      const mockResponse = {
        session_id: "session-123",
        verification_code: "1234",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.initiateSmartIdSigning({
        personalCode: "38501010001",
        country: "LT",
        documentHash: "abc123hash",
        documentName: "SEO Sutartis - example.com",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/signing/smartid/sign"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-abc123",
            "Content-Type": "application/json",
          }),
        })
      );

      expect(result).toEqual({
        sessionId: "session-123",
        verificationCode: "1234",
      });
    });

    it("should throw error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Invalid credentials"),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      await expect(
        client.initiateSmartIdSigning({
          personalCode: "38501010001",
          country: "LT",
          documentHash: "abc123hash",
          documentName: "Test Document",
        })
      ).rejects.toThrow(/Dokobit error/);
    });

    it("should format personal code with country prefix", async () => {
      const mockResponse = {
        session_id: "session-123",
        verification_code: "5678",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      await client.initiateSmartIdSigning({
        personalCode: "38501010001",
        country: "EE",
        documentHash: "abc123hash",
        documentName: "Test Document",
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.pno).toBe("PNOEE-38501010001");
    });
  });

  describe("initiateMobileIdSigning", () => {
    it("should send correct request with phone number", async () => {
      const mockResponse = {
        session_id: "mobile-session-456",
        verification_code: "9012",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.initiateMobileIdSigning({
        personalCode: "38501010001",
        phoneNumber: "+37060012345",
        country: "LT",
        documentHash: "def456hash",
        documentName: "SEO Contract",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/signing/mobileid/sign"),
        expect.objectContaining({
          method: "POST",
        })
      );

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.phone).toBe("+37060012345");

      expect(result).toEqual({
        sessionId: "mobile-session-456",
        verificationCode: "9012",
      });
    });

    it("should throw error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Phone number not found"),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      await expect(
        client.initiateMobileIdSigning({
          personalCode: "38501010001",
          phoneNumber: "+37060012345",
          country: "LT",
          documentHash: "def456hash",
          documentName: "Test Document",
        })
      ).rejects.toThrow(/Dokobit error/);
    });
  });

  describe("getSigningStatus", () => {
    it("should return pending status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "pending",
          }),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.getSigningStatus("session-123");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/signing/session/session-123/status"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-abc123",
          }),
        })
      );

      expect(result).toEqual({
        status: "pending",
        signedDocumentUrl: undefined,
        error: undefined,
      });
    });

    it("should return completed status with signed document URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "completed",
            signed_document_url: "https://dokobit.com/signed/doc123.pdf",
          }),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.getSigningStatus("session-123");

      expect(result).toEqual({
        status: "completed",
        signedDocumentUrl: "https://dokobit.com/signed/doc123.pdf",
        error: undefined,
      });
    });

    it("should return failed status with error message", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "failed",
            error_message: "User cancelled signing",
          }),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.getSigningStatus("session-123");

      expect(result).toEqual({
        status: "failed",
        signedDocumentUrl: undefined,
        error: "User cancelled signing",
      });
    });

    it("should return expired status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "expired",
          }),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.getSigningStatus("session-123");

      expect(result.status).toBe("expired");
    });
  });

  describe("downloadSignedDocument", () => {
    it("should download and return signed PDF as buffer", async () => {
      const mockPdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockPdfContent.buffer),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      const result = await client.downloadSignedDocument("session-123");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/signing/session/session-123/download"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-abc123",
          }),
        })
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result[0]).toBe(0x25); // %
    });

    it("should throw error on download failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("Document not found"),
      });

      const { createDokobitClient } = await import("./client");
      const client = createDokobitClient();

      await expect(client.downloadSignedDocument("invalid-session")).rejects.toThrow(
        /Dokobit error/
      );
    });
  });
});

describe("DokobitClient types", () => {
  it("should export correct type definitions", async () => {
    const types = await import("./types");

    // Verify type exports exist
    expect(types).toBeDefined();
  });
});
