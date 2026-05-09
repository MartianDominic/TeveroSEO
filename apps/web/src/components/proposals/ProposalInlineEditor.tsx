"use client";

/**
 * Proposal Inline Editor
 * Phase 57-03: Rich Text Inline Editing with TipTap
 *
 * WYSIWYG rich text editor using TipTap with support for:
 * - Basic formatting (bold, italic, headings, lists)
 * - Typography improvements (smart quotes, em dashes)
 * - Links and highlights
 * - Variable chips (via VariableExtension)
 * - Placeholder text (localized)
 * - Drop target for variables from palette
 */

import { useCallback, useEffect, useMemo } from "react";

import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useTranslations } from "next-intl";

import { logger } from '@/lib/logger';
import { sanitizeHtml } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

import { VariableExtension } from "./extensions/VariableExtension";

import type { VariableItem } from "./VariablePalette";

/**
 * Props for ProposalInlineEditor.
 */
export interface ProposalInlineEditorProps {
  /** Initial HTML content */
  content: string;
  /** Called when content changes */
  onUpdate: (html: string) => void;
  /** Current locale for placeholder */
  locale?: "en" | "lt";
  /** Whether editor is editable */
  editable?: boolean;
  /** Custom placeholder text (overrides locale default) */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Editor focus callback */
  onFocus?: () => void;
  /** Editor blur callback */
  onBlur?: () => void;
  /** Section ID for tracking */
  sectionId?: string;
  /** Minimum height */
  minHeight?: string;
}

/**
 * Localized placeholder messages.
 */
const PLACEHOLDERS: Record<"en" | "lt", string> = {
  en: "Start typing or drag a variable...",
  lt: "Pradekite rasyti arba vilkite kintamaji...",
};

/**
 * Character count result.
 */
export interface CharacterCount {
  /** Total characters including formatting */
  total: number;
  /** Characters excluding variable markup {{...}} */
  excluding: number;
  /** Word count */
  words: number;
}

/**
 * Calculate character count from plain text (extracted via editor.getText()).
 * This avoids innerHTML and uses only editor's built-in text extraction.
 */
export function calculateCharacterCountFromText(text: string): CharacterCount {
  // Count total characters
  const total = text.length;

  // Remove variable placeholders {{...}} for excluding count
  const textWithoutVariables = text.replace(/\{\{[^}]+\}\}/g, "");
  const excluding = textWithoutVariables.length;

  // Word count
  const words = textWithoutVariables.trim().split(/\s+/).filter(Boolean).length;

  return { total, excluding, words };
}

/**
 * Get character count from editor instance.
 * Uses editor.getText() which is safe (no DOM parsing).
 */
export function getEditorCharacterCount(editor: Editor | null): CharacterCount {
  if (!editor) {
    return { total: 0, excluding: 0, words: 0 };
  }
  // Use editor's getText() method which safely extracts text content
  const text = editor.getText();
  return calculateCharacterCountFromText(text);
}

/**
 * ProposalInlineEditor component.
 *
 * A WYSIWYG rich text editor built on TipTap with variable chip support.
 */
export function ProposalInlineEditor({
  content,
  onUpdate,
  locale = "en",
  editable = true,
  placeholder,
  className,
  onFocus,
  onBlur,
  sectionId,
  minHeight = "100px",
}: ProposalInlineEditorProps) {
  const t = useTranslations("proposalEditor");

  // Resolved placeholder text
  const placeholderText = placeholder || PLACEHOLDERS[locale];

  // Configure TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep undo/redo enabled with default settings
        // undoRedo: false would disable it entirely
      }),
      Placeholder.configure({
        placeholder: placeholderText,
        emptyEditorClass: "is-editor-empty",
      }),
      Typography.configure({
        // Enable smart typography
        // "quotes" -> "quotes" (smart quotes)
        // -- -> em dash
        // ... -> ellipsis
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline hover:no-underline cursor-pointer",
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
    content,
    editable,
    onUpdate: ({ editor }) => {
      // SECURITY: Sanitize HTML before saving to prevent XSS
      // TipTap does NOT auto-sanitize - malicious scripts via paste/img onerror can persist
      const rawHtml = editor.getHTML();
      const sanitizedHtml = sanitizeHtml(rawHtml);
      onUpdate(sanitizedHtml);
    },
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "focus:outline-none",
          "px-4 py-3",
          "[&_.is-editor-empty]:before:content-[attr(data-placeholder)]",
          "[&_.is-editor-empty]:before:text-muted-foreground",
          "[&_.is-editor-empty]:before:pointer-events-none",
          "[&_.is-editor-empty]:before:float-left",
          "[&_.is-editor-empty]:before:h-0"
        ),
        "data-section-id": sectionId || "",
      },
      // Handle drop events for variables
      handleDrop: (view, event, slice, moved) => {
        // Check if this is a variable drop
        const variableData = event.dataTransfer?.getData("application/x-variable");

        if (variableData) {
          event.preventDefault();

          try {
            const variable: VariableItem = JSON.parse(variableData);

            // Get drop position
            const pos = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (pos) {
              // Insert variable node at drop position
              const { tr } = view.state;
              const node = view.state.schema.nodes.variable.create({
                key: variable.key,
                category: variable.category,
                label: variable.label,
              });

              tr.insert(pos.pos, node);
              view.dispatch(tr);
            }

            return true;
          } catch (err) {
            // Log error for debugging - this is development-time logging only
            if (process.env.NODE_ENV === "development") {
              logger.error("[ProposalInlineEditor] Failed to parse variable data", err instanceof Error ? err : { error: String(err) });
            }
          }
        }

        // Fall through to default handling
        return false;
      },
      // Allow drag over
      handleDOMEvents: {
        dragover: (view, event) => {
          const variableData = event.dataTransfer?.types.includes("application/x-variable");
          if (variableData) {
            event.preventDefault();
            event.dataTransfer!.dropEffect = "copy";
            return true;
          }
          return false;
        },
      },
    },
  });

  // Update editable state when prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // HIGH-03 FIX: Removed manual editor.destroy() call
  // The useEditor hook from @tiptap/react handles cleanup automatically on unmount.
  // Calling destroy() manually causes double cleanup which can lead to errors.

  // Memoized character count
  const characterCount = useMemo(() => {
    return getEditorCharacterCount(editor);
  }, [editor?.state.doc]);

  return (
    <div
      className={cn(
        "relative rounded-md border border-input bg-background",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        "transition-colors",
        !editable && "opacity-60 cursor-not-allowed",
        className
      )}
      style={{ minHeight }}
    >
      <EditorContent
        editor={editor}
        className="min-h-[inherit]"
      />

      {/* Character count indicator */}
      <div className="absolute bottom-1 right-2 text-xs text-muted-foreground pointer-events-none">
        {characterCount.excluding > 0 && (
          <span>
            {characterCount.excluding} {t("toolbar.characters", { fallback: "chars" })}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to access editor instance.
 */
export function useProposalEditor(props: ProposalInlineEditorProps) {
  const placeholderText = props.placeholder || PLACEHOLDERS[props.locale || "en"];

  return useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholderText }),
      Typography,
      Link.configure({ openOnClick: false }),
      Highlight,
      VariableExtension,
    ],
    content: props.content,
    editable: props.editable ?? true,
    onUpdate: ({ editor }) => {
      // SECURITY: Sanitize HTML before saving to prevent XSS
      const rawHtml = editor.getHTML();
      const sanitizedHtml = sanitizeHtml(rawHtml);
      props.onUpdate(sanitizedHtml);
    },
  });
}

export default ProposalInlineEditor;
