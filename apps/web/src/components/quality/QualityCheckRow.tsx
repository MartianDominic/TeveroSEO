"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@tevero/ui";
import { ChevronDown, Check, AlertTriangle, X } from "lucide-react";

export type CheckStatus = "pass" | "warning" | "fail";

export interface CheckDetail {
  /** Detail text */
  text: string;
  /** Optional mono-formatted value */
  mono?: string;
  /** Nested details (for hierarchical breakdown) */
  nested?: string[];
}

export interface QualityCheckRowProps {
  /** Check status */
  status: CheckStatus;
  /** Check label (e.g., "Word count") */
  label: string;
  /** Main value (e.g., "3,247") */
  value: string | number;
  /** Target/comparison value (e.g., "/ 3,000") */
  target?: string;
  /** Status badge text (e.g., "optimal") */
  badge?: string;
  /** Expandable detail lines */
  details?: CheckDetail[];
  /** Whether row is expanded */
  isExpanded?: boolean;
  /** Toggle expand callback */
  onToggle?: () => void;
}

const statusConfig: Record<CheckStatus, {
  iconBg: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  badgeVariant: "success" | "warning" | "error";
}> = {
  pass: {
    iconBg: "bg-success-soft",
    iconColor: "text-success",
    Icon: Check,
    badgeVariant: "success",
  },
  warning: {
    iconBg: "bg-warning-soft",
    iconColor: "text-warning",
    Icon: AlertTriangle,
    badgeVariant: "warning",
  },
  fail: {
    iconBg: "bg-error-soft",
    iconColor: "text-error",
    Icon: X,
    badgeVariant: "error",
  },
};

export function QualityCheckRow({
  status,
  label,
  value,
  target,
  badge,
  details,
  isExpanded = false,
  onToggle,
}: QualityCheckRowProps) {
  const config = statusConfig[status];
  const hasDetails = details && details.length > 0;

  return (
    <div className="group">
      {/* Check row */}
      <button
        onClick={hasDetails ? onToggle : undefined}
        disabled={!hasDetails}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-3.5",
          "transition-colors duration-[160ms]",
          hasDetails && "cursor-pointer hover:bg-surface-2",
          !hasDetails && "cursor-default"
        )}
      >
        {/* Status icon */}
        <div
          className={cn(
            "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
            config.iconBg, config.iconColor
          )}
        >
          <config.Icon className="w-3.5 h-3.5" />
        </div>

        {/* Label */}
        <span className="flex-1 text-[14px] text-text-2 text-left">
          {label}
        </span>

        {/* Value + target */}
        <div className="flex items-baseline gap-1">
          <span className="font-display text-[16px] text-text-1 tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </span>
          {target && (
            <span className="text-[14px] text-text-3">
              {target}
            </span>
          )}
        </div>

        {/* Badge */}
        {badge && (
          <Badge variant={config.badgeVariant} className="ml-2">
            {badge}
          </Badge>
        )}

        {/* Expand chevron */}
        {hasDetails && (
          <ChevronDown
            className={cn(
              "w-4 h-4 text-text-3 flex-shrink-0 ml-2",
              "transition-transform duration-[280ms]",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expandable details */}
      {hasDetails && (
        <div
          className={cn(
            "overflow-hidden bg-surface-2 transition-all duration-[300ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="pl-[52px] pr-5 py-3 space-y-1.5">
            {details.map((detail, idx) => (
              <div key={idx} className="space-y-1">
                {/* Main detail line */}
                <div className="flex items-start gap-2 text-[13px] text-text-3">
                  <span className="font-mono text-text-4 flex-shrink-0">
                    {idx === details.length - 1 && !detail.nested ? "└─" : "├─"}
                  </span>
                  <span>
                    {detail.text}
                    {detail.mono && (
                      <span className="ml-1 font-mono text-text-2">
                        {detail.mono}
                      </span>
                    )}
                  </span>
                </div>

                {/* Nested details */}
                {detail.nested && (
                  <div className="pl-6 space-y-1">
                    {detail.nested.map((nested, nIdx) => (
                      <div
                        key={nIdx}
                        className="flex items-start gap-2 text-[13px] text-text-3"
                      >
                        <span className="font-mono text-text-4 flex-shrink-0">
                          {nIdx === detail.nested!.length - 1 ? "└─" : "├─"}
                        </span>
                        <span>{nested}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

QualityCheckRow.displayName = "QualityCheckRow";
