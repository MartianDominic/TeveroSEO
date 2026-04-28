/**
 * GapFilterBar component
 * Phase 28-03: Gap Analysis Filter Controls
 *
 * Filter controls for keyword gap analysis:
 * - Min volume filter (number input)
 * - Max difficulty filter (slider 0-100)
 * - Competitor selector (multi-select dropdown)
 */
import { useState, useCallback } from "react";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Slider } from "@/client/components/ui/slider";
import { Button } from "@/client/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/client/components/ui/popover";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Badge } from "@/client/components/ui/badge";
import { ChevronDown, X } from "lucide-react";

/**
 * Filter state for keyword gap analysis
 */
export interface GapFilters {
  minVolume: number;
  maxDifficulty: number;
  selectedCompetitors: string[];
}

/**
 * Default filter values
 */
export const DEFAULT_GAP_FILTERS: GapFilters = {
  minVolume: 0,
  maxDifficulty: 100,
  selectedCompetitors: [],
};

interface GapFilterBarProps {
  filters: GapFilters;
  onFiltersChange: (filters: GapFilters) => void;
  competitors: string[];
}

/**
 * Filter bar for keyword gap analysis
 */
export function GapFilterBar({
  filters,
  onFiltersChange,
  competitors,
}: GapFilterBarProps) {
  const [competitorPopoverOpen, setCompetitorPopoverOpen] = useState(false);

  const handleMinVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      onFiltersChange({
        ...filters,
        minVolume: isNaN(value) ? 0 : Math.max(0, value),
      });
    },
    [filters, onFiltersChange]
  );

  const handleMaxDifficultyChange = useCallback(
    (value: number[]) => {
      onFiltersChange({
        ...filters,
        maxDifficulty: value[0],
      });
    },
    [filters, onFiltersChange]
  );

  const handleCompetitorToggle = useCallback(
    (competitor: string, checked: boolean) => {
      const newSelected = checked
        ? [...filters.selectedCompetitors, competitor]
        : filters.selectedCompetitors.filter((c) => c !== competitor);
      onFiltersChange({
        ...filters,
        selectedCompetitors: newSelected,
      });
    },
    [filters, onFiltersChange]
  );

  const handleClearCompetitors = useCallback(() => {
    onFiltersChange({
      ...filters,
      selectedCompetitors: [],
    });
  }, [filters, onFiltersChange]);

  const handleSelectAllCompetitors = useCallback(() => {
    onFiltersChange({
      ...filters,
      selectedCompetitors: [...competitors],
    });
  }, [filters, onFiltersChange, competitors]);

  const handleResetFilters = useCallback(() => {
    onFiltersChange(DEFAULT_GAP_FILTERS);
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.minVolume > 0 ||
    filters.maxDifficulty < 100 ||
    filters.selectedCompetitors.length > 0;

  return (
    <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/30 rounded-lg border">
      {/* Min Volume Filter */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="min-volume" className="text-sm font-medium">
          Min Volume
        </Label>
        <Input
          id="min-volume"
          type="number"
          min={0}
          value={filters.minVolume || ""}
          onChange={handleMinVolumeChange}
          placeholder="0"
          className="w-28"
        />
      </div>

      {/* Max Difficulty Filter */}
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <Label className="text-sm font-medium">
          Max Difficulty: {filters.maxDifficulty}
        </Label>
        <div className="flex items-center gap-2">
          <Slider
            value={[filters.maxDifficulty]}
            onValueChange={handleMaxDifficultyChange}
            max={100}
            min={0}
            step={1}
            className="w-40"
          />
          <span className="text-sm text-muted-foreground w-8">
            {filters.maxDifficulty}
          </span>
        </div>
      </div>

      {/* Competitor Selector */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">Competitors</Label>
        <Popover open={competitorPopoverOpen} onOpenChange={setCompetitorPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={competitorPopoverOpen}
              className="w-[200px] justify-between"
            >
              {filters.selectedCompetitors.length === 0
                ? "All competitors"
                : `${filters.selectedCompetitors.length} selected`}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <div className="p-2 border-b flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAllCompetitors}
                className="text-xs h-7"
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCompetitors}
                className="text-xs h-7"
              >
                Clear
              </Button>
            </div>
            <div className="max-h-[200px] overflow-auto p-2">
              {competitors.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">
                  No competitors found
                </p>
              ) : (
                competitors.map((competitor) => (
                  <div
                    key={competitor}
                    className="flex items-center space-x-2 py-1.5"
                  >
                    <Checkbox
                      id={`competitor-${competitor}`}
                      checked={filters.selectedCompetitors.includes(competitor)}
                      onCheckedChange={(checked) =>
                        handleCompetitorToggle(competitor, checked === true)
                      }
                    />
                    <label
                      htmlFor={`competitor-${competitor}`}
                      className="text-sm cursor-pointer truncate flex-1"
                      title={competitor}
                    >
                      {competitor}
                    </label>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetFilters}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Reset
        </Button>
      )}

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 ml-auto">
          {filters.minVolume > 0 && (
            <Badge variant="secondary">
              Vol &ge; {filters.minVolume.toLocaleString()}
            </Badge>
          )}
          {filters.maxDifficulty < 100 && (
            <Badge variant="secondary">
              Diff &le; {filters.maxDifficulty}
            </Badge>
          )}
          {filters.selectedCompetitors.length > 0 && (
            <Badge variant="secondary">
              {filters.selectedCompetitors.length} competitor
              {filters.selectedCompetitors.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Apply filters to keyword gaps array
 * Returns a new filtered array (immutable)
 */
export function applyGapFilters<
  T extends { searchVolume: number; difficulty: number; competitorDomain: string }
>(gaps: T[], filters: GapFilters): T[] {
  return gaps.filter((gap) => {
    // Min volume filter
    if (gap.searchVolume < filters.minVolume) {
      return false;
    }

    // Max difficulty filter
    if (gap.difficulty > filters.maxDifficulty) {
      return false;
    }

    // Competitor filter (empty means all)
    if (
      filters.selectedCompetitors.length > 0 &&
      !filters.selectedCompetitors.includes(gap.competitorDomain)
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Extract unique competitors from gaps array
 */
export function extractCompetitors<T extends { competitorDomain: string }>(
  gaps: T[]
): string[] {
  const uniqueCompetitors = new Set(gaps.map((g) => g.competitorDomain));
  return Array.from(uniqueCompetitors).sort();
}
