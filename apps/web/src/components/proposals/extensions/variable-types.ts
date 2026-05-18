/**
 * Variable Types and Constants for TipTap Variable Extension
 * Phase 57-03: Rich Text Inline Editing with TipTap
 *
 * Extracted to break circular dependency between VariableChip.tsx and VariableExtension.ts
 */

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
export const DEFAULT_VARIABLE_ATTRS: VariableNodeAttrs = {
  key: "",
  category: "custom",
  label: "",
};
