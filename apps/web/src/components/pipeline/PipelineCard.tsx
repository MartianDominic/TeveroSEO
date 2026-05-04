"use client";

/**
 * PipelineCard Component
 * Phase 50: Pipeline Kanban
 *
 * Displays a prospect card in the kanban board with D-07 display fields
 * and D-08 quick actions (move, view, archive).
 */

import { useState, useCallback, useMemo } from "react";
import { differenceInDays } from "date-fns";
import { KanbanCard, Button, Popover, PopoverContent, PopoverTrigger } from "@tevero/ui";
import { MoreHorizontal, Eye, Archive, ArrowRight, ChevronRight } from "lucide-react";

export interface PipelineCardProps {
  /** Unique prospect ID */
  id: string;
  /** Domain name (primary identifier) */
  domain: string;
  /** Company name (D-07) */
  companyName: string | null;
  /** Deal value in cents from linked proposal (D-07) */
  dealValueCents: number | null;
  /** When prospect entered current stage (for days calculation) */
  stageEnteredAt: Date;
  /** User ID of deal owner (D-07) */
  assignedTo: string | null;
  /** When prospect was first created (D-07 days since first contact) */
  firstContactAt: Date;
  /** Available stages for move dropdown (D-08) */
  stages: Array<{ id: string; name: string }>;
  /** View details handler (D-08) */
  onViewDetails: () => void;
  /** Move to stage handler (D-08) */
  onMoveToStage: (stageId: string) => void;
  /** Archive handler (D-08) */
  onArchive: () => void;
  /** Whether card is draggable */
  draggable?: boolean;
}

export function PipelineCard({
  id,
  domain,
  companyName,
  dealValueCents,
  stageEnteredAt,
  assignedTo,
  firstContactAt,
  stages,
  onViewDetails,
  onMoveToStage,
  onArchive,
  draggable = true,
}: PipelineCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);

  // D-07: Calculate days in current stage
  const daysInStage = useMemo(
    () => differenceInDays(new Date(), stageEnteredAt),
    [stageEnteredAt]
  );

  // D-07: Format deal value for display
  const formattedValue = useMemo(
    () =>
      dealValueCents
        ? new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(dealValueCents / 100)
        : null,
    [dealValueCents]
  );

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      setMenuOpen(false);
      setStagesOpen(false);
    },
    []
  );

  const handleViewDetails = useCallback(
    () => handleAction(onViewDetails),
    [handleAction, onViewDetails]
  );

  const handleArchive = useCallback(
    () => handleAction(onArchive),
    [handleAction, onArchive]
  );

  const handleMoveToStage = useCallback(
    (stageId: string) => handleAction(() => onMoveToStage(stageId)),
    [handleAction, onMoveToStage]
  );

  return (
    <KanbanCard
      id={id}
      title={domain}
      subtitle={companyName || undefined}
      draggable={draggable}
      onClick={onViewDetails}
      meta={
        <div className="flex items-center justify-between">
          {/* D-07: Deal value, days in stage */}
          <div className="flex items-center gap-2 text-xs text-text-3">
            {formattedValue && (
              <span className="font-medium text-text-2">{formattedValue}</span>
            )}
            <span>{daysInStage}d in stage</span>
          </div>

          {/* D-08: Quick actions menu */}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={handleViewDetails}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded text-text-2 hover:bg-surface-2 hover:text-text-1"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>

                {/* D-08: Move to stage submenu */}
                <Popover open={stagesOpen} onOpenChange={setStagesOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="flex items-center justify-between w-full px-3 py-2 text-sm rounded text-text-2 hover:bg-surface-2 hover:text-text-1"
                    >
                      <span className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4" />
                        Move to Stage
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="right" align="start" className="w-40 p-1">
                    <div className="flex flex-col gap-0.5">
                      {stages.map((stage) => (
                        <button
                          key={stage.id}
                          onClick={() => handleMoveToStage(stage.id)}
                          className="w-full px-3 py-2 text-sm text-left rounded text-text-2 hover:bg-surface-2 hover:text-text-1"
                        >
                          {stage.name}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="h-px bg-hairline-2 my-1" />

                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded text-error hover:bg-error-soft"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      }
    />
  );
}
