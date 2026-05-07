/**
 * L4 R2 Archive Cache Tests
 * Phase 95-02: Multi-Level Caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { CachedPage } from "../types";

// =============================================================================
// Mock AWS SDK - Must be hoisted
// =============================================================================

// Store for mock objects (hoisted)
const mockStorage = vi.hoisted(() =>
  new Map<string, { body: Uint8Array; metadata: Record<string, string> }>()
);

// Hoisted mock classes
const { MockS3Client, MockCommands } = vi.hoisted(() => {
  const storage = new Map<string, { body: Uint8Array; metadata: Record<string, string> }>();

  class MockS3Client {
    send = async (command: any) => {
      const commandName = command.constructor.name;

      switch (commandName) {
        case "MockGetObjectCommand": {
          const key = command.input.Key;
          const obj = storage.get(key);

          if (!obj) {
            const error = new Error("NoSuchKey");
            (error as any).name = "NoSuchKey";
            (error as any).$metadata = { httpStatusCode: 404 };
            throw error;
          }

          return {
            Body: {
              transformToByteArray: async () => obj.body,
              transformToString: async () => new TextDecoder().decode(obj.body),
            },
            Metadata: obj.metadata,
          };
        }

        case "MockPutObjectCommand": {
          const key = command.input.Key;
          const body = command.input.Body;
          const metadata = command.input.Metadata ?? {};

          storage.set(key, {
            body: body instanceof Buffer ? new Uint8Array(body) : body,
            metadata,
          });

          return {};
        }

        case "MockDeleteObjectCommand": {
          const key = command.input.Key;
          storage.delete(key);
          return {};
        }

        case "MockHeadObjectCommand": {
          const key = command.input.Key;
          if (!storage.has(key)) {
            const error = new Error("NotFound");
            (error as any).name = "NotFound";
            (error as any).$metadata = { httpStatusCode: 404 };
            throw error;
          }
          return {};
        }

        case "MockListObjectsV2Command": {
          const prefix = command.input.Prefix ?? "";
          const contents = Array.from(storage.keys())
            .filter((key) => key.startsWith(prefix))
            .map((key) => ({
              Key: key,
              Size: storage.get(key)?.body.length ?? 0,
            }));

          return {
            Contents: contents,
            NextContinuationToken: undefined,
          };
        }

        default:
          throw new Error(`Unknown command: ${commandName}`);
      }
    };
  }

  class MockGetObjectCommand {
    constructor(public input: any) {}
  }

  class MockPutObjectCommand {
    constructor(public input: any) {}
  }

  class MockDeleteObjectCommand {
    constructor(public input: any) {}
  }

  class MockHeadObjectCommand {
    constructor(public input: any) {}
  }

  class MockListObjectsV2Command {
    constructor(public input: any) {}
  }

  return {
    MockS3Client,
    MockCommands: {
      GetObjectCommand: MockGetObjectCommand,
      PutObjectCommand: MockPutObjectCommand,
      DeleteObjectCommand: MockDeleteObjectCommand,
      HeadObjectCommand: MockHeadObjectCommand,
      ListObjectsV2Command: MockListObjectsV2Command,
    },
    storage,
  };
});

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: MockS3Client,
  GetObjectCommand: MockCommands.GetObjectCommand,
  PutObjectCommand: MockCommands.PutObjectCommand,
  DeleteObjectCommand: MockCommands.DeleteObjectCommand,
  HeadObjectCommand: MockCommands.HeadObjectCommand,
  ListObjectsV2Command: MockCommands.ListObjectsV2Command,
}));

// Import after mock
import { L4Cache, createL4Cache } from "../L4Cache";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockPage(overrides: Partial<CachedPage> = {}): CachedPage {
  return {
    html: "<html><body><h1>Test</h1><p>Content for testing L4 cache</p></body></html>",
    contentHash: "abc123def456gh78",
    fetchedAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000 * 90), // 90 days
    tierUsed: "direct",
    statusCode: 200,
    pageSizeBytes: 1000,
    ...overrides,
  };
}

// Get the hoisted storage for clearing
const { storage } = vi.hoisted(() => {
  const storage = new Map<string, { body: Uint8Array; metadata: Record<string, string> }>();
  return { storage };
});

// =============================================================================
// Tests
// =============================================================================

describe("L4Cache", () => {
  let cache: L4Cache;

  beforeEach(() => {
    // Clear storage before each test
    for (const key of Array.from(mockStorage.keys())) {
      mockStorage.delete(key);
    }
    cache = createL4Cache({
      bucket: "test-bucket",
      accountId: "test-account",
    });
  });

  afterEach(() => {
    for (const key of Array.from(mockStorage.keys())) {
      mockStorage.delete(key);
    }
  });

  describe("basic operations", () => {
    it("should have level L4", () => {
      expect(cache.level).toBe("L4");
    });

    it("should return null for non-existent key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeNull();
    });

    it("should track statistics on miss", async () => {
      await cache.get("nonexistent");
      const stats = cache.getStats();
      expect(stats.misses).toBe(1);
    });
  });

  describe("statistics tracking", () => {
    it("should track misses", async () => {
      // Generate misses
      await cache.get("nonexistent1");
      await cache.get("nonexistent2");

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it("should track average latency", async () => {
      await cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should reset statistics", async () => {
      await cache.get("nonexistent");

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it("should calculate hit rate correctly", async () => {
      // All misses = 0 hit rate
      await cache.get("a");
      await cache.get("b");

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe("factory", () => {
    it("should create cache with custom config", () => {
      const customCache = createL4Cache({
        bucket: "custom-bucket",
        retentionDays: 180,
      });

      expect(customCache).toBeInstanceOf(L4Cache);
      expect(customCache.level).toBe("L4");
    });

    it("should use default config when not specified", () => {
      const defaultCache = createL4Cache();
      expect(defaultCache).toBeInstanceOf(L4Cache);
    });
  });
});
