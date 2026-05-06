/**
 * Research Session Schema Tests
 * Phase 93-01: Test schema exports and type safety
 */
import { describe, it, expect } from "vitest";
import {
  researchSessions,
  RESEARCH_MODES,
  type ResearchMode,
  type SessionMetadata,
  type ResearchSessionSelect,
  type ResearchSessionInsert,
} from "./research-session-schema";

describe("research-session-schema", () => {
  describe("RESEARCH_MODES constant", () => {
    it("should export all 4 research modes", () => {
      expect(RESEARCH_MODES).toEqual([
        "EXPAND",
        "DEEP_DIVE",
        "COMPETITOR",
        "REFRESH_VOLUMES",
      ]);
    });

    it("should have length of 4", () => {
      expect(RESEARCH_MODES).toHaveLength(4);
    });
  });

  describe("ResearchMode type", () => {
    it("should accept valid research modes", () => {
      const validModes: ResearchMode[] = [
        "EXPAND",
        "DEEP_DIVE",
        "COMPETITOR",
        "REFRESH_VOLUMES",
      ];
      expect(validModes).toHaveLength(4);
    });
  });

  describe("SessionMetadata interface", () => {
    it("should allow all optional fields", () => {
      const metadata: SessionMetadata = {
        cluster_id: "test-cluster",
        competitor_domain: "example.com",
        parent_session_id: "parent-123",
        user_intent: "exploring new market",
      };
      expect(metadata).toBeDefined();
    });

    it("should allow empty metadata", () => {
      const metadata: SessionMetadata = {};
      expect(metadata).toBeDefined();
    });
  });

  describe("researchSessions table", () => {
    it("should have correct table name", () => {
      expect(researchSessions[Symbol.for("drizzle:Name")]).toBe(
        "research_sessions"
      );
    });

    it("should export ResearchSessionSelect type", () => {
      const mockSession: ResearchSessionSelect = {
        id: "test-123",
        prospectId: "prospect-456",
        mode: "EXPAND",
        seedKeywords: ["seo tools", "keyword research"],
        locationCode: 2840,
        languageCode: "en",
        newKeywordsCount: 150,
        duplicateCount: 25,
        totalCostUsd: 0.15,
        triggeredBy: "user-789",
        metadata: null,
        createdAt: new Date(),
      };
      expect(mockSession.id).toBe("test-123");
    });

    it("should export ResearchSessionInsert type", () => {
      const mockInsert: ResearchSessionInsert = {
        id: "test-123",
        prospectId: "prospect-456",
        mode: "DEEP_DIVE",
        seedKeywords: ["content marketing"],
        locationCode: 2840,
        languageCode: "en",
        newKeywordsCount: 200,
        duplicateCount: 10,
        totalCostUsd: 0.2,
        triggeredBy: "system",
        metadata: {
          cluster_id: "cluster-abc",
        },
      };
      expect(mockInsert.mode).toBe("DEEP_DIVE");
    });
  });
});
