"use client";

/**
 * SectionSelectionList - List of section checkboxes for AI generation.
 *
 * Extracted from AIGenerationModal for better component organization.
 */

import { type FC } from "react";

import { cn } from "@/lib/utils";

import { Checkbox } from "@tevero/ui";

import {
  type GeneratableSectionType,
  SECTION_CONFIGS,
  getLocalizedLabel,
  getLocalizedDescription,
} from "./ai-generation-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionSelectionListProps {
  selectedSections: GeneratableSectionType[];
  existingSections: GeneratableSectionType[];
  onToggle: (type: GeneratableSectionType) => void;
  locale: "en" | "lt";
  existsLabel: string;
}

// ---------------------------------------------------------------------------
// SectionSelectionList
// ---------------------------------------------------------------------------

export const SectionSelectionList: FC<SectionSelectionListProps> = ({
  selectedSections,
  existingSections,
  onToggle,
  locale,
  existsLabel,
}) => {
  return (
    <div className="space-y-2">
      {SECTION_CONFIGS.map((section) => {
        const Icon = section.icon;
        const isSelected = selectedSections.includes(section.type);
        const exists = existingSections.includes(section.type);

        return (
          <button
            key={section.type}
            type="button"
            onClick={() => onToggle(section.type)}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg border p-3 text-left",
              "transition-colors hover:border-primary hover:bg-accent",
              isSelected && "border-primary bg-accent"
            )}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggle(section.type)}
            />
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">
                {getLocalizedLabel(section, locale)}
              </span>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {getLocalizedDescription(section, locale)}
              </p>
            </div>
            {exists && (
              <span className="text-xs text-amber-600 shrink-0">
                {existsLabel}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
