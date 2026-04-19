"use client";

import { Badge } from "@tevero/ui";
import { TrendingDown, AlertCircle, Link2Off, CheckCircle2 } from "lucide-react";
import type { ClientStatus } from "@/lib/analytics/types";

const STATUS_CONFIG: Record<ClientStatus, {
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  good: { variant: "default", icon: CheckCircle2, label: "Healthy" },
  drop: { variant: "destructive", icon: TrendingDown, label: "Traffic Drop" },
  no_gsc: { variant: "outline", icon: Link2Off, label: "Not Connected" },
  stale: { variant: "secondary", icon: AlertCircle, label: "Sync Stale" },
};

interface StatusBadgeProps {
  status: ClientStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}
