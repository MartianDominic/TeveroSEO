"use client";

import { useState, useCallback, useMemo } from "react";
import { SavedViewSelector } from "./SavedViewSelector";
import { ColumnCustomizer } from "./ColumnCustomizer";
import { FilterBar } from "./FilterBar";
import {
  type ViewConfig,
  getDefaultViewConfig,
  DEFAULT_COLUMNS,
} from "@/types/saved-views";
import type { FilterParams } from "@/types/pagination";

interface TableControlsProps {
  /** Workspace ID for saved views */
  workspaceId: string;
  /** Current view configuration */
  config?: ViewConfig;
  /** Callback when view configuration changes */
  onConfigChange: (config: ViewConfig) => void;
  /** Currently selected view ID */
  selectedViewId?: string | null;
  /** Callback when a view is selected */
  onViewSelect?: (viewId: string | null) => void;
  /** Hide the saved views selector */
  hideSavedViews?: boolean;
  /** Hide the column customizer */
  hideColumnCustomizer?: boolean;
  /** Hide the filter bar */
  hideFilterBar?: boolean;
}

/**
 * TableControls combines saved views, column customization, and filtering
 * into a unified control bar for the client portfolio table.
 */
export function TableControls({
  workspaceId,
  config: externalConfig,
  onConfigChange,
  selectedViewId,
  onViewSelect,
  hideSavedViews = false,
  hideColumnCustomizer = false,
  hideFilterBar = false,
}: TableControlsProps) {
  // Use external config or fall back to default
  const config = externalConfig ?? getDefaultViewConfig();

  // Track if user has modified the view (for "unsaved changes" indicator)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Handle column changes
  const handleColumnsChange = useCallback(
    (columns: string[]) => {
      onConfigChange({ ...config, columns });
      setHasUnsavedChanges(true);
    },
    [config, onConfigChange]
  );

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (filters: FilterParams) => {
      onConfigChange({ ...config, filters });
      setHasUnsavedChanges(true);
    },
    [config, onConfigChange]
  );

  // Handle view selection (resets unsaved changes)
  const handleViewSelect = useCallback(
    (newConfig: ViewConfig) => {
      onConfigChange(newConfig);
      setHasUnsavedChanges(false);
      // Find the view ID from the config if needed
      onViewSelect?.(null); // Reset to indicate we're using the selected view's config
    },
    [onConfigChange, onViewSelect]
  );

  // Count active filters for display
  const activeFilterCount = useMemo(() => {
    return Object.values(config.filters).filter(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0)
    ).length;
  }, [config.filters]);

  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">
        {/* Saved Views Selector */}
        {!hideSavedViews && (
          <SavedViewSelector
            workspaceId={workspaceId}
            currentConfig={config}
            onViewSelect={handleViewSelect}
            selectedViewId={selectedViewId}
          />
        )}

        {/* Filter Bar */}
        {!hideFilterBar && (
          <FilterBar
            filters={config.filters}
            onFiltersChange={handleFiltersChange}
            activeFilterCount={activeFilterCount}
          />
        )}

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && (
          <span className="text-xs text-muted-foreground italic">
            Unsaved changes
          </span>
        )}
      </div>

      {/* Column Customizer */}
      {!hideColumnCustomizer && (
        <ColumnCustomizer
          visibleColumns={config.columns.length > 0 ? config.columns : DEFAULT_COLUMNS}
          onColumnsChange={handleColumnsChange}
        />
      )}
    </div>
  );
}
