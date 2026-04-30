/**
 * Task Aggregation Service Tests
 * Phase 49-51: Onboarding & Agency Dashboard
 *
 * Tests for D-11 Layer 1 urgency score algorithm and task aggregation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module before importing anything that uses it
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

// Mock schemas to avoid circular import issues
vi.mock("@/db/tasks-schema", () => ({
  tasks: {},
  TASK_SOURCES: ["checklist", "pipeline", "follow_up", "expiring", "seo", "manual"],
  TASK_PRIORITIES: ["high", "medium", "low"],
}));

vi.mock("@/db/onboarding-schema", () => ({
  onboardingChecklists: {},
}));

vi.mock("@/db/prospect-schema", () => ({
  prospects: {},
}));

vi.mock("@/db/contract-schema", () => ({
  contracts: {},
}));

import {
  calculateUrgencyScore,
  PRIORITY_WEIGHTS,
  type AggregatedTask,
} from "./TaskAggregationService";
import type { TaskPriority } from "@/db/tasks-schema";

describe("TaskAggregationService", () => {
  describe("calculateUrgencyScore", () => {
    // Test 1: Overdue scoring (+20 per day)
    it("returns 20 per day overdue", () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const score = calculateUrgencyScore({
        dueAt: threeDaysAgo,
        dealValueCents: null,
        daysInStage: null,
        priority: null,
      });

      // 3 days overdue = 60 points
      expect(score).toBe(60);
    });

    // Test 2: Due today scoring (+50)
    it("returns 50 for due today", () => {
      const today = new Date();
      // Set to start of day to ensure isToday works
      today.setHours(12, 0, 0, 0);

      const score = calculateUrgencyScore({
        dueAt: today,
        dealValueCents: null,
        daysInStage: null,
        priority: null,
      });

      // Due today = 50 points
      expect(score).toBe(50);
    });

    // Test 3: Deal value scoring (+1 per 1000 cents)
    it("adds deal_value / 1000", () => {
      const score = calculateUrgencyScore({
        dueAt: null,
        dealValueCents: 5000, // 50 currency units
        daysInStage: null,
        priority: null,
      });

      // 5000 / 1000 = 5 points
      expect(score).toBe(5);
    });

    // Test 4: Days stale scoring (+3 per day)
    it("adds days_stale * 3", () => {
      const score = calculateUrgencyScore({
        dueAt: null,
        dealValueCents: null,
        daysInStage: 10,
        priority: null,
      });

      // 10 days * 3 = 30 points
      expect(score).toBe(30);
    });

    // Test 5: Priority weight - high
    it("adds priority weight for high priority (75)", () => {
      const score = calculateUrgencyScore({
        dueAt: null,
        dealValueCents: null,
        daysInStage: null,
        priority: "high",
      });

      expect(score).toBe(75);
    });

    // Test 6: Priority weight - medium
    it("adds priority weight for medium priority (50)", () => {
      const score = calculateUrgencyScore({
        dueAt: null,
        dealValueCents: null,
        daysInStage: null,
        priority: "medium",
      });

      expect(score).toBe(50);
    });

    // Test 7: Priority weight - low
    it("adds priority weight for low priority (25)", () => {
      const score = calculateUrgencyScore({
        dueAt: null,
        dealValueCents: null,
        daysInStage: null,
        priority: "low",
      });

      expect(score).toBe(25);
    });

    // Test 8: Combined scoring
    it("combines all scoring factors correctly", () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const score = calculateUrgencyScore({
        dueAt: twoDaysAgo,
        dealValueCents: 10000, // 100 currency units
        daysInStage: 5,
        priority: "high",
      });

      // 2 days overdue (40) + 10000/1000 (10) + 5 days stale (15) + high priority (75) = 140
      expect(score).toBe(40 + 10 + 15 + 75);
    });

    // Test 9: Future due date (not overdue)
    it("returns 0 overdue points for future due date", () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const score = calculateUrgencyScore({
        dueAt: tomorrow,
        dealValueCents: null,
        daysInStage: null,
        priority: null,
      });

      // Future due date = 0 points (not overdue, not today)
      expect(score).toBe(0);
    });

    // Test 10: Null values handled correctly
    it("handles all null values", () => {
      const score = calculateUrgencyScore({
        dueAt: null,
        dealValueCents: null,
        daysInStage: null,
        priority: null,
      });

      expect(score).toBe(0);
    });
  });

  describe("PRIORITY_WEIGHTS", () => {
    it("has correct weight values", () => {
      expect(PRIORITY_WEIGHTS.high).toBe(75);
      expect(PRIORITY_WEIGHTS.medium).toBe(50);
      expect(PRIORITY_WEIGHTS.low).toBe(25);
    });
  });

  describe("Snooze filtering", () => {
    // Test 11: Snoozed task is excluded when snoozedUntil is in the future
    it("excludes snoozed tasks where snoozedUntil > now", () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const tasks: AggregatedTask[] = [
        {
          id: "1",
          source: "manual",
          entityType: null,
          entityId: null,
          title: "Task 1",
          description: null,
          dueAt: null,
          urgencyScore: 50,
          priority: "medium",
          clientId: null,
          clientName: null,
          pinnedAt: null,
          snoozedUntil: tomorrow, // Should be excluded
          dealValueCents: null,
          daysInStage: null,
          category: null,
          assignedTo: null,
        },
        {
          id: "2",
          source: "manual",
          entityType: null,
          entityId: null,
          title: "Task 2",
          description: null,
          dueAt: null,
          urgencyScore: 50,
          priority: "medium",
          clientId: null,
          clientName: null,
          pinnedAt: null,
          snoozedUntil: yesterday, // Should be included (snooze expired)
          dealValueCents: null,
          daysInStage: null,
          category: null,
          assignedTo: null,
        },
        {
          id: "3",
          source: "manual",
          entityType: null,
          entityId: null,
          title: "Task 3",
          description: null,
          dueAt: null,
          urgencyScore: 50,
          priority: "medium",
          clientId: null,
          clientName: null,
          pinnedAt: null,
          snoozedUntil: null, // Should be included (not snoozed)
          dealValueCents: null,
          daysInStage: null,
          category: null,
          assignedTo: null,
        },
      ];

      // Filter snoozed tasks (same logic as aggregateTasks)
      const activeTasks = tasks.filter(
        (t) => !t.snoozedUntil || t.snoozedUntil < now
      );

      expect(activeTasks).toHaveLength(2);
      expect(activeTasks.map((t) => t.id)).toEqual(["2", "3"]);
    });
  });

  describe("Sorting by urgencyScore", () => {
    // Test 12: Tasks sorted by urgency score descending
    it("sorts tasks by urgencyScore descending", () => {
      const tasks: AggregatedTask[] = [
        {
          id: "low",
          source: "manual",
          entityType: null,
          entityId: null,
          title: "Low urgency",
          description: null,
          dueAt: null,
          urgencyScore: 10,
          priority: "low",
          clientId: null,
          clientName: null,
          pinnedAt: null,
          snoozedUntil: null,
          dealValueCents: null,
          daysInStage: null,
          category: null,
          assignedTo: null,
        },
        {
          id: "high",
          source: "manual",
          entityType: null,
          entityId: null,
          title: "High urgency",
          description: null,
          dueAt: null,
          urgencyScore: 100,
          priority: "high",
          clientId: null,
          clientName: null,
          pinnedAt: null,
          snoozedUntil: null,
          dealValueCents: null,
          daysInStage: null,
          category: null,
          assignedTo: null,
        },
        {
          id: "medium",
          source: "manual",
          entityType: null,
          entityId: null,
          title: "Medium urgency",
          description: null,
          dueAt: null,
          urgencyScore: 50,
          priority: "medium",
          clientId: null,
          clientName: null,
          pinnedAt: null,
          snoozedUntil: null,
          dealValueCents: null,
          daysInStage: null,
          category: null,
          assignedTo: null,
        },
      ];

      // Sort descending
      const sorted = [...tasks].sort((a, b) => b.urgencyScore - a.urgencyScore);

      expect(sorted.map((t) => t.id)).toEqual(["high", "medium", "low"]);
    });
  });
});
