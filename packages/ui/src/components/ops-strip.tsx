"use client";

import * as React from "react";
import {
  Server,
  Globe,
  Database,
  ListTodo,
  Settings,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatTime } from "../lib/format-time";

// ---------------------------------------------------------------------------
// OpsStripItem interface
// ---------------------------------------------------------------------------

export type OpsStripItemType =
  | "system"
  | "gsc"
  | "dataforseo"
  | "queue"
  | "custom";

export type OpsStripItemStatus = "ok" | "warning" | "error" | "syncing";

export interface OpsStripItem {
  id: string;
  type: OpsStripItemType;
  label: string;
  value?: string | number;
  status: OpsStripItemStatus;
  lastSync?: Date | string;
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// OpsStripProps
// ---------------------------------------------------------------------------

export interface OpsStripProps {
  /** Items to display in the strip */
  items: OpsStripItem[];
  /** Whether the strip is expandable to show details */
  expandable?: boolean;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Type icons
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<OpsStripItemType, LucideIcon> = {
  system: Server,
  gsc: Globe,
  dataforseo: Database,
  queue: ListTodo,
  custom: Settings,
};

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

const STATUS_DOT_COLORS: Record<OpsStripItemStatus, string> = {
  ok: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  syncing: "bg-info animate-pulse",
};

// ---------------------------------------------------------------------------
// OpsStrip
// ---------------------------------------------------------------------------

/**
 * OpsStrip displays a horizontal status bar for system operations.
 *
 * Features:
 * - Horizontal strip at page bottom
 * - Status dots with semantic colors
 * - Font-mono for timestamps/values
 * - Expandable details on click
 * - Items separated by dots
 *
 * @example
 * <OpsStrip
 *   items={[
 *     { id: '1', type: 'system', label: 'API', status: 'ok' },
 *     { id: '2', type: 'queue', label: 'Jobs', value: 5, status: 'syncing' },
 *   ]}
 *   expandable
 * />
 */
export function OpsStrip({
  items,
  expandable = false,
  className,
}: OpsStripProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div
      className={cn(
        "bg-canvas-dim",
        "border-t border-hairline",
        className
      )}
    >
      {/* Main strip */}
      <div className="px-4 py-2 flex items-center justify-between">
        {/* Items */}
        <div className="flex items-center gap-3 overflow-x-auto">
          {items.map((item, index) => {
            const Icon = TYPE_ICONS[item.type];
            const formattedLastSync = item.lastSync
              ? formatTime(item.lastSync)
              : null;

            return (
              <React.Fragment key={item.id}>
                {/* Item */}
                <button
                  onClick={item.onClick}
                  disabled={!item.onClick}
                  className={cn(
                    "flex items-center gap-1.5",
                    "text-[12px] text-text-2",
                    item.onClick && "hover:text-text-1 cursor-pointer",
                    "transition-colors duration-[160ms]",
                    "shrink-0"
                  )}
                >
                  {/* Status dot */}
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full shrink-0",
                      STATUS_DOT_COLORS[item.status]
                    )}
                  />

                  {/* Label */}
                  <span>{item.label}</span>

                  {/* Value */}
                  {item.value !== undefined && (
                    <span className="font-mono text-text-3 [font-variant-numeric:tabular-nums]">
                      {item.value}
                    </span>
                  )}

                  {/* Last sync (in expanded view only) */}
                  {isExpanded && formattedLastSync && (
                    <span className="font-mono text-[11px] text-text-4">
                      ({formattedLastSync})
                    </span>
                  )}
                </button>

                {/* Separator dot */}
                {index < items.length - 1 && (
                  <span className="h-1 w-1 rounded-full bg-text-4 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Expand toggle */}
        {expandable && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "p-1 rounded",
              "text-text-3 hover:text-text-1",
              "hover:bg-surface-2",
              "transition-colors duration-[160ms]",
              "shrink-0"
            )}
            aria-label={isExpanded ? "Collapse details" : "Expand details"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 py-2 border-t border-hairline-2 bg-surface">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type];
              const formattedLastSync = item.lastSync
                ? formatTime(item.lastSync)
                : null;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    "bg-surface-2",
                    item.onClick && "cursor-pointer hover:bg-surface-3"
                  )}
                  onClick={item.onClick}
                >
                  <Icon className="h-4 w-4 text-text-3 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          STATUS_DOT_COLORS[item.status]
                        )}
                      />
                      <span className="text-[12px] font-medium text-text-1 truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-3">
                      {item.value !== undefined && (
                        <span className="font-mono">{item.value}</span>
                      )}
                      {formattedLastSync && (
                        <span className="font-mono">{formattedLastSync}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

OpsStrip.displayName = "OpsStrip";
