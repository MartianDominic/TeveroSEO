/**
 * KeywordList Component
 * Phase 86-07: Proposal Output + Editing UX
 *
 * Displays keywords in a sortable table/list format.
 * Shows: keyword, volume, difficulty, funnel stage, position (if available).
 * Quick-win badge for position 11-50 (striking distance).
 *
 * IMMUTABLE: Component is stateless, receives data via props.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Button,
  cn,
} from '@tevero/ui';
import { X, ArrowUpDown, ArrowUp, ArrowDown, Zap } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface KeywordData {
  keyword: string;
  volume: number;
  difficulty: number;
  funnelStage: 'bofu' | 'mofu' | 'tofu';
  position?: number | null;
}

export interface KeywordListProps {
  keywords: readonly KeywordData[];
  onRemoveKeyword?: (keyword: string) => void;
  editable?: boolean;
  compact?: boolean;
}

type SortField = 'keyword' | 'volume' | 'difficulty' | 'funnelStage' | 'position';
type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if position qualifies as a quick-win (ranks 11-50).
 */
function isQuickWin(position: number | null | undefined): boolean {
  return position !== null && position !== undefined && position >= 11 && position <= 50;
}

/**
 * Get funnel stage display info.
 */
function getFunnelStageInfo(stage: 'bofu' | 'mofu' | 'tofu'): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  switch (stage) {
    case 'bofu':
      return { label: 'BOFU', variant: 'default' };
    case 'mofu':
      return { label: 'MOFU', variant: 'secondary' };
    case 'tofu':
      return { label: 'TOFU', variant: 'outline' };
  }
}

/**
 * Get difficulty color class based on value.
 */
function getDifficultyColor(difficulty: number): string {
  if (difficulty < 30) return 'text-green-600';
  if (difficulty < 70) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Format volume with K/M suffixes.
 */
function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}K`;
  }
  return volume.toString();
}

// ============================================================================
// Component
// ============================================================================

export function KeywordList({
  keywords,
  onRemoveKeyword,
  editable = false,
  compact = false,
}: KeywordListProps) {
  const [sortState, setSortState] = useState<SortState>({
    field: 'volume',
    direction: 'desc',
  });

  // Handle column header click for sorting
  const handleSort = useCallback((field: SortField) => {
    setSortState((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  // Sort keywords (creates NEW array - IMMUTABLE)
  const sortedKeywords = useMemo(() => {
    const sorted = [...keywords];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortState.field) {
        case 'keyword':
          comparison = a.keyword.localeCompare(b.keyword);
          break;
        case 'volume':
          comparison = a.volume - b.volume;
          break;
        case 'difficulty':
          comparison = a.difficulty - b.difficulty;
          break;
        case 'funnelStage':
          // Order: BOFU > MOFU > TOFU
          const stageOrder = { bofu: 3, mofu: 2, tofu: 1 };
          comparison = stageOrder[a.funnelStage] - stageOrder[b.funnelStage];
          break;
        case 'position':
          // Null positions go to end
          const posA = a.position ?? 999;
          const posB = b.position ?? 999;
          comparison = posA - posB;
          break;
      }

      return sortState.direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [keywords, sortState]);

  // Render sort icon for column header
  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (sortState.field !== field) {
        return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
      }
      return sortState.direction === 'desc' ? (
        <ArrowDown className="ml-1 h-3 w-3" />
      ) : (
        <ArrowUp className="ml-1 h-3 w-3" />
      );
    },
    [sortState]
  );

  // Column header component with sort functionality
  const SortableHeader = useCallback(
    ({ field, children }: { field: SortField; children: React.ReactNode }) => (
      <TableHead
        className="cursor-pointer select-none hover:bg-muted/50"
        onClick={() => handleSort(field)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSort(field);
          }
        }}
        aria-sort={
          sortState.field === field
            ? sortState.direction === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
      >
        <div className="flex items-center">
          {children}
          {renderSortIcon(field)}
        </div>
      </TableHead>
    ),
    [handleSort, renderSortIcon, sortState]
  );

  if (keywords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No keywords to display
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="keyword">Keyword</SortableHeader>
            <SortableHeader field="volume">Volume</SortableHeader>
            {!compact && (
              <>
                <SortableHeader field="difficulty">KD</SortableHeader>
                <SortableHeader field="funnelStage">Funnel</SortableHeader>
                <SortableHeader field="position">Position</SortableHeader>
              </>
            )}
            {editable && onRemoveKeyword && (
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedKeywords.map((kw) => {
            const funnelInfo = getFunnelStageInfo(kw.funnelStage);
            const quickWin = isQuickWin(kw.position);

            return (
              <TableRow key={kw.keyword}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span>{kw.keyword}</span>
                    {quickWin && (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800 border-amber-200 gap-1"
                      >
                        <Zap className="h-3 w-3" />
                        Quick Win
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatVolume(kw.volume)}</TableCell>
                {!compact && (
                  <>
                    <TableCell>
                      <span className={cn('font-medium', getDifficultyColor(kw.difficulty))}>
                        {kw.difficulty}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={funnelInfo.variant}>{funnelInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {kw.position !== null && kw.position !== undefined ? (
                        <span
                          className={cn(
                            'font-mono text-sm',
                            quickWin && 'text-amber-600 font-semibold'
                          )}
                        >
                          #{kw.position}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </>
                )}
                {editable && onRemoveKeyword && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveKeyword(kw.keyword)}
                      aria-label={`Remove ${kw.keyword}`}
                      className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
