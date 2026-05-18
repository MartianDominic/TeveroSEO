"use client";

/**
 * VersionDiff - Side-by-side comparison with diff highlighting.
 * Phase 102-05: A/B testing UI and version diff
 *
 * Features:
 * - Side-by-side layout: Version A | Version B
 * - Block-level diff highlighting per UI-SPEC:
 *   - Added block: background --success-soft, left border 3px --success
 *   - Removed block: background --error-soft, left border 3px --error
 *   - Modified block: background --warning-soft, left border 3px --warning
 *   - Unchanged: transparent
 * - Inline text diff within modified blocks:
 *   - Added text: background --success-soft, no strikethrough
 *   - Removed text: background --error-soft, strikethrough
 * - Version selector dropdowns at top
 * - "No changes between these versions" empty state
 */

import { type FC, useMemo, memo } from "react";
import { GitCompare, Plus, Minus, Edit3, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TipTapContent } from "@/lib/document-builder/types";
import {
  computeBlockDiff,
  computeTextDiff,
  extractTextFromContent,
  getDiffSummary,
  hasChanges,
  type BlockDiffItem,
  type BlockDiffStatus,
  type TextDiffSegment,
} from "@/lib/document-builder/version-diff";

// =====================================
// Types
// =====================================

/**
 * Version data for comparison.
 */
export interface VersionData {
  id: string;
  label: string;
  timestamp?: string;
  blocks: VersionBlock[];
}

/**
 * Block within a version.
 */
export interface VersionBlock {
  id: string;
  type: string;
  position: number;
  content: TipTapContent;
  title?: string;
}

/**
 * Props for VersionDiff component.
 */
export interface VersionDiffProps {
  /** Left side version (older) */
  versionA: VersionData;
  /** Right side version (newer) */
  versionB: VersionData;
  /** Available versions for selection */
  availableVersions?: VersionData[];
  /** Callback when version A is changed */
  onVersionAChange?: (versionId: string) => void;
  /** Callback when version B is changed */
  onVersionBChange?: (versionId: string) => void;
  /** Additional class names */
  className?: string;
}

// =====================================
// Styling Helpers
// =====================================

/**
 * Get block styling based on diff status.
 */
function getBlockStyles(status: BlockDiffStatus): string {
  switch (status) {
    case "added":
      return "bg-success-soft border-l-[3px] border-l-success";
    case "removed":
      return "bg-error-soft border-l-[3px] border-l-error";
    case "modified":
      return "bg-warning-soft border-l-[3px] border-l-warning";
    case "unchanged":
    default:
      return "bg-transparent border-l-[3px] border-l-transparent";
  }
}

/**
 * Get status icon.
 */
function getStatusIcon(status: BlockDiffStatus) {
  switch (status) {
    case "added":
      return <Plus className="h-4 w-4 text-success" />;
    case "removed":
      return <Minus className="h-4 w-4 text-error" />;
    case "modified":
      return <Edit3 className="h-4 w-4 text-warning" />;
    case "unchanged":
      return <Check className="h-4 w-4 text-text-4" />;
  }
}

// =====================================
// Sub-components
// =====================================

/**
 * Version selector dropdown.
 */
interface VersionSelectorProps {
  label: string;
  currentVersionId: string;
  versions: VersionData[];
  onChange: (versionId: string) => void;
  side: "left" | "right";
}

const VersionSelectorComponent: FC<VersionSelectorProps> = ({
  label,
  currentVersionId,
  versions,
  onChange,
  side,
}) => {
  const currentVersion = versions.find((v) => v.id === currentVersionId);
  const selectId = `version-selector-${side}`;

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor={selectId}
        className="text-xs font-medium text-text-3 uppercase tracking-wide"
      >
        {label}
      </label>
      <select
        id={selectId}
        value={currentVersionId}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Select ${label.toLowerCase()} for comparison`}
        className={cn(
          "px-2 py-1",
          "text-sm text-text-1",
          "bg-surface-2",
          "border border-hairline rounded-md",
          "focus:outline-none focus:ring-2 focus:ring-accent"
        )}
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.label}
            {version.timestamp && ` (${version.timestamp})`}
          </option>
        ))}
      </select>
    </div>
  );
};

const VersionSelector = memo(VersionSelectorComponent, (prev, next) => {
  return (
    prev.currentVersionId === next.currentVersionId &&
    prev.versions.length === next.versions.length &&
    prev.side === next.side
  );
});

VersionSelector.displayName = "VersionSelector";

/**
 * Inline text diff display.
 */
interface TextDiffDisplayProps {
  segments: TextDiffSegment[];
}

const TextDiffDisplayComponent: FC<TextDiffDisplayProps> = ({ segments }) => {
  return (
    <span>
      {segments.map((segment, idx) => {
        if (segment.status === "added") {
          return (
            <ins
              key={idx}
              className="bg-success-soft px-0.5 rounded no-underline"
            >
              {segment.text}
            </ins>
          );
        }
        if (segment.status === "removed") {
          return (
            <del
              key={idx}
              className="bg-error-soft px-0.5 rounded"
            >
              {segment.text}
            </del>
          );
        }
        return <span key={idx}>{segment.text}</span>;
      })}
    </span>
  );
};

const TextDiffDisplay = memo(TextDiffDisplayComponent, (prev, next) => {
  return prev.segments.length === next.segments.length;
});

TextDiffDisplay.displayName = "TextDiffDisplay";

/**
 * Block diff card.
 */
interface BlockDiffCardProps {
  diffItem: BlockDiffItem;
  side: "left" | "right";
}

const BlockDiffCardComponent: FC<BlockDiffCardProps> = ({ diffItem, side }) => {
  const { status, blockType, oldContent, newContent } = diffItem;

  // Determine content to show based on side and status
  const content = side === "left" ? oldContent : newContent;
  const contentText = content ? extractTextFromContent(content) : "";

  // For modified blocks, compute text diff
  const textDiff = useMemo(() => {
    if (status === "modified" && oldContent && newContent) {
      const oldText = extractTextFromContent(oldContent);
      const newText = extractTextFromContent(newContent);
      return computeTextDiff(oldText, newText);
    }
    return null;
  }, [status, oldContent, newContent]);

  // Don't render placeholder for removed blocks on right side
  if (status === "removed" && side === "right") {
    return (
      <div
        className={cn(
          "p-4",
          "rounded-lg",
          "border border-dashed border-error/30",
          "bg-error-soft/20",
          "min-h-[60px]",
          "flex items-center justify-center"
        )}
      >
        <span className="text-sm text-error/60 italic">Block removed</span>
      </div>
    );
  }

  // Don't render placeholder for added blocks on left side
  if (status === "added" && side === "left") {
    return (
      <div
        className={cn(
          "p-4",
          "rounded-lg",
          "border border-dashed border-success/30",
          "bg-success-soft/20",
          "min-h-[60px]",
          "flex items-center justify-center"
        )}
      >
        <span className="text-sm text-success/60 italic">Block added</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-4",
        "rounded-lg",
        getBlockStyles(status)
      )}
    >
      {/* Block header */}
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon(status)}
        <span className="text-xs font-medium text-text-3 uppercase tracking-wide">
          {blockType.replace(/_/g, " ")}
        </span>
      </div>

      {/* Block content */}
      <div className="text-sm text-text-2">
        {status === "modified" && textDiff ? (
          <TextDiffDisplay
            segments={side === "left"
              ? textDiff.filter((s) => s.status !== "added")
              : textDiff.filter((s) => s.status !== "removed")
            }
          />
        ) : (
          <p>{contentText || <em className="text-text-4">Empty block</em>}</p>
        )}
      </div>
    </div>
  );
};

const BlockDiffCard = memo(BlockDiffCardComponent, (prev, next) => {
  // Compare all fields that affect rendering, including content for text diff
  return (
    prev.diffItem.blockId === next.diffItem.blockId &&
    prev.diffItem.status === next.diffItem.status &&
    prev.side === next.side &&
    // For modified blocks, content changes affect the text diff
    prev.diffItem.oldContent === next.diffItem.oldContent &&
    prev.diffItem.newContent === next.diffItem.newContent
  );
});

BlockDiffCard.displayName = "BlockDiffCard";

/**
 * Diff summary bar.
 */
interface DiffSummaryBarProps {
  diff: BlockDiffItem[];
}

const DiffSummaryBarComponent: FC<DiffSummaryBarProps> = ({ diff }) => {
  const summary = getDiffSummary(diff);

  return (
    <div className="flex items-center gap-4 text-xs">
      {summary.added > 0 && (
        <span className="flex items-center gap-1 text-success">
          <Plus className="h-3 w-3" />
          {summary.added} added
        </span>
      )}
      {summary.removed > 0 && (
        <span className="flex items-center gap-1 text-error">
          <Minus className="h-3 w-3" />
          {summary.removed} removed
        </span>
      )}
      {summary.modified > 0 && (
        <span className="flex items-center gap-1 text-warning">
          <Edit3 className="h-3 w-3" />
          {summary.modified} modified
        </span>
      )}
      {!hasChanges(diff) && (
        <span className="text-text-4">No changes</span>
      )}
    </div>
  );
};

const DiffSummaryBar = memo(DiffSummaryBarComponent, (prev, next) => {
  return prev.diff.length === next.diff.length;
});

DiffSummaryBar.displayName = "DiffSummaryBar";

// =====================================
// Main Component
// =====================================

/**
 * VersionDiff component.
 *
 * Side-by-side comparison of two document versions with
 * block-level and word-level diff highlighting.
 */
const VersionDiffComponent: FC<VersionDiffProps> = ({
  versionA,
  versionB,
  availableVersions,
  onVersionAChange,
  onVersionBChange,
  className,
}) => {
  // Compute block diff
  const diff = useMemo(
    () => computeBlockDiff(versionA.blocks, versionB.blocks),
    [versionA.blocks, versionB.blocks]
  );

  const showVersionSelectors =
    availableVersions &&
    availableVersions.length > 1 &&
    onVersionAChange &&
    onVersionBChange;

  const hasDiffChanges = hasChanges(diff);

  return (
    <div
      className={cn(
        "flex flex-col",
        "bg-surface",
        "rounded-lg",
        "shadow-card",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between",
          "px-6 py-4",
          "border-b border-hairline"
        )}
      >
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text-1">Version Comparison</h2>
        </div>

        <DiffSummaryBar diff={diff} />
      </div>

      {/* Version selectors */}
      {showVersionSelectors && (
        <div
          className={cn(
            "grid grid-cols-2 gap-4",
            "px-6 py-3",
            "border-b border-hairline",
            "bg-surface-2"
          )}
        >
          <VersionSelector
            label="Version A"
            currentVersionId={versionA.id}
            versions={availableVersions}
            onChange={onVersionAChange}
            side="left"
          />
          <VersionSelector
            label="Version B"
            currentVersionId={versionB.id}
            versions={availableVersions}
            onChange={onVersionBChange}
            side="right"
          />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {!hasDiffChanges ? (
          // Empty state
          <div
            className={cn(
              "flex flex-col items-center justify-center",
              "py-12",
              "text-center"
            )}
          >
            <Check className="h-12 w-12 text-success mb-4" />
            <h3 className="text-lg font-medium text-text-1 mb-2">
              No changes between these versions
            </h3>
            <p className="text-sm text-text-3">
              The selected versions have identical content.
            </p>
          </div>
        ) : (
          // Side-by-side diff with proper WCAG 2.1 AA structure
          <div className="grid grid-cols-2 gap-6">
            {/* Left column (Version A / Old) */}
            <div
              className="space-y-4"
              role="region"
              aria-label={`${versionA.label} - original version${versionA.timestamp ? ` (${versionA.timestamp})` : ""}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-medium text-text-2">
                  {versionA.label}
                </h3>
                {versionA.timestamp && (
                  <span className="text-xs text-text-4">
                    {versionA.timestamp}
                  </span>
                )}
              </div>

              {diff.map((item) => (
                <BlockDiffCard
                  key={item.blockId}
                  diffItem={item}
                  side="left"
                />
              ))}
            </div>

            {/* Right column (Version B / New) */}
            <div
              className="space-y-4"
              role="region"
              aria-label={`${versionB.label} - new version${versionB.timestamp ? ` (${versionB.timestamp})` : ""}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-medium text-text-2">
                  {versionB.label}
                </h3>
                {versionB.timestamp && (
                  <span className="text-xs text-text-4">
                    {versionB.timestamp}
                  </span>
                )}
              </div>

              {diff.map((item) => (
                <BlockDiffCard
                  key={item.blockId}
                  diffItem={item}
                  side="right"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Memoized VersionDiff - only re-renders when version data changes.
 */
export const VersionDiff = memo(VersionDiffComponent, (prev, next) => {
  return (
    prev.versionA.id === next.versionA.id &&
    prev.versionB.id === next.versionB.id &&
    prev.versionA.blocks.length === next.versionA.blocks.length &&
    prev.versionB.blocks.length === next.versionB.blocks.length &&
    prev.availableVersions?.length === next.availableVersions?.length
  );
});

VersionDiff.displayName = "VersionDiff";

export default VersionDiff;
