/**
 * Version Diff Service
 * Phase 102-05: A/B testing UI and version diff
 *
 * Implements block-level and word-level diff for comparing document versions.
 * Used by VersionDiff component for side-by-side comparison.
 */

import type { TipTapContent } from "./types";

// =====================================
// Types
// =====================================

/**
 * Status of a block in the diff.
 */
export type BlockDiffStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Status of a text segment in the diff.
 */
export type TextDiffStatus = "added" | "removed" | "unchanged";

/**
 * Block diff result.
 */
export interface BlockDiffItem {
  blockId: string;
  blockType: string;
  status: BlockDiffStatus;
  /** Original content (for removed/modified) */
  oldContent?: TipTapContent;
  /** New content (for added/modified) */
  newContent?: TipTapContent;
  /** Position in old version (if applicable) */
  oldPosition?: number;
  /** Position in new version (if applicable) */
  newPosition?: number;
}

/**
 * Text diff segment.
 */
export interface TextDiffSegment {
  text: string;
  status: TextDiffStatus;
}

/**
 * Block comparison input.
 */
export interface BlockForDiff {
  id: string;
  type: string;
  position: number;
  content: TipTapContent;
}

// =====================================
// Block-Level Diff
// =====================================

/**
 * Compute diff between two arrays of blocks.
 *
 * Uses block ID matching to determine:
 * - Added blocks (in new, not in old)
 * - Removed blocks (in old, not in new)
 * - Modified blocks (same ID, different content)
 * - Unchanged blocks (same ID, same content)
 *
 * @param oldBlocks - Blocks from the old version
 * @param newBlocks - Blocks from the new version
 * @returns Array of BlockDiffItem with diff status
 */
export function computeBlockDiff(
  oldBlocks: BlockForDiff[],
  newBlocks: BlockForDiff[]
): BlockDiffItem[] {
  const result: BlockDiffItem[] = [];
  const oldBlockMap = new Map(oldBlocks.map((b) => [b.id, b]));
  const newBlockMap = new Map(newBlocks.map((b) => [b.id, b]));
  const processedIds = new Set<string>();

  // Process old blocks first to maintain order for removed/modified
  for (const oldBlock of oldBlocks) {
    const newBlock = newBlockMap.get(oldBlock.id);
    processedIds.add(oldBlock.id);

    if (!newBlock) {
      // Block was removed
      result.push({
        blockId: oldBlock.id,
        blockType: oldBlock.type,
        status: "removed",
        oldContent: oldBlock.content,
        oldPosition: oldBlock.position,
      });
    } else {
      // Block exists in both - check if modified
      const isModified = !deepEqual(oldBlock.content, newBlock.content);

      result.push({
        blockId: oldBlock.id,
        blockType: oldBlock.type,
        status: isModified ? "modified" : "unchanged",
        oldContent: oldBlock.content,
        newContent: newBlock.content,
        oldPosition: oldBlock.position,
        newPosition: newBlock.position,
      });
    }
  }

  // Process new blocks to find additions
  for (const newBlock of newBlocks) {
    if (!processedIds.has(newBlock.id)) {
      // Block was added
      result.push({
        blockId: newBlock.id,
        blockType: newBlock.type,
        status: "added",
        newContent: newBlock.content,
        newPosition: newBlock.position,
      });
    }
  }

  // Sort by position for display (new position takes precedence)
  result.sort((a, b) => {
    const posA = a.newPosition ?? a.oldPosition ?? 0;
    const posB = b.newPosition ?? b.oldPosition ?? 0;
    return posA - posB;
  });

  return result;
}

// =====================================
// Text-Level Diff (Word-based)
// =====================================

/**
 * Compute word-level diff between two text strings.
 *
 * Uses Longest Common Subsequence (LCS) algorithm to find
 * the optimal alignment of words between old and new text.
 *
 * @param oldText - Original text
 * @param newText - Updated text
 * @returns Array of TextDiffSegment with diff status
 */
export function computeTextDiff(
  oldText: string,
  newText: string
): TextDiffSegment[] {
  // Handle edge cases
  if (oldText === newText) {
    return oldText ? [{ text: oldText, status: "unchanged" }] : [];
  }

  if (!oldText) {
    return newText ? [{ text: newText, status: "added" }] : [];
  }

  if (!newText) {
    return oldText ? [{ text: oldText, status: "removed" }] : [];
  }

  // Tokenize into words (preserving whitespace for reconstruction)
  const oldWords = tokenizeWords(oldText);
  const newWords = tokenizeWords(newText);

  // Compute LCS
  const lcs = computeLCS(oldWords, newWords);

  // Build diff segments from LCS
  return buildDiffSegments(oldWords, newWords, lcs);
}

/**
 * Tokenize text into words, preserving whitespace.
 * Each token is either a word or whitespace.
 */
function tokenizeWords(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Compute Longest Common Subsequence indices.
 * Returns array of [oldIndex, newIndex] pairs.
 */
function computeLCS(
  oldWords: string[],
  newWords: string[]
): [number, number][] {
  const m = oldWords.length;
  const n = newWords.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS indices
  const result: [number, number][] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldWords[i - 1] === newWords[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Build diff segments from LCS result.
 */
function buildDiffSegments(
  oldWords: string[],
  newWords: string[],
  lcs: [number, number][]
): TextDiffSegment[] {
  const segments: TextDiffSegment[] = [];
  let oldIdx = 0;
  let newIdx = 0;

  for (const [lcsOldIdx, lcsNewIdx] of lcs) {
    // Add removed words (in old but before LCS match)
    if (oldIdx < lcsOldIdx) {
      const removedText = oldWords.slice(oldIdx, lcsOldIdx).join("");
      if (removedText.trim()) {
        segments.push({ text: removedText, status: "removed" });
      }
    }

    // Add added words (in new but before LCS match)
    if (newIdx < lcsNewIdx) {
      const addedText = newWords.slice(newIdx, lcsNewIdx).join("");
      if (addedText.trim()) {
        segments.push({ text: addedText, status: "added" });
      }
    }

    // Add unchanged word (the LCS match)
    segments.push({ text: oldWords[lcsOldIdx], status: "unchanged" });

    oldIdx = lcsOldIdx + 1;
    newIdx = lcsNewIdx + 1;
  }

  // Handle remaining words after last LCS match
  if (oldIdx < oldWords.length) {
    const removedText = oldWords.slice(oldIdx).join("");
    if (removedText.trim()) {
      segments.push({ text: removedText, status: "removed" });
    }
  }

  if (newIdx < newWords.length) {
    const addedText = newWords.slice(newIdx).join("");
    if (addedText.trim()) {
      segments.push({ text: addedText, status: "added" });
    }
  }

  // Merge adjacent segments with same status
  return mergeAdjacentSegments(segments);
}

/**
 * Merge adjacent segments with the same status.
 */
function mergeAdjacentSegments(
  segments: TextDiffSegment[]
): TextDiffSegment[] {
  const merged: TextDiffSegment[] = [];

  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.status === segment.status) {
      last.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

// =====================================
// TipTap Content Helpers
// =====================================

/**
 * Extract plain text from TipTap content.
 */
export function extractTextFromContent(content: TipTapContent): string {
  if (!content) return "";

  if (content.text) {
    return content.text;
  }

  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractTextFromContent).join(" ");
  }

  return "";
}

/**
 * Deep equality check for objects.
 */
function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== "object" ||
    typeof obj2 !== "object" ||
    obj1 === null ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1 as Record<string, unknown>);
  const keys2 = Object.keys(obj2 as Record<string, unknown>);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (
      !keys2.includes(key) ||
      !deepEqual(
        (obj1 as Record<string, unknown>)[key],
        (obj2 as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }

  return true;
}

// =====================================
// Summary Helpers
// =====================================

/**
 * Get summary of diff changes.
 */
export function getDiffSummary(diff: BlockDiffItem[]): {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
} {
  return {
    added: diff.filter((d) => d.status === "added").length,
    removed: diff.filter((d) => d.status === "removed").length,
    modified: diff.filter((d) => d.status === "modified").length,
    unchanged: diff.filter((d) => d.status === "unchanged").length,
  };
}

/**
 * Check if diff has any changes.
 */
export function hasChanges(diff: BlockDiffItem[]): boolean {
  return diff.some((d) => d.status !== "unchanged");
}
