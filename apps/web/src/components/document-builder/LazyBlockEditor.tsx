"use client";

/**
 * LazyBlockEditor - Dynamic import wrapper for TipTap BlockEditor.
 * Phase 102: Bundle Size Optimization
 *
 * Purpose:
 * - TipTap is ~200KB+ gzipped (StarterKit + extensions)
 * - Lazy loading moves this to a separate async chunk
 * - Initial page load is faster, editor loads on demand
 *
 * Usage:
 * Replace direct BlockEditor imports with LazyBlockEditor:
 *   import { LazyBlockEditor } from './LazyBlockEditor';
 */

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

import type { BlockEditorProps } from "./BlockEditor";

/**
 * Editor loading skeleton.
 * Provides visual placeholder while TipTap bundle loads.
 */
function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative rounded-lg",
        "bg-surface",
        "border border-hairline",
        className
      )}
      aria-busy="true"
      aria-label="Loading editor..."
    >
      {/* Content skeleton */}
      <div className="min-h-[80px] px-3 py-2 space-y-2">
        <div className="h-4 bg-surface-2 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-surface-2 rounded animate-pulse w-full" />
        <div className="h-4 bg-surface-2 rounded animate-pulse w-2/3" />
      </div>

      {/* Toolbar skeleton */}
      <div
        className={cn(
          "flex items-center justify-end",
          "px-3 py-2",
          "border-t border-hairline",
          "bg-surface-2/50"
        )}
      >
        <div className="h-8 w-32 bg-surface-2 rounded-md animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Dynamically imported BlockEditor.
 *
 * - ssr: false because TipTap uses browser-only APIs (DOM, window)
 * - Separate chunk: ~200KB+ moved out of main bundle
 */
const BlockEditor = dynamic(
  () => import("./BlockEditor").then((mod) => mod.BlockEditor),
  {
    loading: () => <EditorSkeleton />,
    ssr: false,
  }
);

/**
 * LazyBlockEditor component.
 *
 * Drop-in replacement for BlockEditor with lazy loading.
 * Accepts all BlockEditor props and passes them through.
 */
export function LazyBlockEditor(props: BlockEditorProps) {
  return <BlockEditor {...props} />;
}

/**
 * Re-export skeleton for use in parent Suspense boundaries.
 */
export { EditorSkeleton as BlockEditorSkeleton };

export default LazyBlockEditor;
