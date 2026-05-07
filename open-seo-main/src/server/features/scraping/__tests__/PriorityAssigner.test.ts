/**
 * PriorityAssigner Unit Tests.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import { describe, it, expect } from "vitest";
import {
  assignPriority,
  selectQueue,
  toBullMQPriority,
  fromBullMQPriority,
  getPrioritySLA,
  getPriorityDescription,
  BULLMQ_PRIORITY_VALUES,
} from "../queue/PriorityAssigner";
import { SCRAPE_QUEUE_NAMES } from "../queue/queue.types";

describe("PriorityAssigner", () => {
  describe("assignPriority", () => {
    it("should use explicit priority if provided", () => {
      expect(assignPriority({ priority: "low", source: "ui" })).toBe("low");
      expect(assignPriority({ priority: "critical", source: "scheduler" })).toBe("critical");
    });

    it("should assign critical priority for UI non-audit requests", () => {
      expect(
        assignPriority({
          source: "ui",
          metadata: { featureContext: "competitor_spy" },
        })
      ).toBe("critical");
    });

    it("should assign high priority for UI site audit requests", () => {
      expect(
        assignPriority({
          source: "ui",
          metadata: { featureContext: "site_audit" },
        })
      ).toBe("high");
    });

    it("should assign normal priority for API paid features", () => {
      expect(
        assignPriority({
          source: "api",
          metadata: { featureContext: "competitor_spy" },
        })
      ).toBe("normal");

      expect(
        assignPriority({
          source: "api",
          metadata: { featureContext: "content_brief" },
        })
      ).toBe("normal");

      expect(
        assignPriority({
          source: "api",
          metadata: { featureContext: "serp_analysis" },
        })
      ).toBe("normal");
    });

    it("should assign low priority for API non-paid features", () => {
      expect(
        assignPriority({
          source: "api",
          metadata: { featureContext: "cache_warming" },
        })
      ).toBe("low");
    });

    it("should assign low priority for scheduler source", () => {
      expect(assignPriority({ source: "scheduler" })).toBe("low");
    });

    it("should assign low priority for system source", () => {
      expect(assignPriority({ source: "system" })).toBe("low");
    });

    it("should default to normal priority when no matches", () => {
      expect(assignPriority({})).toBe("normal");
    });
  });

  describe("selectQueue", () => {
    it("should select priority queue for UI source", () => {
      expect(selectQueue("low", "ui")).toBe(SCRAPE_QUEUE_NAMES.PRIORITY);
      expect(selectQueue("normal", "ui")).toBe(SCRAPE_QUEUE_NAMES.PRIORITY);
    });

    it("should select priority queue for critical/high priority", () => {
      expect(selectQueue("critical", "api")).toBe(SCRAPE_QUEUE_NAMES.PRIORITY);
      expect(selectQueue("high", "api")).toBe(SCRAPE_QUEUE_NAMES.PRIORITY);
    });

    it("should select standard queue for normal priority", () => {
      expect(selectQueue("normal", "api")).toBe(SCRAPE_QUEUE_NAMES.STANDARD);
      expect(selectQueue("normal", "scheduler")).toBe(SCRAPE_QUEUE_NAMES.STANDARD);
    });

    it("should select background queue for low priority", () => {
      expect(selectQueue("low", "api")).toBe(SCRAPE_QUEUE_NAMES.BACKGROUND);
      expect(selectQueue("low", "scheduler")).toBe(SCRAPE_QUEUE_NAMES.BACKGROUND);
      expect(selectQueue("low", "system")).toBe(SCRAPE_QUEUE_NAMES.BACKGROUND);
    });
  });

  describe("toBullMQPriority", () => {
    it("should convert to BullMQ priority values", () => {
      expect(toBullMQPriority("critical")).toBe(1);
      expect(toBullMQPriority("high")).toBe(5);
      expect(toBullMQPriority("normal")).toBe(10);
      expect(toBullMQPriority("low")).toBe(20);
    });

    it("should match BULLMQ_PRIORITY_VALUES constant", () => {
      expect(toBullMQPriority("critical")).toBe(BULLMQ_PRIORITY_VALUES.critical);
      expect(toBullMQPriority("high")).toBe(BULLMQ_PRIORITY_VALUES.high);
      expect(toBullMQPriority("normal")).toBe(BULLMQ_PRIORITY_VALUES.normal);
      expect(toBullMQPriority("low")).toBe(BULLMQ_PRIORITY_VALUES.low);
    });
  });

  describe("fromBullMQPriority", () => {
    it("should convert from BullMQ priority values", () => {
      expect(fromBullMQPriority(1)).toBe("critical");
      expect(fromBullMQPriority(5)).toBe("high");
      expect(fromBullMQPriority(10)).toBe("normal");
      expect(fromBullMQPriority(20)).toBe("low");
    });

    it("should handle edge cases", () => {
      expect(fromBullMQPriority(0)).toBe("critical");
      expect(fromBullMQPriority(3)).toBe("high");
      expect(fromBullMQPriority(7)).toBe("normal");
      expect(fromBullMQPriority(15)).toBe("low");
      expect(fromBullMQPriority(100)).toBe("low");
    });
  });

  describe("getPrioritySLA", () => {
    it("should return correct SLA in milliseconds", () => {
      expect(getPrioritySLA("critical")).toBe(60_000); // 1 min
      expect(getPrioritySLA("high")).toBe(300_000); // 5 min
      expect(getPrioritySLA("normal")).toBe(900_000); // 15 min
      expect(getPrioritySLA("low")).toBe(3_600_000); // 1 hour
    });
  });

  describe("getPriorityDescription", () => {
    it("should return human-readable descriptions", () => {
      expect(getPriorityDescription("critical")).toContain("immediate");
      expect(getPriorityDescription("high")).toContain("5 minutes");
      expect(getPriorityDescription("normal")).toContain("15 minutes");
      expect(getPriorityDescription("low")).toContain("1 hour");
    });
  });
});

describe("BULLMQ_PRIORITY_VALUES", () => {
  it("should have lower values for higher priority", () => {
    expect(BULLMQ_PRIORITY_VALUES.critical).toBeLessThan(BULLMQ_PRIORITY_VALUES.high);
    expect(BULLMQ_PRIORITY_VALUES.high).toBeLessThan(BULLMQ_PRIORITY_VALUES.normal);
    expect(BULLMQ_PRIORITY_VALUES.normal).toBeLessThan(BULLMQ_PRIORITY_VALUES.low);
  });
});
