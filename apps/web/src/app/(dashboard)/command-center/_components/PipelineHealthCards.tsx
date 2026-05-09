"use client";

/**
 * PipelineHealthCards Component
 * Phase 62-05: Command Center Dashboard Core
 *
 * Grid of 4 pipeline status cards: Prospects, Proposals, Agreements, Payments.
 * Implemented in Task 2.
 */

import { Users, FileText, FileSignature, CreditCard } from "lucide-react";

import { DraggableCard } from "@/components/command-center/DraggableCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardMetrics } from "@/hooks/command-center/useDashboardMetrics";
import type { DashboardMetricsResponse, PipelineMetrics } from "@/types/dashboard-metrics";

import type { LucideIcon } from "lucide-react";

interface PipelineHealthCardsProps {
  initialData: DashboardMetricsResponse;
  workspaceId: string;
}

interface CardConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  key: keyof PipelineMetrics;
}

const CARDS: CardConfig[] = [
  { id: "prospects", title: "Prospects", icon: Users, key: "prospects" },
  { id: "proposals", title: "Proposals", icon: FileText, key: "proposals" },
  { id: "agreements", title: "Agreements", icon: FileSignature, key: "agreements" },
  { id: "payments", title: "Payments", icon: CreditCard, key: "payments" },
];

/**
 * Get stages for a specific pipeline type.
 */
function getStagesForType(
  type: keyof PipelineMetrics,
  data: PipelineMetrics[keyof PipelineMetrics]
): Array<{ label: string; value: number }> {
  if (type === "prospects") {
    const d = data as PipelineMetrics["prospects"];
    return [
      { label: "New", value: d.new },
      { label: "Qualified", value: d.qualified },
      { label: "Contacted", value: d.contacted },
      { label: "Negotiating", value: d.negotiating },
    ];
  }
  if (type === "proposals") {
    const d = data as PipelineMetrics["proposals"];
    return [
      { label: "Draft", value: d.draft },
      { label: "Sent", value: d.sent },
      { label: "Viewed", value: d.viewed },
      { label: "Accepted", value: d.accepted },
    ];
  }
  if (type === "agreements") {
    const d = data as PipelineMetrics["agreements"];
    return [
      { label: "Draft", value: d.draft },
      { label: "Pending", value: d.pending },
      { label: "Signed", value: d.signed },
      { label: "Executed", value: d.executed },
    ];
  }
  // payments
  const d = data as PipelineMetrics["payments"];
  return [
    { label: "Sent", value: d.sent },
    { label: "Paid (30d)", value: d.paid30d },
    { label: "Overdue", value: d.overdue },
  ];
}

function PipelineCardContent({
  data,
  type,
}: {
  data: PipelineMetrics[keyof PipelineMetrics] | undefined;
  type: keyof PipelineMetrics;
}) {
  if (!data) {
    return <div className="animate-pulse h-20 bg-muted rounded" />;
  }

  const stages = getStagesForType(type, data);

  return (
    <div className="space-y-2">
      {stages.map((stage) => (
        <div key={stage.label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{stage.label}</span>
          <span className="font-medium">{stage.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PipelineHealthCards({
  initialData,
  workspaceId,
}: PipelineHealthCardsProps) {
  const { data } = useDashboardMetrics(workspaceId, { initialData });
  const pipeline = data?.metrics?.pipeline;

  return (
    <>
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <DraggableCard key={card.id} id={card.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <PipelineCardContent
                  data={pipeline?.[card.key]}
                  type={card.key}
                />
              </CardContent>
            </Card>
          </DraggableCard>
        );
      })}
    </>
  );
}
