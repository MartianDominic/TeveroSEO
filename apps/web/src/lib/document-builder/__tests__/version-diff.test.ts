/**
 * Version Diff Service Tests
 * Phase 102-05: A/B testing UI and version diff
 *
 * Tests for block-level and word-level diff computation.
 */

import { describe, expect, it } from "vitest";

import {
  computeBlockDiff,
  computeTextDiff,
  extractTextFromContent,
  getDiffSummary,
  hasChanges,
  type BlockForDiff,
} from "../version-diff";
import type { TipTapContent } from "../types";

const createBlock = (
  id: string,
  type: string,
  position: number,
  text: string
): BlockForDiff => ({
  id,
  type,
  position,
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  },
});

describe("version-diff", () => {
  describe("computeBlockDiff", () => {
    it("detects added blocks", () => {
      const oldBlocks: BlockForDiff[] = [createBlock("1", "pain_amplifier", 0, "Old content")];
      const newBlocks: BlockForDiff[] = [
        createBlock("1", "pain_amplifier", 0, "Old content"),
        createBlock("2", "credibility", 1, "New content"),
      ];

      const diff = computeBlockDiff(oldBlocks, newBlocks);

      expect(diff.length).toBe(2);
      expect(diff.find((d) => d.blockId === "2")?.status).toBe("added");
    });

    it("detects removed blocks", () => {
      const oldBlocks: BlockForDiff[] = [
        createBlock("1", "pain_amplifier", 0, "Content 1"),
        createBlock("2", "credibility", 1, "Content 2"),
      ];
      const newBlocks: BlockForDiff[] = [createBlock("1", "pain_amplifier", 0, "Content 1")];

      const diff = computeBlockDiff(oldBlocks, newBlocks);

      expect(diff.find((d) => d.blockId === "2")?.status).toBe("removed");
    });

    it("detects modified blocks", () => {
      const oldBlocks: BlockForDiff[] = [createBlock("1", "pain_amplifier", 0, "Old text")];
      const newBlocks: BlockForDiff[] = [createBlock("1", "pain_amplifier", 0, "New text")];

      const diff = computeBlockDiff(oldBlocks, newBlocks);

      expect(diff.length).toBe(1);
      expect(diff[0].status).toBe("modified");
    });

    it("detects unchanged blocks", () => {
      const oldBlocks: BlockForDiff[] = [createBlock("1", "pain_amplifier", 0, "Same content")];
      const newBlocks: BlockForDiff[] = [createBlock("1", "pain_amplifier", 0, "Same content")];

      const diff = computeBlockDiff(oldBlocks, newBlocks);

      expect(diff.length).toBe(1);
      expect(diff[0].status).toBe("unchanged");
    });

    it("handles empty arrays", () => {
      const diff1 = computeBlockDiff([], []);
      expect(diff1.length).toBe(0);

      const diff2 = computeBlockDiff([], [createBlock("1", "cta", 0, "Content")]);
      expect(diff2.length).toBe(1);
      expect(diff2[0].status).toBe("added");

      const diff3 = computeBlockDiff([createBlock("1", "cta", 0, "Content")], []);
      expect(diff3.length).toBe(1);
      expect(diff3[0].status).toBe("removed");
    });

    it("handles complex scenario with multiple changes", () => {
      const oldBlocks: BlockForDiff[] = [
        createBlock("1", "pain_amplifier", 0, "Pain content"),
        createBlock("2", "credibility", 1, "Credibility content"),
        createBlock("3", "cta", 2, "CTA content"),
      ];
      const newBlocks: BlockForDiff[] = [
        createBlock("1", "pain_amplifier", 0, "Pain content"), // unchanged
        createBlock("2", "credibility", 1, "Modified credibility"), // modified
        createBlock("4", "social_proof", 2, "New proof"), // added (3 removed)
      ];

      const diff = computeBlockDiff(oldBlocks, newBlocks);

      const summary = getDiffSummary(diff);
      expect(summary.unchanged).toBe(1);
      expect(summary.modified).toBe(1);
      expect(summary.added).toBe(1);
      expect(summary.removed).toBe(1);
    });
  });

  describe("computeTextDiff", () => {
    it("returns unchanged for identical text", () => {
      const diff = computeTextDiff("Hello world", "Hello world");

      expect(diff.length).toBe(1);
      expect(diff[0].status).toBe("unchanged");
      expect(diff[0].text).toBe("Hello world");
    });

    it("detects added text", () => {
      const diff = computeTextDiff("Hello", "Hello world");

      expect(diff.some((s) => s.status === "added" && s.text.includes("world"))).toBe(true);
    });

    it("detects removed text", () => {
      const diff = computeTextDiff("Hello world", "Hello");

      expect(diff.some((s) => s.status === "removed" && s.text.includes("world"))).toBe(true);
    });

    it("handles empty strings", () => {
      const diff1 = computeTextDiff("", "");
      expect(diff1.length).toBe(0);

      const diff2 = computeTextDiff("", "Hello");
      expect(diff2.length).toBe(1);
      expect(diff2[0].status).toBe("added");

      const diff3 = computeTextDiff("Hello", "");
      expect(diff3.length).toBe(1);
      expect(diff3[0].status).toBe("removed");
    });

    it("handles word-level changes", () => {
      const diff = computeTextDiff(
        "The quick brown fox",
        "The slow brown dog"
      );

      // Should have: unchanged (The), removed (quick), added (slow), unchanged (brown), removed (fox), added (dog)
      expect(diff.some((s) => s.status === "unchanged" && s.text.includes("The"))).toBe(true);
      expect(diff.some((s) => s.status === "removed" && s.text.includes("quick"))).toBe(true);
      expect(diff.some((s) => s.status === "added" && s.text.includes("slow"))).toBe(true);
    });

    it("preserves word boundaries", () => {
      const diff = computeTextDiff("hello world", "hello there world");

      const addedSegment = diff.find((s) => s.status === "added");
      expect(addedSegment?.text).toContain("there");
    });
  });

  describe("extractTextFromContent", () => {
    it("extracts text from simple paragraph", () => {
      const content: TipTapContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Hello world" }],
          },
        ],
      };

      const text = extractTextFromContent(content);
      expect(text).toContain("Hello world");
    });

    it("extracts text from nested content", () => {
      const content: TipTapContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "First" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Second" }],
          },
        ],
      };

      const text = extractTextFromContent(content);
      expect(text).toContain("First");
      expect(text).toContain("Second");
    });

    it("handles empty content", () => {
      const content: TipTapContent = { type: "doc", content: [] };
      const text = extractTextFromContent(content);
      expect(text).toBe("");
    });

    it("handles null/undefined", () => {
      expect(extractTextFromContent(null as unknown as TipTapContent)).toBe("");
      expect(extractTextFromContent(undefined as unknown as TipTapContent)).toBe("");
    });
  });

  describe("getDiffSummary", () => {
    it("counts all change types", () => {
      const diff = computeBlockDiff(
        [
          createBlock("1", "pain", 0, "A"),
          createBlock("2", "cta", 1, "B"),
          createBlock("3", "offer", 2, "C"),
        ],
        [
          createBlock("1", "pain", 0, "A"), // unchanged
          createBlock("2", "cta", 1, "Modified"), // modified
          createBlock("4", "new", 2, "D"), // added (3 removed)
        ]
      );

      const summary = getDiffSummary(diff);

      expect(summary.unchanged).toBe(1);
      expect(summary.modified).toBe(1);
      expect(summary.added).toBe(1);
      expect(summary.removed).toBe(1);
    });
  });

  describe("hasChanges", () => {
    it("returns false when all blocks unchanged", () => {
      const diff = computeBlockDiff(
        [createBlock("1", "pain", 0, "Same")],
        [createBlock("1", "pain", 0, "Same")]
      );

      expect(hasChanges(diff)).toBe(false);
    });

    it("returns true when any block changed", () => {
      const diff = computeBlockDiff(
        [createBlock("1", "pain", 0, "Old")],
        [createBlock("1", "pain", 0, "New")]
      );

      expect(hasChanges(diff)).toBe(true);
    });

    it("returns true when blocks added", () => {
      const diff = computeBlockDiff(
        [],
        [createBlock("1", "pain", 0, "New")]
      );

      expect(hasChanges(diff)).toBe(true);
    });

    it("returns true when blocks removed", () => {
      const diff = computeBlockDiff(
        [createBlock("1", "pain", 0, "Old")],
        []
      );

      expect(hasChanges(diff)).toBe(true);
    });
  });
});
