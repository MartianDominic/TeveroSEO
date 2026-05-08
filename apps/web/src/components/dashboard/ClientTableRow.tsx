"use client";

import React from "react";
import { TableCell, TableRow, Badge, Checkbox } from "@tevero/ui";
import { ChevronRight } from "lucide-react";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { GoalAttainmentBadge } from "./GoalAttainmentBadge";
import { PositionDistributionBar } from "./PositionDistributionBar";
import {
  HealthHoverPopover,
  TrafficHoverPopover,
  KeywordsHoverPopover,
} from "./ClientTableHoverPopover";
import { LazySparkline } from "./LazySparkline";
import type { ClientMetrics } from "@/lib/dashboard/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTrend(pct: number): React.ReactNode {
  const formatted = `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
  if (pct > 0.05) return <span className="text-emerald-600">{formatted}</span>;
  if (pct < -0.05) return <span className="text-red-600">{formatted}</span>;
  return <span className="text-muted-foreground">{formatted}</span>;
}

// ---------------------------------------------------------------------------
// ClientTableRow
// ---------------------------------------------------------------------------

export interface ClientTableRowProps {
  client: ClientMetrics;
  onRowClick: (clientId: string) => void;
  showSparklines?: boolean;
  enableSelection?: boolean;
  isSelected?: boolean;
  onSelectionClick?: (clientId: string, event: React.MouseEvent) => void;
  checkboxProps?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
}

export const ClientTableRow: React.FC<ClientTableRowProps> = ({
  client,
  onRowClick,
  showSparklines = false,
  enableSelection = false,
  isSelected = false,
  onSelectionClick,
  checkboxProps,
}) => {
  return (
    <TableRow
      onClick={(e) => {
        // Don't navigate if clicking on checkbox
        if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
        onRowClick(client.clientId);
      }}
      className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-muted/30" : ""}`}
    >
      {enableSelection && checkboxProps && (
        <TableCell
          onClick={(e) => {
            e.stopPropagation();
            onSelectionClick?.(client.clientId, e);
          }}
        >
          <Checkbox
            checked={checkboxProps.checked}
            onCheckedChange={checkboxProps.onChange}
            aria-label={`Select ${client.clientName}`}
          />
        </TableCell>
      )}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <span className="truncate">{client.clientName}</span>
          {client.connectionStatus === "stale" && (
            <Badge
              variant="outline"
              className="text-xs bg-yellow-100 text-yellow-800"
            >
              Stale
            </Badge>
          )}
          {client.connectionStatus === "disconnected" && (
            <Badge
              variant="outline"
              className="text-xs bg-red-100 text-red-800"
            >
              No GSC
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {client.goalsTotalCount > 0 ? (
          <div className="flex flex-col gap-0.5">
            <GoalAttainmentBadge
              attainmentPct={client.goalAttainmentPct}
              goalsMet={client.goalsMetCount}
              goalsTotal={client.goalsTotalCount}
              trend={client.primaryGoalTrend}
              size="sm"
            />
            {client.primaryGoalName && (
              <span className="text-xs-safe text-muted-foreground truncate max-w-[120px]">
                {client.primaryGoalName}
              </span>
            )}
          </div>
        ) : (
          <HealthHoverPopover
            data={{
              score: client.healthScore,
              breakdown: client.healthBreakdown,
            }}
          >
            <HealthScoreBadge
              score={client.healthScore}
              showLabel={false}
              size="sm"
            />
          </HealthHoverPopover>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <TrafficHoverPopover
          data={{
            current: client.trafficCurrent,
            previous: client.trafficPrevious,
            trendPct: client.trafficTrendPct,
            dailyData: [], // Would be populated from extended data
          }}
        >
          {client.trafficCurrent.toLocaleString()}
        </TrafficHoverPopover>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {showSparklines ? (
          <div className="flex items-center justify-end gap-2">
            <LazySparkline
              clientId={client.clientId}
              metric="traffic"
              width={60}
              height={20}
            />
            {formatTrend(client.trafficTrendPct)}
          </div>
        ) : (
          formatTrend(client.trafficTrendPct)
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <KeywordsHoverPopover
          data={{
            total: client.keywordsTotal,
            top10: client.keywordsTop10,
            top3: client.keywordsTop3,
            position1: client.keywordsPosition1,
          }}
        >
          {client.keywordsTotal.toLocaleString()}
        </KeywordsHoverPopover>
      </TableCell>
      <TableCell>
        <PositionDistributionBar
          top10={client.keywordsTop10}
          top3={client.keywordsTop3}
          position1={client.keywordsPosition1}
          total={client.keywordsTotal}
          showLabels={false}
        />
      </TableCell>
      <TableCell className="text-right">
        {client.alertsOpen > 0 ? (
          <Badge
            variant="secondary"
            className={
              client.alertsCritical > 0
                ? "bg-red-100 text-red-800"
                : "bg-yellow-100 text-yellow-800"
            }
          >
            {client.alertsOpen}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
};
