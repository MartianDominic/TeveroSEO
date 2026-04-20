"use client";

import { useState, useCallback } from "react";
import { TableControls } from "./TableControls";
import { type ViewConfig, getDefaultViewConfig } from "@/types/saved-views";

interface DashboardViewProviderProps {
  /** Workspace ID for saved views */
  workspaceId: string;
}

/**
 * Client component wrapper that manages view state for the dashboard.
 * Renders TableControls with saved views, filters, and column customization.
 */
export function DashboardViewProvider({ workspaceId }: DashboardViewProviderProps) {
  const [config, setConfig] = useState<ViewConfig>(getDefaultViewConfig());
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);

  const handleConfigChange = useCallback((newConfig: ViewConfig) => {
    setConfig(newConfig);
  }, []);

  const handleViewSelect = useCallback((viewId: string | null) => {
    setSelectedViewId(viewId);
  }, []);

  return (
    <TableControls
      workspaceId={workspaceId}
      config={config}
      onConfigChange={handleConfigChange}
      selectedViewId={selectedViewId}
      onViewSelect={handleViewSelect}
    />
  );
}
