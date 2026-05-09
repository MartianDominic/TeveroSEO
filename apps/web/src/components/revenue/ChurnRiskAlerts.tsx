"use client";

/**
 * Churn risk alerts component.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-18-21: Displays churn risk signals aggregated from multiple sources.
 * - D-18: Service period ending
 * - D-19: No contact logged
 * - D-20: Deliverables overdue
 * - D-21: SEO metrics declining
 */

import { AlertTriangle, Clock, Calendar, TrendingDown, User } from "lucide-react";

import { cn } from "@/lib/utils";

import { Card, CardHeader, CardTitle, CardContent } from "@tevero/ui";

/**
 * Churn risk types per D-18-21.
 */
export type ChurnRiskType =
  | "service_ending" // D-18
  | "no_contact" // D-19
  | "deliverables_overdue" // D-20
  | "seo_declining"; // D-21

/**
 * Churn risk severity levels.
 */
export type ChurnRiskSeverity = "high" | "medium" | "low";

/**
 * Churn risk alert structure.
 */
export interface ChurnRiskItem {
  id: string;
  type: ChurnRiskType;
  severity: ChurnRiskSeverity;
  clientId: string;
  clientName: string;
  description: string;
}

/**
 * Props for ChurnRiskAlerts component.
 */
export interface ChurnRiskAlertsProps {
  risks: ChurnRiskItem[];
  onViewClient?: (clientId: string) => void;
  maxItems?: number;
}

/**
 * Icon mapping for risk types.
 */
const typeIcons: Record<ChurnRiskType, typeof AlertTriangle> = {
  service_ending: Calendar,
  no_contact: User,
  deliverables_overdue: Clock,
  seo_declining: TrendingDown,
};

/**
 * Color mapping for severity levels.
 */
const severityStyles: Record<ChurnRiskSeverity, string> = {
  high: "border-l-error bg-error/5",
  medium: "border-l-warning bg-warning/5",
  low: "border-l-text-4 bg-surface-2",
};

/**
 * Displays churn risk alerts per D-18-21.
 */
export function ChurnRiskAlerts({
  risks,
  onViewClient,
  maxItems = 10,
}: ChurnRiskAlertsProps) {
  if (risks.length === 0) {
    return null;
  }

  const displayedRisks = risks.slice(0, maxItems);
  const remainingCount = risks.length - maxItems;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Churn Risk Alerts ({risks.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayedRisks.map((risk) => {
          const Icon = typeIcons[risk.type];

          return (
            <div
              key={risk.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border-l-4 cursor-pointer",
                "hover:opacity-90 transition-opacity",
                severityStyles[risk.severity]
              )}
              role="button"
              tabIndex={0}
              onClick={() => onViewClient?.(risk.clientId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onViewClient?.(risk.clientId);
                }
              }}
            >
              <Icon className="h-4 w-4 mt-0.5 text-text-3 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-1 truncate">
                  {risk.clientName}
                </p>
                <p className="text-xs-safe text-text-3">{risk.description}</p>
              </div>
            </div>
          );
        })}

        {/* Show more indicator */}
        {remainingCount > 0 && (
          <p className="text-xs-safe text-text-3 text-center pt-2">
            +{remainingCount} more alerts
          </p>
        )}
      </CardContent>
    </Card>
  );
}

ChurnRiskAlerts.displayName = "ChurnRiskAlerts";
