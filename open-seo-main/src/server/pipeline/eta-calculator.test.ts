/**
 * Tests for ETA calculator with velocity tracking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateETA, recordVelocity, clearVelocity, type ETAResult } from "./eta-calculator";

// Mock redis
vi.mock("@/server/lib/redis", () => {
  const store = new Map<string, string[]>();

  return {
    redis: {
      lpush: vi.fn(async (key: string, value: string) => {
        const list = store.get(key) ?? [];
        list.unshift(value);
        store.set(key, list);
        return list.length;
      }),
      ltrim: vi.fn(async (key: string, start: number, end: number) => {
        const list = store.get(key) ?? [];
        store.set(key, list.slice(start, end + 1));
        return "OK";
      }),
      lrange: vi.fn(async (key: string, start: number, end: number) => {
        const list = store.get(key) ?? [];
        return list.slice(start, end + 1);
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
      expire: vi.fn(async () => 1),
    },
    __store: store, // For test access
  };
});

// Mock logger
vi.mock("@/server/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("calculateETA", () => {
  const workspaceId = "test-workspace";

  beforeEach(async () => {
    await clearVelocity(workspaceId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns low confidence when no history exists", async () => {
    const result = await calculateETA(workspaceId, 5);

    expect(result.confidence).toBe("low");
    expect(result.basedOnSamples).toBe(0);
    expect(result.remainingMinutes).toBe(5 * 30); // 30 min default per plan
    expect(result.eta).toBeInstanceOf(Date);
  });

  it("returns medium confidence with 2-4 samples", async () => {
    // Record 2 completions
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    await recordVelocity(workspaceId, "38-01", tenMinutesAgo, now);
    await recordVelocity(workspaceId, "38-02", tenMinutesAgo, now);

    const result = await calculateETA(workspaceId, 3);

    expect(result.confidence).toBe("medium");
    expect(result.basedOnSamples).toBe(2);
  });

  it("returns high confidence with 5+ samples", async () => {
    const now = new Date();

    // Record 5 completions (10 min each)
    for (let i = 0; i < 5; i++) {
      const start = new Date(now.getTime() - 10 * 60 * 1000);
      await recordVelocity(workspaceId, `38-0${i + 1}`, start, now);
    }

    const result = await calculateETA(workspaceId, 3);

    expect(result.confidence).toBe("high");
    expect(result.basedOnSamples).toBe(5);
  });

  it("calculates reasonable estimate based on historical data", async () => {
    const now = new Date();

    // Record 3 completions of 15 minutes each
    for (let i = 0; i < 3; i++) {
      const start = new Date(now.getTime() - 15 * 60 * 1000);
      await recordVelocity(workspaceId, `38-0${i + 1}`, start, now);
    }

    const result = await calculateETA(workspaceId, 4);

    // 4 remaining plans * 15 min average = 60 min
    expect(result.remainingMinutes).toBe(60);
    expect(result.confidence).toBe("medium");
  });

  it("ETA updates after each plan completion", async () => {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // First estimate with no history
    const firstResult = await calculateETA(workspaceId, 3);
    expect(firstResult.remainingMinutes).toBe(90); // 3 * 30 default

    // Record a 5-minute completion
    await recordVelocity(workspaceId, "38-01", fiveMinutesAgo, now);

    // Second estimate should reflect the faster velocity
    const secondResult = await calculateETA(workspaceId, 2);
    expect(secondResult.remainingMinutes).toBe(10); // 2 * 5 min average
    expect(secondResult.basedOnSamples).toBe(1);
  });
});

describe("recordVelocity", () => {
  const workspaceId = "test-workspace";

  beforeEach(async () => {
    await clearVelocity(workspaceId);
  });

  it("stores plan completion time", async () => {
    const now = new Date();
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

    await recordVelocity(workspaceId, "38-01", twentyMinutesAgo, now);

    const result = await calculateETA(workspaceId, 1);
    expect(result.basedOnSamples).toBe(1);
    expect(result.remainingMinutes).toBe(20);
  });

  it("ensures minimum 1 minute duration", async () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

    await recordVelocity(workspaceId, "38-01", thirtySecondsAgo, now);

    const result = await calculateETA(workspaceId, 5);
    // Should use 1 min (minimum), not 0
    expect(result.remainingMinutes).toBe(5);
  });

  it("averages over last 10 completions", async () => {
    const now = new Date();

    // Record 12 completions
    for (let i = 0; i < 12; i++) {
      const duration = (i + 1) * 60 * 1000; // 1, 2, 3... 12 minutes
      const start = new Date(now.getTime() - duration);
      await recordVelocity(workspaceId, `38-${String(i + 1).padStart(2, "0")}`, start, now);
    }

    const result = await calculateETA(workspaceId, 1);

    // Should only use last 10 (most recent: 12, 11, 10, 9, 8, 7, 6, 5, 4, 3 minutes)
    // Average = (12+11+10+9+8+7+6+5+4+3) / 10 = 75/10 = 7.5, rounds to 8
    expect(result.basedOnSamples).toBe(10);
  });
});
