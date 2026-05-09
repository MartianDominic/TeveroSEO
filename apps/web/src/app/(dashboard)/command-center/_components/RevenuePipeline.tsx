"use client";

/**
 * RevenuePipeline Component
 * Phase 62-05: Command Center Dashboard Core
 *
 * Shows revenue metrics: This Month, Last Month, Outstanding, Overdue.
 * Implemented in Task 3.
 */

import { TrendIndicator } from "@/components/command-center/TrendIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { DashboardMetricsResponse } from "@/types/dashboard-metrics";

import { cn } from "@tevero/ui";

interface RevenuePipelineProps {
  initialData: DashboardMetricsResponse;
}

export function RevenuePipeline({ initialData }: RevenuePipelineProps) {
  const revenue = initialData.metrics?.revenue;

  const items = [
    {
      label: "This Month",
      value: revenue?.thisMonth ?? 0,
      showTrend: true,
      isNegative: false,
    },
    {
      label: "Last Month",
      value: revenue?.lastMonth ?? 0,
      showTrend: false,
      isNegative: false,
    },
    {
      label: "Outstanding",
      value: revenue?.outstanding ?? 0,
      showTrend: false,
      isNegative: false,
    },
    {
      label: "Overdue",
      value: revenue?.overdue ?? 0,
      showTrend: false,
      isNegative: true,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  item.isNegative && item.value > 0 && "text-destructive"
                )}
              >
                {formatCurrency(item.value, "EUR")}
              </p>
              {item.showTrend && revenue?.lastMonth !== undefined && (
                <TrendIndicator
                  current={revenue.thisMonth}
                  previous={revenue.lastMonth}
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
