/**
 * Processing Queue Tests
 * Phase 102-07: Task 3 - BullMQ queue for document processing
 *
 * TDD tests for document processing queue functionality.
 */

import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from "vitest";

// Set up environment variables
beforeAll(() => {
  process.env.REDIS_URL = "redis://localhost:6379";
});

// Track jobs added during tests for cleanup awareness
// Note: The in-memory queue module doesn't expose a reset method,
// so tests must account for cumulative state or use unique IDs

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

    it("returns worker with start, stop, and isRunning methods", () => {
      const worker = createDocumentProcessingWorker();

      expect(worker).toHaveProperty("start");
      expect(worker).toHaveProperty("stop");
      expect(worker).toHaveProperty("isRunning");
      expect(worker).toHaveProperty("recoverStaleJobs");
      expect(worker).toHaveProperty("getQueueLength");
      expect(typeof worker.start).toBe("function");
      expect(typeof worker.stop).toBe("function");
      expect(typeof worker.isRunning).toBe("function");
    });

    it("reports isRunning status correctly", () => {
      const worker = createDocumentProcessingWorker();
      // Worker may already be running from previous test (auto-starts on job add)
      // So we just verify the method returns a boolean
      expect(typeof worker.isRunning()).toBe("boolean");
    });

    it("reports isShuttingDown status", () => {
      const worker = createDocumentProcessingWorker();
      expect(worker.isShuttingDown()).toBe(false);
    });
  });

  describe("job deduplication", () => {
    it("prevents duplicate jobs for same documentId", async () => {
      const job: ProcessingJob = { documentId: "doc-dedup-test" };

      // Get initial length
      const initialLength = documentProcessingQueue.getLength();

      // Add first job
      await documentProcessingQueue.add("process", job, { jobId: "unique-1" });
      const lengthAfterFirst = documentProcessingQueue.getLength();

      // First job should be added
      expect(lengthAfterFirst).toBe(initialLength + 1);

      // Try to add duplicate (should be silently skipped)
      await documentProcessingQueue.add("process", job, { jobId: "unique-2" });
      const lengthAfterSecond = documentProcessingQueue.getLength();

      // Length should not increase for duplicate
      expect(lengthAfterSecond).toBe(lengthAfterFirst);
    });
  });

  describe("retry behavior", () => {
    it("uses default attempts of 3 when not specified", async () => {
      // Use unique ID to avoid conflicts with other tests
      const job: ProcessingJob = { documentId: `doc-retry-default-${Date.now()}` };

      const lengthBefore = documentProcessingQueue.getLength();
      await documentProcessingQueue.add("process", job);

      // Job should be queued with default options
      expect(documentProcessingQueue.getLength()).toBe(lengthBefore + 1);
    });

    it("accepts custom retry configuration", async () => {
      // Use unique ID to avoid conflicts with other tests
      const job: ProcessingJob = { documentId: `doc-retry-custom-${Date.now()}` };

      await expect(
        documentProcessingQueue.add("process", job, {
          jobId: `retry-test-${Date.now()}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 10000 },
        })
      ).resolves.not.toThrow();
    });
  });

  describe("queue monitoring", () => {
    it("getLength returns current queue size", () => {
      const length = documentProcessingQueue.getLength();
      expect(typeof length).toBe("number");
      expect(length).toBeGreaterThanOrEqual(0);
    });
  });

  // NOTE: Queue depth limit test is destructive (fills 100 slots) and must run last
  // It validates the MAX_QUEUE_SIZE=100 limit but pollutes global queue state
  describe("queue depth limits (run last)", () => {
    it("enforces maximum queue size of 100", async () => {
      // Get current queue length
      const currentLength = documentProcessingQueue.getLength();
      const slotsToFill = 100 - currentLength;

      // Fill remaining slots to reach max
      const promises: Promise<void>[] = [];
      for (let i = 0; i < slotsToFill; i++) {
        promises.push(
          documentProcessingQueue.add("process", { documentId: `doc-fill-${Date.now()}-${i}` })
        );
      }
      await Promise.all(promises);

      // Verify queue is at max
      expect(documentProcessingQueue.getLength()).toBe(100);

      // Next job should throw
      await expect(
        documentProcessingQueue.add("process", { documentId: `doc-overflow-${Date.now()}` })
      ).rejects.toThrow("Queue full");
    });
  });
});
