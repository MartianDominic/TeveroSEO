"use client";

/**
 * AddSectionMenu - Grid popup showing 8 section types.
 * Phase 57-05: Custom Sections + Add Section Menu
 *
 * Features:
 * - 4x2 grid layout
 * - Icon + label for each type
 * - Hover preview/description
 * - Click creates section
 * - Localized labels (EN/LT)
 */

import { type FC, useState } from "react";
import {
  FileText,
  Image,
  MessageSquareQuote,
  BarChart3,
  Video,
  Scale,
  Clock,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Custom section types for proposals.
 */
export const CUSTOM_SECTION_TYPES = [
  "text",
  "image",
  "testimonial",
  "case_study",
  "video",
  "comparison",
  "timeline",
  "custom",
] as const;

export type CustomSectionType = (typeof CUSTOM_SECTION_TYPES)[number];

/**
 * Section type configuration with icon, labels, and description.
 */
export interface SectionTypeConfig {
  type: CustomSectionType;
  icon: typeof FileText;
  labelEn: string;
  labelLt: string;
  descriptionEn: string;
  descriptionLt: string;
}

/**
 * Section type configurations.
 */
export const SECTION_TYPE_CONFIGS: SectionTypeConfig[] = [
  {
    type: "text",
    icon: FileText,
    labelEn: "Text",
    labelLt: "Tekstas",
    descriptionEn: "Rich text block with formatting",
    descriptionLt: "Tekstinis blokas su formatavimo",
  },
  {
    type: "image",
    icon: Image,
    labelEn: "Image",
    labelLt: "Nuotrauka",
    descriptionEn: "Image with caption and alt text",
    descriptionLt: "Nuotrauka su aprasymu",
  },
  {
    type: "testimonial",
    icon: MessageSquareQuote,
    labelEn: "Testimonial",
    labelLt: "Atsiliepimas",
    descriptionEn: "Quote with author attribution",
    descriptionLt: "Citata su autoriumi",
  },
  {
    type: "case_study",
    icon: BarChart3,
    labelEn: "Case Study",
    labelLt: "Atvejo studija",
    descriptionEn: "Mini case study with metrics",
    descriptionLt: "Mini atvejo studija su metrikomis",
  },
  {
    type: "video",
    icon: Video,
    labelEn: "Video",
    labelLt: "Video",
    descriptionEn: "Embedded video (YouTube, Vimeo, Loom)",
    descriptionLt: "Ikeltas video (YouTube, Vimeo, Loom)",
  },
  {
    type: "comparison",
    icon: Scale,
    labelEn: "Comparison",
    labelLt: "Palyginimas",
    descriptionEn: "Before/after comparison table",
    descriptionLt: "Pries/po palyginimo lentele",
  },
  {
    type: "timeline",
    icon: Clock,
    labelEn: "Timeline",
    labelLt: "Laiko juosta",
    descriptionEn: "Project phases with durations",
    descriptionLt: "Projekto etapai su trukme",
  },
  {
    type: "custom",
    icon: Plus,
    labelEn: "Custom",
    labelLt: "Pasirinktinis",
    descriptionEn: "Generic content block",
    descriptionLt: "Bendras turinio blokas",
  },
];

export interface AddSectionMenuProps {
  /** Callback when section type is selected */
  onSelect: (type: CustomSectionType) => void;
  /** Current locale */
  locale?: "en" | "lt";
  /** Whether the menu is disabled */
  disabled?: boolean;
  /** Custom trigger button */
  trigger?: React.ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * AddSectionMenu component.
 *
 * Displays a 4x2 grid of section types to add to a proposal.
 */
export const AddSectionMenu: FC<AddSectionMenuProps> = ({
  onSelect,
  locale = "en",
  disabled = false,
  trigger,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<CustomSectionType | null>(
    null
  );

  const handleSelect = (type: CustomSectionType) => {
    onSelect(type);
    setOpen(false);
  };

  const getLabel = (config: SectionTypeConfig) =>
    locale === "lt" ? config.labelLt : config.labelEn;

  const getDescription = (config: SectionTypeConfig) =>
    locale === "lt" ? config.descriptionLt : config.descriptionEn;

  const hoveredConfig = hoveredType
    ? SECTION_TYPE_CONFIGS.find((c) => c.type === hoveredType)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn("gap-2", className)}
          >
            <Plus className="h-4 w-4" />
            {locale === "lt" ? "Prideti sekcija" : "Add Section"}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-4"
        align="start"
        side="bottom"
        sideOffset={8}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="text-sm font-medium text-foreground">
            {locale === "lt" ? "Pasirinkite sekcijos tipa" : "Select section type"}
          </div>

          {/* 4x2 Grid */}
          <div className="grid grid-cols-4 gap-2">
            {SECTION_TYPE_CONFIGS.map((config) => {
              const Icon = config.icon;
              const isHovered = hoveredType === config.type;

              return (
                <button
                  key={config.type}
                  type="button"
                  onClick={() => handleSelect(config.type)}
                  onMouseEnter={() => setHoveredType(config.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 p-3",
                    "rounded-lg border border-border bg-background",
                    "transition-all duration-150",
                    "hover:border-primary hover:bg-accent",
                    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isHovered && "border-primary bg-accent"
                  )}
                  aria-label={getLabel(config)}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    {getLabel(config)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hover description */}
          <div
            className={cn(
              "min-h-[2rem] text-xs text-muted-foreground",
              "transition-opacity duration-150",
              hoveredConfig ? "opacity-100" : "opacity-0"
            )}
          >
            {hoveredConfig && getDescription(hoveredConfig)}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddSectionMenu;
