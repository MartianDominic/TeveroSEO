/**
 * Variable Extension for TipTap
 * Phase 57-03: Rich Text Inline Editing with TipTap
 *
 * Custom TipTap Node extension that renders {{variable.key}} placeholders
 * as inline atom nodes. These nodes:
 * - Cannot be split or partially selected (atomic)
 * - Display as colored chips based on category
 * - Show resolved value on hover
 * - Have red dashed border when unresolved
 *
 * Based on TipTap custom inline nodes documentation:
 * https://tiptap.dev/docs/editor/guide/custom-extensions
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { VariableChip } from "../VariableChip";

/**
 * Variable categories with their colors.
 * Must match the palette colors defined in VariablePalette.tsx
 */
export const VARIABLE_CATEGORY_COLORS: Record<string, string> = {
  client: "#3B82F6", // blue-500
  provider: "#22C55E", // green-500
  pricing: "#F97316", // orange-500
  audit: "#A855F7", // purple-500
  dates: "#6B7280", // gray-500
  custom: "#14B8A6", // teal-500
};

/**
 * Variable node attributes stored in the document.
 */
export interface VariableNodeAttrs {
  /** Variable key (e.g., 'client.companyName', 'pricing.monthly') */
  key: string;
  /** Variable category (client, provider, pricing, audit, dates, custom) */
  category: string;
  /** Display label (human-readable name) */
  label: string;
}

/**
 * Default node attributes.
 */
const defaultAttrs: VariableNodeAttrs = {
  key: "",
  category: "custom",
  label: "",
};

/**
 * VariableExtension - TipTap Node for inline variable chips.
 *
 * Usage:
 * ```typescript
 * import { VariableExtension } from './extensions/VariableExtension';
 *
 * const editor = useEditor({
 *   extensions: [StarterKit, VariableExtension],
 *   content: '<p>Hello {{client.name}}</p>',
 * });
 * ```
 */
export const VariableExtension = Node.create({
  name: "variable",

  // Node group: inline (appears inside paragraphs)
  group: "inline",

  // Inline node behavior
  inline: true,

  // Atomic: cannot be split, selected partially, or edited directly
  atom: true,

  // Define node attributes
  addAttributes() {
    return {
      key: {
        default: defaultAttrs.key,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-variable-key"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-variable-key": attributes.key,
        }),
      },
      category: {
        default: defaultAttrs.category,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-category"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-category": attributes.category,
        }),
      },
      label: {
        default: defaultAttrs.label,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-label"),
        renderHTML: (attributes: Record<string, string>) => ({
          "data-label": attributes.label,
        }),
      },
    };
  },

  // Parse HTML: recognize variable spans
  parseHTML() {
    return [
      {
        // Match spans with data-variable attribute
        tag: "span[data-variable]",
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === "string") return false;
          const el = element as HTMLElement;
          return {
            key: el.getAttribute("data-variable") || el.getAttribute("data-variable-key"),
            category: el.getAttribute("data-category") || "custom",
            label: el.getAttribute("data-label") || "",
          };
        },
      },
      {
        // Match variable-chip class (from VariableChip component)
        tag: "span.variable-chip",
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === "string") return false;
          const el = element as HTMLElement;
          return {
            key: el.getAttribute("data-variable-key"),
            category: el.getAttribute("data-category") || "custom",
            label: el.getAttribute("data-label") || "",
          };
        },
      },
    ];
  },

  // Render HTML: output span with attributes
  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as VariableNodeAttrs;
    const color = VARIABLE_CATEGORY_COLORS[attrs.category] || VARIABLE_CATEGORY_COLORS.custom;

    return [
      "span",
      mergeAttributes(
        {
          "data-variable": attrs.key,
          "data-variable-key": attrs.key,
          "data-category": attrs.category,
          "data-label": attrs.label,
          class: `variable-chip variable-${attrs.category}`,
          style: `border-left: 3px solid ${color};`,
        },
        HTMLAttributes
      ),
      // Text content shows the variable syntax
      `{{${attrs.key}}}`,
    ];
  },

  // Use React component for rendering (with hover preview, etc.)
  addNodeView() {
    return ReactNodeViewRenderer(VariableChip);
  },

  // Keyboard shortcuts
  addKeyboardShortcuts() {
    return {
      // Backspace at start of variable deletes it entirely
      Backspace: () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        const nodeBefore = $from.nodeBefore;

        if (nodeBefore?.type.name === "variable") {
          return this.editor.commands.deleteSelection();
        }

        return false;
      },
      // Delete at end of variable deletes it entirely
      Delete: () => {
        const { selection } = this.editor.state;
        const { $from } = selection;
        const nodeAfter = $from.nodeAfter;

        if (nodeAfter?.type.name === "variable") {
          return this.editor.commands.deleteSelection();
        }

        return false;
      },
    };
  },

  // Commands for inserting variables
  addCommands() {
    return {
      insertVariable:
        (attrs: VariableNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

/**
 * Helper: Insert a variable into the editor at current cursor position.
 */
export function insertVariableAtCursor(
  editor: ReturnType<typeof import("@tiptap/react").useEditor>,
  variable: { key: string; category: string; label: string }
): boolean {
  if (!editor) return false;

  return editor
    .chain()
    .focus()
    .insertContent({
      type: "variable",
      attrs: {
        key: variable.key,
        category: variable.category,
        label: variable.label,
      },
    })
    .run();
}

/**
 * Type augmentation for TipTap commands.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    variable: {
      /**
       * Insert a variable node at the current cursor position.
       */
      insertVariable: (attrs: VariableNodeAttrs) => ReturnType;
    };
  }
}

export default VariableExtension;
