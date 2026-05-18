"use client";

/**
 * LazyProposalInlineEditor - Dynamic import wrapper for TipTap ProposalInlineEditor.
 * Phase 102: Bundle Size Optimization
 *
 * Purpose:
 * - TipTap is ~200KB+ gzipped (StarterKit + extensions)
 * - Lazy loading moves this to a separate async chunk
 * - Initial page load is faster, editor loads on demand
 *
 * Usage:
 * Replace direct ProposalInlineEditor imports with LazyProposalInlineEditor:
 *   import { LazyProposalInlineEditor } from './LazyProposalInlineEditor';
 */

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

import type { ProposalInlineEditorProps } from "./ProposalInlineEditor";

/**
 * Editor loading skeleton.
 * Provides visual placeholder while TipTap bundle loads.
 */
function EditorSkeleton({
  className,
  minHeight = "100px",
}: {
  className?: string;
  minHeight?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-md border border-input bg-background",
        className
      )}
      style={{ minHeight }}
      aria-busy="true"
      aria-label="Loading editor..."
    >
      {/* Content skeleton */}
      <div className="px-4 py-3 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
        <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
      </div>

      {/* Character count placeholder */}
      <div className="absolute bottom-1 right-2">
        <div className="h-3 w-12 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Dynamically imported ProposalInlineEditor.
 *
 * - ssr: false because TipTap uses browser-only APIs (DOM, window)
 * - Separate chunk: ~200KB+ moved out of main bundle
 */
const ProposalInlineEditor = dynamic(
  () => import("./ProposalInlineEditor").then((mod) => mod.ProposalInlineEditor),
  {
    loading: () => <EditorSkeleton />,
    ssr: false,
  }
);

/**
 * LazyProposalInlineEditor component.
 *
 * Drop-in replacement for ProposalInlineEditor with lazy loading.
 * Accepts all ProposalInlineEditor props and passes them through.
 */
export function LazyProposalInlineEditor(props: ProposalInlineEditorProps) {
  return <ProposalInlineEditor {...props} />;
}

/**
 * Re-export skeleton for use in parent Suspense boundaries.
 */
export { EditorSkeleton as ProposalEditorSkeleton };

export default LazyProposalInlineEditor;
