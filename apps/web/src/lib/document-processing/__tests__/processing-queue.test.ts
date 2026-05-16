/**
 * Processing Queue Tests
 * Phase 102-07: Task 3 - BullMQ queue for document processing
 *
 * TDD tests for document processing queue functionality.
 */

import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

// Set up environment variables
beforeAll(() => {
  process.env.REDIS_URL = "redis://localhost:6379";
});

// Hoist mock functions
const { mockUpdate, mockFindFirst } = vi.hoisted(() => ({
  mockUpdate: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  })),
  mockFindFirst: vi.fn(),
}));

// Mock database
vi.mock("@/db", () => ({
  db: {
    update: mockUpdate,
    query: {
      uploadedDocuments: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

// Mock Redis
vi.mock("@/lib/redis/client", () => ({
  redis: {
    status: "ready",
    ping: vi.fn().mockResolvedValue("PONG"),
  },
}));

// Import after mocks
import {
  documentProcessingQueue,
  createDocumentProcessingWorker,
  type ProcessingJob,
} from "../processing-queue";

describe("processing-queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("documentProcessingQueue", () => {
    it("accepts 'process' jobs with documentId", async () => {
      const job: ProcessingJob = { documentId: "doc-123" };

      // Queue should have an add method
      expect(documentProcessingQueue).toHaveProperty("add");
      expect(typeof documentProcessingQueue.add).toBe("function");

      // Should be able to add a job
      await expect(
        documentProcessingQueue.add("process", job, {
          jobId: "doc-123",
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        })
      ).resolves.not.toThrow();
    });
  });

  describe("documentProcessingWorker", () => {
    it("exports createDocumentProcessingWorker function", () => {
      expect(createDocumentProcessingWorker).toBeDefined();
      expect(typeof createDocumentProcessingWorker).toBe("function");
    });
  });
});
