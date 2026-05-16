/**
 * Tests for parser client.
 * Phase 102-08: TDD for TypeScript parser client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock R2 client with class pattern
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mockSend;
  },
  GetObjectCommand: class MockGetObjectCommand {
    constructor(public params: unknown) {}
  },
}));

describe("parser-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required env vars
    process.env.R2_ENDPOINT = "https://test.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET = "documents";

    // Reset R2 mock for successful response
    mockSend.mockResolvedValue({
      Body: {
        transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("parseDocument", () => {
    it("sends file to parser service", async () => {
      const { parseDocument } = await import("../parser-client");

      const mockResponse = {
        success: true,
        file_type: "pdf",
        text: "Sample text",
        page_count: 1,
        metadata: { title: "Test" },
        fonts: [{ font: "Arial", size: 12, usage: 100 }],
        colors: ["#000000"],
        has_images: false,
        needs_ocr: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await parseDocument("test-key.pdf", "pdf");

      expect(mockFetch).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.text).toBe("Sample text");
    });

    it("returns structured ParserResult", async () => {
      const { parseDocument } = await import("../parser-client");

      const mockResponse = {
        success: true,
        file_type: "docx",
        text: "Document content",
        page_count: 2,
        metadata: { title: "Report", author: "User" },
        fonts: [{ font: "Calibri", size: 11, usage: 200 }],
        colors: ["#333333"],
        has_images: true,
        needs_ocr: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await parseDocument("test-key.docx", "docx");

      expect(result.fileType).toBe("docx");
      expect(result.pageCount).toBe(2);
      expect(result.metadata.title).toBe("Report");
      expect(result.metadata.author).toBe("User");
      expect(result.fonts).toHaveLength(1);
      expect(result.colors).toHaveLength(1);
      expect(result.hasImages).toBe(true);
      expect(result.needsOcr).toBe(false);
    });

    it("handles password-protected PDF error", async () => {
      const { parseDocument } = await import("../parser-client");

      const mockResponse = {
        success: false,
        file_type: "pdf",
        text: "",
        page_count: 0,
        metadata: {},
        fonts: [],
        colors: [],
        has_images: false,
        needs_ocr: false,
        error: "Password-protected PDF detected. Please remove password protection and re-upload.",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await parseDocument("protected.pdf", "pdf");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Password-protected");
    });

    it("handles service unavailable with retry", async () => {
      const { parseDocument } = await import("../parser-client");

      // First two attempts fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockRejectedValueOnce(new Error("Connection refused"))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValueOnce({
            success: true,
            file_type: "pdf",
            text: "Recovered",
            page_count: 1,
            metadata: {},
            fonts: [],
            colors: [],
            has_images: false,
            needs_ocr: false,
          }),
        });

      const result = await parseDocument("test.pdf", "pdf");

      // Should have retried and succeeded
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(result.text).toBe("Recovered");
    });
  });

  describe("checkParserHealth", () => {
    it("returns true when service is healthy", async () => {
      const { checkParserHealth } = await import("../parser-client");

      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const isHealthy = await checkParserHealth();

      expect(isHealthy).toBe(true);
    });

    it("returns false when service is unavailable", async () => {
      const { checkParserHealth } = await import("../parser-client");

      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const isHealthy = await checkParserHealth();

      expect(isHealthy).toBe(false);
    });
  });

  describe("parseDocumentFromBuffer", () => {
    it("parses document from buffer directly", async () => {
      const { parseDocumentFromBuffer } = await import("../parser-client");

      const mockResponse = {
        success: true,
        file_type: "pdf",
        text: "Buffer content",
        page_count: 1,
        metadata: {},
        fonts: [],
        colors: [],
        has_images: false,
        needs_ocr: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const buffer = new Uint8Array([1, 2, 3, 4]);
      const result = await parseDocumentFromBuffer(buffer, "pdf", "test.pdf");

      expect(result.success).toBe(true);
      expect(result.text).toBe("Buffer content");
    });
  });
});
