/**
 * ViewToggle Component
 * Phase 86-07: Proposal Output + Editing UX
 *
 * Toggles between 'clusters' (strategy view) and 'keywords' (flat list view).
 * Uses Radix Tabs primitive for accessible toggle functionality.
 *
 * IMMUTABLE: Stateless component, controlled via props.
 */

'use client';

import { LayoutGrid, List } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger, cn } from '@tevero/ui';

// ============================================================================
// Types
// ============================================================================

export type ViewMode = 'clusters' | 'keywords';

export interface ViewToggleProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ViewToggle({
  view,
  onViewChange,
  disabled = false,
  className,
}: ViewToggleProps) {
  return (
    <Tabs
      value={view}
      onValueChange={(value) => onViewChange(value as ViewMode)}
      className={cn('w-auto', className)}
    >
      <TabsList className="grid grid-cols-2 w-[200px]">
        <TabsTrigger
          value="clusters"
          disabled={disabled}
          className="gap-2"
          aria-label="View as growth area clusters"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Clusters</span>
        </TabsTrigger>
        <TabsTrigger
          value="keywords"
          disabled={disabled}
          className="gap-2"
          aria-label="View as keyword list"
        >
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Keywords</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
