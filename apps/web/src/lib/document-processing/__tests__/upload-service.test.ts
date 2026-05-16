/**
 * Upload Service Tests
 * Phase 102-07: Task 2 - R2 upload service
 *
 * TDD tests for document upload functionality.
 */

import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

// Set up environment variables BEFORE importing the module
beforeAll(() => {
  process.env.R2_ENDPOINT = "https://test.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY_ID = "test-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.R2_BUCKET = "test-documents";
});

// Hoist mock functions so they're available when vi.mock runs
const { mockSend, mockInsertValues, mockFindFirst, putCommandCalls, mockQueueAdd } = vi.hoisted(() => ({
  mockSend: vi.fn().mockResolvedValue({}),
  mockInsertValues: vi.fn().mockResolvedValue(undefined),
  mockFindFirst: vi.fn(),
  putCommandCalls: [] as Array<{ Key: string; Bucket: string; Body: Buffer; ContentType: string }>,
  mockQueueAdd: vi.fn().mockResolvedValue(undefined),
}));

// Mock AWS SDK with proper classes
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: class MockS3Client {
      send = mockSend;
    },
    PutObjectCommand: class MockPutObjectCommand {
      input: { Key: string; Bucket: string; Body: Buffer; ContentType: string };
      constructor(input: { Key: string; Bucket: string; Body: Buffer; ContentType: string }) {
        this.input = input;
        putCommandCalls.push(input);
      }
    },
  };
});

// Mock database
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: mockInsertValues,
    })),
    query: {
      uploadedDocuments: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

// Mock processing queue
vi.mock("../processing-queue", () => ({
  documentProcessingQueue: {
    add: mockQueueAdd,
  },
}));

// Import AFTER mocks are set up
import { uploadDocument, getDocumentStatus } from "../upload-service";

describe("upload-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    mockInsertValues.mockResolvedValue(undefined);
    // Clear putCommandCalls array
    putCommandCalls.length = 0;
  });

  describe("uploadDocument", () => {
    it("accepts File and workspaceId, returns documentId", async () => {
      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      const workspaceId = "ws-123";

      const result = await uploadDocument(file, workspaceId);

      expect(result).toHaveProperty("documentId");
      expect(result).toHaveProperty("status");
      expect(typeof result.documentId).toBe("string");
      expect(result.documentId.length).toBeGreaterThan(0);
    });

    it("uploads file to R2 with path: {workspaceId}/{documentId}/{fileName}", async () => {
      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      const workspaceId = "ws-123";

      const result = await uploadDocument(file, workspaceId);

      // Verify PutObjectCommand was called with workspace-scoped path
      expect(putCommandCalls.length).toBeGreaterThan(0);
      const commandArgs = putCommandCalls[0];
      expect(commandArgs.Key).toContain(workspaceId);
      expect(commandArgs.Key).toContain(result.documentId);
      expect(commandArgs.Key).toContain("test.pdf");
    });

    it("creates database record with status 'pending'", async () => {
      const { db } = await import("@/db");
      const file = new File(["test content"], "test.pdf", {
        type: "application/pdf",
      });
      const workspaceId = "ws-123";

      const result = await uploadDocument(file, workspaceId);

      expect(db.insert).toHaveBeenCalled();
      expect(result.status).toBe("pending");
    });

    it("validates file type (pdf, docx, png, jpg, jpeg) and rejects invalid types", async () => {
      const file = new File(["test content"], "test.exe", {
        type: "application/x-msdownload",
      });
      const workspaceId = "ws-123";

      await expect(uploadDocument(file, workspaceId)).rejects.toThrow(
        /Unsupported file type/
      );
    });

    it("validates file size (max 20MB) and rejects oversized files", async () => {
      // Create a file larger than 20MB (simulate)
      const largeContent = new ArrayBuffer(21 * 1024 * 1024);
      const file = new File([largeContent], "large.pdf", {
        type: "application/pdf",
      });
      const workspaceId = "ws-123";

      await expect(uploadDocument(file, workspaceId)).rejects.toThrow(/too large/i);
    });
  });

  describe("getDocumentStatus", () => {
    it("returns current processing state", async () => {
      const { db } = await import("@/db");
      const mockDoc = {
        id: "doc-123",
        fileName: "test.pdf",
        status: "processing",
        processingProgress: 50,
        processingError: null,
        ocrTier: null,
        ocrConfidence: null,
      };

      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockDoc
      );

      const result = await getDocumentStatus("doc-123");

      expect(result).toHaveProperty("id", "doc-123");
      expect(result).toHaveProperty("fileName", "test.pdf");
      expect(result).toHaveProperty("status", "processing");
      expect(result).toHaveProperty("progress", 50);
    });

    it("throws error when document not found", async () => {
      const { db } = await import("@/db");
      (db.query.uploadedDocuments.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(getDocumentStatus("nonexistent")).rejects.toThrow(
        /not found/i
      );
    });
  });
});
