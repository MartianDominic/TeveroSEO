"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import { Card, CardHeader, CardTitle, Badge, ProgressBlock } from "@tevero/ui";

import { QualityCheckRow, type CheckStatus, type CheckDetail } from "./QualityCheckRow";

export interface QualityCheck {
  id: string;
  status: CheckStatus;
  label: string;
  value: string | number;
  target?: string;
  badge?: string;
  details?: CheckDetail[];
}

export interface QualityScoreCardProps {
  /** Overall score (0-100) */
  score: number;
  /** Maximum score (default 100) */
  maxScore?: number;
  /** Grade letter (A+, A, B, C, D, F) */
  grade?: string;
  /** Individual quality checks */
  checks: QualityCheck[];
  /** Additional CSS classes */
  className?: string;
}

const gradeConfig: Record<string, { variant: "success" | "default" | "warning" | "error" }> = {
  "A+": { variant: "success" },
  "A": { variant: "success" },
  "B": { variant: "default" },
  "C": { variant: "warning" },
  "D": { variant: "warning" },
  "F": { variant: "error" },
};

/**
 * QualityScoreCard - Displays article quality score with expandable check details
 *
 * Features:
 * - Mega numeral score display (100 / 100)
 * - Grade badge (A+, A, B, etc.)
 * - Expandable check rows showing "under the hood" breakdown
 * - Progress bar visualization
 */
export function QualityScoreCard({
  score,
  maxScore = 100,
  grade,
  checks,
  className,
}: QualityScoreCardProps) {
  const [expandedChecks, setExpandedChecks] = React.useState<Set<string>>(new Set());

  const passCount = checks.filter(c => c.status === "pass").length;
  const totalCount = checks.length;

  const toggleCheck = (id: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Determine overall status from score
  const getOverallStatus = (): "success" | "warning" | "error" => {
    if (score >= 80) return "success";
    if (score >= 60) return "warning";
    return "error";
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-4 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-3">
            <CardTitle>Article Quality</CardTitle>
            <Badge variant={getOverallStatus()} dot>
              {score >= 80 ? "Perfect" : score >= 60 ? "Good" : "Needs Work"}
            </Badge>
          </div>

          {/* Score display */}
          <div className="flex items-baseline gap-6">
            {/* Main score */}
            <ProgressBlock
              current={score}
              target={maxScore}
              size="mega"
              showBar
            />

            {/* Grade badge */}
            {grade && (
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center",
                  "bg-surface-2 border border-hairline-2",
                  "font-display text-[24px] font-medium text-text-1"
                )}
              >
                {grade}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Checks summary */}
      <div className="px-7 py-3 border-b border-hairline-2 bg-surface-2/50">
        <span className="text-[13px] text-text-3">
          <span className="text-text-1 font-medium tabular-nums">{passCount}</span>
          {" of "}
          <span className="tabular-nums">{totalCount}</span>
          {" checks passed"}
        </span>
      </div>

      {/* Check rows */}
      <div className="divide-y divide-hairline-3">
        {checks.map((check) => (
          <QualityCheckRow
            key={check.id}
            status={check.status}
            label={check.label}
            value={check.value}
            target={check.target}
            badge={check.badge}
            details={check.details}
            isExpanded={expandedChecks.has(check.id)}
            onToggle={() => toggleCheck(check.id)}
          />
        ))}
      </div>
    </Card>
  );
}

QualityScoreCard.displayName = "QualityScoreCard";
