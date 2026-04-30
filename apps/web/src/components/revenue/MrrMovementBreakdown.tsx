"use client";

/**
 * MRR movement breakdown component.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-12: Shows new MRR, expansion MRR, churn MRR, and net movement.
 */

import { Card, CardHeader, CardTitle, CardContent } from "@tevero/ui";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * Props for MrrMovementBreakdown component.
 */
export interface MrrMovementBreakdownProps {
  newMrrCents: number;
  expansionMrrCents: number;
  churnMrrCents: number;
  currency: string;
}

/**
 * Displays MRR movement breakdown per D-12.
 */
export function MrrMovementBreakdown({
  newMrrCents,
  expansionMrrCents,
  churnMrrCents,
  currency,
}: MrrMovementBreakdownProps) {
  const netMovement = newMrrCents + expansionMrrCents - churnMrrCents;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">MRR Movement This Month</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* New MRR */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-success" />
              <span className="text-sm text-text-2">New MRR</span>
            </div>
            <span className="text-sm font-medium text-success">
              +{formatCurrency(newMrrCents, currency)}
            </span>
          </div>

          {/* Expansion MRR */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-success" />
              <span className="text-sm text-text-2">Expansion MRR</span>
            </div>
            <span className="text-sm font-medium text-success">
              +{formatCurrency(expansionMrrCents, currency)}
            </span>
          </div>

          {/* Churn MRR */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-error" />
              <span className="text-sm text-text-2">Churn MRR</span>
            </div>
            <span className="text-sm font-medium text-error">
              -{formatCurrency(churnMrrCents, currency)}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-hairline-1" />

          {/* Net Movement */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {netMovement > 0 ? (
                <ArrowUp className="h-4 w-4 text-success" />
              ) : netMovement < 0 ? (
                <ArrowDown className="h-4 w-4 text-error" />
              ) : (
                <Minus className="h-4 w-4 text-text-3" />
              )}
              <span className="text-sm font-medium text-text-1">
                Net Movement
              </span>
            </div>
            <span
              className={cn(
                "text-sm font-semibold",
                netMovement > 0
                  ? "text-success"
                  : netMovement < 0
                    ? "text-error"
                    : "text-text-2"
              )}
            >
              {netMovement >= 0 ? "+" : ""}
              {formatCurrency(netMovement, currency)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

MrrMovementBreakdown.displayName = "MrrMovementBreakdown";
