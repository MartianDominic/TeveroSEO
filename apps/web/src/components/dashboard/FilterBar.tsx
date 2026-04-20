"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Badge,
  Checkbox,
  Slider,
} from "@tevero/ui";
import { Search, Filter, X } from "lucide-react";
import type { FilterParams } from "@/types/pagination";

interface FilterBarProps {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  activeFilterCount: number;
}

export function FilterBar({ filters, onFiltersChange, activeFilterCount }: FilterBarProps) {
  const [search, setSearch] = useState(filters.search ?? "");

  const handleSearchSubmit = () => {
    onFiltersChange({ ...filters, search: search || undefined });
  };

  const clearFilters = () => {
    setSearch("");
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          className="pl-9"
        />
      </div>

      {/* Filter Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <h4 className="font-medium">Filters</h4>

            {/* Goal Attainment Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Goal Attainment</label>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{filters.goalAttainmentMin ?? 0}%</span>
                <Slider
                  value={[
                    filters.goalAttainmentMin ?? 0,
                    filters.goalAttainmentMax ?? 100,
                  ]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([min, max]) =>
                    onFiltersChange({
                      ...filters,
                      goalAttainmentMin: min,
                      goalAttainmentMax: max,
                    })
                  }
                  className="flex-1"
                />
                <span>{filters.goalAttainmentMax ?? 100}%</span>
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="flex flex-wrap gap-2">
                {["on_track", "watching", "critical"].map((status) => (
                  <label key={status} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={filters.status?.includes(status) ?? false}
                      onCheckedChange={(checked) => {
                        const current = filters.status ?? [];
                        onFiltersChange({
                          ...filters,
                          status: checked
                            ? [...current, status]
                            : current.filter((s) => s !== status),
                        });
                      }}
                    />
                    {status.replace("_", " ")}
                  </label>
                ))}
              </div>
            </div>

            {/* Has Alerts */}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.hasAlerts ?? false}
                onCheckedChange={(checked) =>
                  onFiltersChange({ ...filters, hasAlerts: checked === true ? true : undefined })
                }
              />
              Has pending alerts
            </label>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
