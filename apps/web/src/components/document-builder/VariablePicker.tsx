"use client";

/**
 * VariablePicker - UI component for selecting and inserting variables.
 * Phase 102-10: Task 5 - Variable Picker UI
 *
 * Features:
 * - Grouped variables by category (prospect, seo_data, pricing, dates)
 * - Search functionality with instant filtering
 * - Click-to-insert behavior
 * - Keyboard navigation support
 * - 44px min-height per WCAG touch target
 */

import { useState, useMemo, useCallback, type FC, type KeyboardEvent } from "react";

import {
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Search,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AVAILABLE_VARIABLES,
  type VariableCategory,
  type VariableDefinition,
} from "@/lib/document-processing/variable-interpolator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VariablePickerProps {
  /** Callback when a variable is selected */
  onSelect: (variable: string) => void;
  /** Callback to close the picker */
  onClose?: () => void;
  /** Additional class names */
  className?: string;
  /** Whether the picker is open */
  open?: boolean;
  /** Filter to specific categories */
  categories?: string[];
}

// ---------------------------------------------------------------------------
// Icon Mapping
// ---------------------------------------------------------------------------

const categoryIcons: Record<string, LucideIcon> = {
  Building2,
  BarChart3,
  CreditCard,
  Calendar,
  Settings,
};

function getCategoryIcon(iconName: string): LucideIcon {
  return categoryIcons[iconName] ?? Settings;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Variable picker component with search and category grouping.
 */
export const VariablePicker: FC<VariablePickerProps> = ({
  onSelect,
  onClose,
  className,
  open = true,
  categories: allowedCategories,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter categories based on allowedCategories prop
  const filteredCategories = useMemo(() => {
    if (!allowedCategories || allowedCategories.length === 0) {
      return AVAILABLE_VARIABLES;
    }
    return AVAILABLE_VARIABLES.filter((cat) =>
      allowedCategories.includes(cat.category)
    );
  }, [allowedCategories]);

  // Filter variables based on search query
  const searchResults = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return filteredCategories;
    }

    return filteredCategories
      .map((category) => ({
        ...category,
        variables: category.variables.filter(
          (v) =>
            v.path.toLowerCase().includes(query) ||
            v.label.toLowerCase().includes(query) ||
            v.description.toLowerCase().includes(query)
        ),
      }))
      .filter((category) => category.variables.length > 0);
  }, [searchQuery, filteredCategories]);

  // Flatten variables for keyboard navigation
  const flattenedVariables = useMemo(() => {
    return searchResults.flatMap((cat) => cat.variables);
  }, [searchResults]);

  // Handle variable selection
  const handleSelect = useCallback(
    (variable: VariableDefinition) => {
      const variableSyntax = `{{${variable.path}}}`;
      onSelect(variableSyntax);
      setSearchQuery("");
      setSelectedIndex(0);
    },
    [onSelect]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, flattenedVariables.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flattenedVariables[selectedIndex]) {
            handleSelect(flattenedVariables[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose?.();
          break;
      }
    },
    [flattenedVariables, selectedIndex, handleSelect, onClose]
  );

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-80 rounded-lg border bg-surface-1 shadow-card",
        "flex flex-col max-h-96",
        className
      )}
    >
      {/* Header with search */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-4 w-4 text-text-3" />
        <Input
          type="text"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="h-8 flex-1 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
          autoFocus
        />
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Variables list */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length === 0 ? (
          <div className="p-4 text-center text-sm text-text-3">
            No variables found for "{searchQuery}"
          </div>
        ) : (
          searchResults.map((category) => (
            <VariableCategorySection
              key={category.category}
              category={category}
              selectedPath={flattenedVariables[selectedIndex]?.path}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>

      {/* Footer with hint */}
      <div className="border-t px-3 py-2 text-xs text-text-3">
        <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">
          Enter
        </kbd>{" "}
        to insert{" "}
        <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px]">
          Esc
        </kbd>{" "}
        to close
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Category Section
// ---------------------------------------------------------------------------

interface VariableCategorySectionProps {
  category: VariableCategory;
  selectedPath?: string;
  onSelect: (variable: VariableDefinition) => void;
}

const VariableCategorySection: FC<VariableCategorySectionProps> = ({
  category,
  selectedPath,
  onSelect,
}) => {
  const Icon = getCategoryIcon(category.icon);

  return (
    <div className="py-1">
      {/* Category header */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-text-2">
        <Icon className="h-3.5 w-3.5" />
        {category.label}
      </div>

      {/* Variables */}
      {category.variables.map((variable) => (
        <button
          key={variable.path}
          onClick={() => onSelect(variable)}
          className={cn(
            "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
            "min-h-[44px]", // WCAG touch target
            "hover:bg-surface-2",
            selectedPath === variable.path && "bg-accent-soft"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-accent">
                {`{{${variable.path}}}`}
              </code>
            </div>
            <div className="text-sm text-text-2 truncate">{variable.label}</div>
            {variable.description && (
              <div className="text-xs text-text-3 truncate">
                {variable.description}
              </div>
            )}
          </div>
          {variable.example && (
            <div className="text-xs text-text-3 italic shrink-0">
              e.g. {variable.example}
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

export default VariablePicker;
