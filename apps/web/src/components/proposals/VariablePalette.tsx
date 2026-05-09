"use client";

/**
 * Variable Palette Component
 * Phase 57-02: Variable System + Resolution Service
 *
 * Displays available variables grouped by category with search and drag support.
 * Variables can be dragged into the proposal editor to insert {{variable.key}}.
 */

import { useState, useCallback, useMemo } from "react";

import {
  Search,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Building2,
  Globe,
  User,
  Mail,
  Factory,
  Building,
  Phone,
  Receipt,
  MapPin,
  Wallet,
  Banknote,
  Calculator,
  List,
  Hash,
  Target,
  AlertTriangle,
  TrendingUp,
  Key,
  Lightbulb,
  Calendar,
  FileText,
  Clock,
  Play,
  Gift,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Category metadata for display.
 */
export interface VariableCategory {
  category: string;
  color: string;
  label: string;
}

/**
 * Variable item for display.
 */
export interface VariableItem {
  key: string;
  label: string;
  description?: string;
  category: string;
  icon?: string | null;
  isSystem: boolean;
  color?: string;
}

/**
 * Variables grouped by category.
 */
export interface VariableGroup {
  category: string;
  color: string;
  label: string;
  variables: VariableItem[];
}

/**
 * Props for VariablePalette component.
 */
interface VariablePaletteProps {
  /** Variables grouped by category */
  groups: VariableGroup[];
  /** Called when a variable is selected/clicked */
  onSelect?: (variable: VariableItem) => void;
  /** Called when drag starts - provides dataTransfer data */
  onDragStart?: (variable: VariableItem, event: React.DragEvent) => void;
  /** Current locale for labels */
  locale?: "en" | "lt";
  /** Default expanded categories */
  defaultExpandedCategories?: string[];
  /** Compact mode - smaller spacing */
  compact?: boolean;
  /** Height constraint for scroll area */
  maxHeight?: string;
}

/**
 * Icon map from string name to Lucide component.
 */
const ICON_MAP: Record<string, React.ElementType> = {
  Building2,
  Globe,
  User,
  Mail,
  Factory,
  Building,
  Phone,
  Receipt,
  MapPin,
  Wallet,
  Banknote,
  Calculator,
  List,
  Hash,
  Target,
  AlertTriangle,
  TrendingUp,
  Key,
  Lightbulb,
  Calendar,
  FileText,
  Clock,
  Play,
  Gift,
};

/**
 * Get icon component from name.
 */
function getIcon(iconName: string | null | undefined): React.ElementType | null {
  if (!iconName) return null;
  return ICON_MAP[iconName] ?? null;
}

/**
 * Category labels for fallback.
 */
const CATEGORY_LABELS: Record<string, { en: string; lt: string }> = {
  client: { en: "Client", lt: "Klientas" },
  provider: { en: "Provider", lt: "Teikėjas" },
  pricing: { en: "Pricing", lt: "Kainos" },
  audit: { en: "Audit Results", lt: "Audito rezultatai" },
  dates: { en: "Dates", lt: "Datos" },
  custom: { en: "Custom", lt: "Pasirinktiniai" },
};

/**
 * Variable chip - a single draggable variable item.
 */
function VariableChip({
  variable,
  onSelect,
  onDragStart,
  compact,
}: {
  variable: VariableItem;
  onSelect?: (variable: VariableItem) => void;
  onDragStart?: (variable: VariableItem, event: React.DragEvent) => void;
  compact?: boolean;
}) {
  const IconComponent = getIcon(variable.icon);

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      // Set the data transfer data
      event.dataTransfer.setData("text/plain", `{{${variable.key}}}`);
      event.dataTransfer.setData("application/x-variable", JSON.stringify(variable));
      event.dataTransfer.effectAllowed = "copy";

      // Call external handler if provided
      onDragStart?.(variable, event);
    },
    [variable, onDragStart]
  );

  const handleClick = useCallback(() => {
    onSelect?.(variable);
  }, [variable, onSelect]);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            draggable
            onDragStart={handleDragStart}
            onClick={handleClick}
            className={`
              group flex items-center gap-2 rounded-md border cursor-grab
              bg-background hover:bg-accent/50 transition-colors
              active:cursor-grabbing select-none
              ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}
            `}
            style={{
              borderColor: variable.color ?? "#6B7280",
              borderLeftWidth: "3px",
            }}
            role="button"
            tabIndex={0}
            aria-label={`Insert variable ${variable.label}`}
          >
            {/* Drag handle */}
            <GripVertical
              className={`text-muted-foreground/50 group-hover:text-muted-foreground transition-colors ${
                compact ? "h-3 w-3" : "h-4 w-4"
              }`}
            />

            {/* Icon */}
            {IconComponent && (
              <IconComponent
                className={compact ? "h-3 w-3" : "h-4 w-4"}
                style={{ color: variable.color }}
              />
            )}

            {/* Label */}
            <span className="truncate flex-1">{variable.label}</span>

            {/* System badge */}
            {variable.isSystem && (
              <Badge
                variant="outline"
                className={`opacity-60 ${compact ? "text-xs-safe px-1 py-0" : "text-xs"}`}
              >
                sys
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">
              {`{{${variable.key}}}`}
            </p>
            {variable.description && (
              <p className="text-sm">{variable.description}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Category section - collapsible group of variables.
 */
function CategorySection({
  group,
  isExpanded,
  onToggle,
  onSelect,
  onDragStart,
  searchQuery,
  compact,
  locale,
}: {
  group: VariableGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect?: (variable: VariableItem) => void;
  onDragStart?: (variable: VariableItem, event: React.DragEvent) => void;
  searchQuery: string;
  compact?: boolean;
  locale?: "en" | "lt";
}) {
  // Filter variables by search query
  const filteredVariables = useMemo(() => {
    if (!searchQuery) return group.variables;

    const query = searchQuery.toLowerCase();
    return group.variables.filter(
      (v) =>
        v.label.toLowerCase().includes(query) ||
        v.key.toLowerCase().includes(query) ||
        v.description?.toLowerCase().includes(query)
    );
  }, [group.variables, searchQuery]);

  // Don't show empty categories when searching
  if (searchQuery && filteredVariables.length === 0) {
    return null;
  }

  const categoryLabel =
    group.label ||
    (locale === "lt"
      ? CATEGORY_LABELS[group.category]?.lt
      : CATEGORY_LABELS[group.category]?.en) ||
    group.category;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={`w-full justify-between font-medium ${
            compact ? "h-8 px-2 text-xs" : "h-10 px-3"
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              className={`rounded-full ${compact ? "h-2 w-2" : "h-3 w-3"}`}
              style={{ backgroundColor: group.color }}
            />
            <span>{categoryLabel}</span>
            <Badge variant="secondary" className={compact ? "text-xs-safe" : "text-xs"}>
              {filteredVariables.length}
            </Badge>
          </span>
          {isExpanded ? (
            <ChevronDown className={compact ? "h-3 w-3" : "h-4 w-4"} />
          ) : (
            <ChevronRight className={compact ? "h-3 w-3" : "h-4 w-4"} />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`space-y-1 ${compact ? "pl-3 pr-1 pb-2" : "pl-4 pr-2 pb-3"}`}>
          {filteredVariables.map((variable) => (
            <VariableChip
              key={variable.key}
              variable={{ ...variable, color: group.color }}
              onSelect={onSelect}
              onDragStart={onDragStart}
              compact={compact}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Variable palette with search and category grouping.
 */
export function VariablePalette({
  groups,
  onSelect,
  onDragStart,
  locale = "en",
  defaultExpandedCategories,
  compact = false,
  maxHeight = "400px",
}: VariablePaletteProps) {
  const t = useTranslations("proposalEditor.variables");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(defaultExpandedCategories ?? groups.map((g) => g.category))
  );

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Expand all when searching
  const effectiveExpandedCategories = useMemo(() => {
    if (searchQuery) {
      return new Set(groups.map((g) => g.category));
    }
    return expandedCategories;
  }, [searchQuery, groups, expandedCategories]);

  // Total count for header
  const totalCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.variables.length, 0),
    [groups]
  );

  return (
    <div className="flex flex-col border rounded-lg bg-card">
      {/* Header */}
      <div className={`border-b ${compact ? "p-2" : "p-3"}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={`font-semibold ${compact ? "text-sm" : "text-base"}`}>
            {t("title", { fallback: "Variables" })}
          </h3>
          <Badge variant="outline" className={compact ? "text-xs-safe" : "text-xs"}>
            {totalCount}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground ${
              compact ? "h-3 w-3" : "h-4 w-4"
            }`}
          />
          <Input
            type="search"
            placeholder={t("search", { fallback: "Search variables..." })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${compact ? "h-8 pl-7 text-xs" : "h-9 pl-9"}`}
          />
        </div>
      </div>

      {/* Variables list */}
      <ScrollArea style={{ maxHeight }} className="flex-1">
        <div className={compact ? "p-1" : "p-2"}>
          {groups.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("noVariables", { fallback: "No variables available" })}
            </div>
          ) : (
            groups.map((group) => (
              <CategorySection
                key={group.category}
                group={group}
                isExpanded={effectiveExpandedCategories.has(group.category)}
                onToggle={() => toggleCategory(group.category)}
                onSelect={onSelect}
                onDragStart={onDragStart}
                searchQuery={searchQuery}
                compact={compact}
                locale={locale}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Drag hint */}
      <div
        className={`border-t text-muted-foreground text-center ${
          compact ? "px-2 py-1.5 text-xs-safe" : "px-3 py-2 text-xs"
        }`}
      >
        {t("dragTip", { fallback: "Drag variables into content" })}
      </div>
    </div>
  );
}

export default VariablePalette;
