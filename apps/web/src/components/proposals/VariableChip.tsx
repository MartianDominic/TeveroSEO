"use client";

/**
 * Variable Chip Component for TipTap
 * Phase 57-03: Rich Text Inline Editing with TipTap
 *
 * React NodeView component that renders variable nodes as colored chips:
 * - Category-based background colors
 * - Tooltip showing resolved value or "unresolved" message
 * - Red dashed border when variable cannot be resolved
 * - Non-editable (atomic node)
 */

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVariableValue } from "@/hooks/useVariableValue";
import { cn } from "@/lib/utils";

import { VARIABLE_CATEGORY_COLORS, type VariableNodeAttrs } from "./extensions/VariableExtension";

/**
 * Category colors for chip backgrounds.
 * Lighter variants of the category colors.
 */
const CATEGORY_BG_COLORS: Record<string, string> = {
  client: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  provider: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pricing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  audit: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  dates: "bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300",
  custom: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
};

/**
 * VariableChip - React component rendered by TipTap for variable nodes.
 *
 * This component is used by ReactNodeViewRenderer in VariableExtension.
 */
export function VariableChip({ node, selected }: NodeViewProps) {
  const attrs = node.attrs as VariableNodeAttrs;
  const { key, category, label } = attrs;

  // Resolve the variable value using context
  const { value: resolvedValue, isResolved, isLoading } = useVariableValue(key);

  // Get category-specific styling
  const categoryColor = VARIABLE_CATEGORY_COLORS[category] || VARIABLE_CATEGORY_COLORS.custom;
  const categoryBgClass = CATEGORY_BG_COLORS[category] || CATEGORY_BG_COLORS.custom;

  // Display label: use label if provided, otherwise use key
  const displayLabel = label || key;

  // Tooltip content
  const tooltipContent = isLoading
    ? "Loading..."
    : isResolved
    ? resolvedValue
    : "Value not available";

  return (
    <NodeViewWrapper
      as="span"
      className="inline select-none"
      data-drag-handle
      contentEditable={false}
    >
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span
              className={cn(
                // Base styles
                "inline-flex items-center px-2 py-0.5 rounded text-sm font-medium",
                "border cursor-default transition-colors",
                // Category colors
                categoryBgClass,
                // Selected state
                selected && "ring-2 ring-ring ring-offset-1",
                // Unresolved state: red dashed border
                !isResolved && !isLoading && "border-dashed border-red-500 dark:border-red-400"
              )}
              style={{
                borderLeftWidth: "3px",
                borderLeftStyle: "solid",
                borderLeftColor: categoryColor,
              }}
              data-variable-key={key}
              data-category={category}
              data-label={label}
              data-resolved={isResolved}
            >
              {/* Variable label */}
              <span className="truncate max-w-[150px]">{displayLabel}</span>
            </span>
          </TooltipTrigger>

          <TooltipContent
            side="top"
            align="center"
            className="max-w-xs"
          >
            <div className="space-y-1">
              {/* Variable key syntax */}
              <p className="font-mono text-xs-safe text-muted-foreground">
                {`{{${key}}}`}
              </p>

              {/* Resolved value or status */}
              <p
                className={cn(
                  "text-sm",
                  !isResolved && !isLoading && "text-destructive"
                )}
              >
                {tooltipContent}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </NodeViewWrapper>
  );
}

/**
 * Standalone VariableChipDisplay - for use outside TipTap (e.g., previews).
 */
export interface VariableChipDisplayProps {
  /** Variable key */
  variableKey: string;
  /** Variable category */
  category: string;
  /** Display label */
  label?: string;
  /** Pre-resolved value (optional, will use hook if not provided) */
  resolvedValue?: string | null;
  /** Whether the value is resolved (optional, will use hook if not provided) */
  isResolved?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

export function VariableChipDisplay({
  variableKey,
  category,
  label,
  resolvedValue: providedValue,
  isResolved: providedIsResolved,
  className,
  onClick,
}: VariableChipDisplayProps) {
  // Use hook if resolved value not provided
  const hookResult = useVariableValue(
    providedValue === undefined ? variableKey : ""
  );

  const resolvedValue = providedValue ?? hookResult.value;
  const isResolved = providedIsResolved ?? hookResult.isResolved;
  const isLoading = providedValue === undefined && hookResult.isLoading;

  // Get category-specific styling
  const categoryColor = VARIABLE_CATEGORY_COLORS[category] || VARIABLE_CATEGORY_COLORS.custom;
  const categoryBgClass = CATEGORY_BG_COLORS[category] || CATEGORY_BG_COLORS.custom;

  // Display label
  const displayLabel = label || variableKey;

  // Tooltip content
  const tooltipContent = isLoading
    ? "Loading..."
    : isResolved
    ? resolvedValue
    : "Value not available";

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-sm font-medium",
              "border cursor-default transition-colors",
              categoryBgClass,
              !isResolved && !isLoading && "border-dashed border-red-500 dark:border-red-400",
              onClick && "cursor-pointer hover:opacity-80",
              className
            )}
            style={{
              borderLeftWidth: "3px",
              borderLeftStyle: "solid",
              borderLeftColor: categoryColor,
            }}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
          >
            <span className="truncate max-w-[150px]">{displayLabel}</span>
          </span>
        </TooltipTrigger>

        <TooltipContent side="top" align="center" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-mono text-xs-safe text-muted-foreground">
              {`{{${variableKey}}}`}
            </p>
            <p
              className={cn(
                "text-sm",
                !isResolved && !isLoading && "text-destructive"
              )}
            >
              {tooltipContent}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default VariableChip;
