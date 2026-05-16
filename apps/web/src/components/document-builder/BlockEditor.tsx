"use client";

/**
 * BlockEditor - TipTap editor for persuasion blocks.
 * Phase 102-03: AI content generation
 *
 * Features:
 * - TipTap rich text editor with StarterKit
 * - "Generate with AI" button with sparkle icon
 * - Loading state: skeleton shimmer during generation
 * - Variable insertion support via VariableExtension
 * - Content synced to store on change
 */

import { useState, useCallback, type FC } from "react";

import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@tevero/ui";
import { sanitizeHtml } from "@/lib/sanitize";
import { useDocumentBuilderStore } from "@/stores/documentBuilderStore";
import { getBlockMetadata } from "@/lib/document-builder/persuasion-blocks";
import type { PersuasionBlockType, TipTapContent } from "@/lib/document-builder/types";

import { VariableExtension } from "../proposals/extensions/VariableExtension";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockEditorProps {
  /** Block ID in the store */
  blockId: string;
  /** Block type for AI context */
  blockType: PersuasionBlockType;
  /** Initial content (TipTap JSON) */
  initialContent?: TipTapContent;
  /** Placeholder text */
  placeholder?: string;
  /** Whether editor is editable */
  editable?: boolean;
  /** Additional class names */
  className?: string;
  /** Prospect ID for AI generation context */
  prospectId?: string;
  /** Prospect domain for AI generation context */
  prospectDomain?: string;
  /** Framework ID for AI generation context */
  frameworkId?: string | null;
  /** Language for AI generation */
  language?: string;
  /** Callback when content changes */
  onContentChange?: (content: TipTapContent) => void;
  /** Callback when AI generates content */
  onGenerate?: (content: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PLACEHOLDER = "Start typing or click 'Generate with AI'...";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * BlockEditor component.
 *
 * A TipTap-based rich text editor for document builder blocks.
 * Includes AI generation button and loading states.
 */
export const BlockEditor: FC<BlockEditorProps> = ({
  blockId,
  blockType,
  initialContent,
  placeholder,
  editable = true,
  className,
  prospectId,
  prospectDomain,
  frameworkId,
  language = "lt",
  onContentChange,
  onGenerate,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { updateBlockContent, blocks } = useDocumentBuilderStore();

  // Get block metadata for placeholder
  const blockMetadata = getBlockMetadata(blockType);
  const placeholderText = placeholder ?? blockMetadata?.placeholder ?? DEFAULT_PLACEHOLDER;

  // Initialize TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Enable history (undo/redo)
      }),
      Placeholder.configure({
        placeholder: placeholderText,
        emptyEditorClass: "is-editor-empty",
      }),
      Typography.configure({
        // Smart typography: quotes, em dashes, ellipsis
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-accent underline hover:no-underline cursor-pointer",
        },
      }),
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class: "bg-yellow-200 dark:bg-yellow-800/50",
        },
      }),
      VariableExtension,
    ],
    content: initialContent ?? { type: "doc", content: [] },
    editable,
    onUpdate: ({ editor }) => {
      // Get TipTap JSON content
      const json = editor.getJSON() as TipTapContent;

      // Update store
      updateBlockContent(blockId, json);

      // Notify parent
      onContentChange?.(json);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "focus:outline-none",
          "min-h-[80px] px-3 py-2",
          "[&_.is-editor-empty]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty]:before:text-text-3",
          "[&_.is-editor-empty]:before:pointer-events-none",
          "[&_.is-editor-empty]:before:float-left",
          "[&_.is-editor-empty]:before:h-0"
        ),
        "data-block-id": blockId,
      },
    },
  });

  // Get preceding blocks content for context
  const getPrecedingBlocksContent = useCallback((): string[] => {
    const currentIndex = blocks.findIndex((b) => b.id === blockId);
    if (currentIndex <= 0) return [];

    return blocks
      .slice(0, currentIndex)
      .slice(-3) // Last 3 blocks max
      .map((b) => {
        // Extract text from TipTap content
        if (b.content?.content) {
          return b.content.content
            .map((node) => {
              if (node.content) {
                return node.content
                  .filter((n) => n.type === "text" && n.text)
                  .map((n) => n.text)
                  .join("");
              }
              return "";
            })
            .join(" ")
            .slice(0, 200); // Truncate for context
        }
        return "";
      })
      .filter(Boolean);
  }, [blocks, blockId]);

  // Handle AI generation
  const handleGenerate = useCallback(async () => {
    if (isGenerating || !editor) return;

    setIsGenerating(true);
    setError(null);

    try {
      const precedingBlocks = getPrecedingBlocksContent();

      const response = await fetch("/api/document-builder/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blockType,
          intent: "create",
          prospect: {
            id: prospectId ?? "default",
            domain: prospectDomain,
          },
          language,
          framework: frameworkId ?? undefined,
          precedingBlocks: precedingBlocks.length > 0 ? precedingBlocks : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message ?? `Generation failed (${response.status})`);
      }

      const data = await response.json();

      if (data.content) {
        // Set content in editor
        editor
          .chain()
          .focus()
          .clearContent()
          .insertContent(`<p>${sanitizeHtml(data.content)}</p>`)
          .run();

        // Notify parent
        onGenerate?.(data.content);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, [
    isGenerating,
    editor,
    blockType,
    prospectId,
    prospectDomain,
    language,
    frameworkId,
    getPrecedingBlocksContent,
    onGenerate,
  ]);

  return (
    <div
      className={cn(
        "relative rounded-lg",
        "bg-surface",
        "border border-hairline",
        "focus-within:border-accent/30 focus-within:ring-1 focus-within:ring-accent/20",
        "transition-all duration-[240ms]",
        className
      )}
    >
      {/* Editor content */}
      <div className={cn(isGenerating && "opacity-50")}>
        {isGenerating ? (
          // Skeleton shimmer during generation
          <div className="min-h-[80px] px-3 py-2 space-y-2">
            <div className="h-4 bg-surface-2 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-surface-2 rounded animate-pulse w-full" />
            <div className="h-4 bg-surface-2 rounded animate-pulse w-2/3" />
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center justify-between",
          "px-3 py-2",
          "border-t border-hairline",
          "bg-surface-2/50"
        )}
      >
        {/* Error message */}
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-error">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Spacer */}
        {!error && <div />}

        {/* Generate button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating || !editable}
          className={cn(
            "gap-1.5",
            "text-accent hover:text-accent-ink hover:bg-accent-soft",
            "transition-colors duration-[160ms]"
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Generate with AI</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default BlockEditor;
