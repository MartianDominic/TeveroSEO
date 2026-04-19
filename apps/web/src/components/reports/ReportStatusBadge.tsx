"use client";

import { Badge } from "@tevero/ui";
import type { ReportStatus } from "@tevero/types";

interface ReportStatusBadgeProps {
  status: ReportStatus;
}

const statusConfig: Record<ReportStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-zinc-500 text-white" },
  generating: { label: "Generating...", className: "bg-blue-500 text-white" },
  complete: { label: "Complete", className: "bg-emerald-500 text-white" },
  failed: { label: "Failed", className: "bg-red-500 text-white" },
};

export function ReportStatusBadge({ status }: ReportStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}
