"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusChipProps {
  status: string;
  label?: string;
  pulse?: boolean;
  className?: string;
}

type StatusConfig = {
  className: string;
  pulse?: boolean;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  published: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  success: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  approved: {
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  generating: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pulse: true,
  },
  pending_review: {
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  failed: {
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  draft: {
    className: "bg-muted text-muted-foreground",
  },
  scheduled: {
    className: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  publishing: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    pulse: true,
  },
  cancelled: {
    className: "bg-muted text-muted-foreground line-through",
  },
  connected: {
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  error: {
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
  warning: {
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

const FALLBACK: StatusConfig = {
  className: "bg-muted text-muted-foreground",
};

function autoLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  pulse: forcePulse,
  className,
}) => {
  const config = STATUS_MAP[status] ?? FALLBACK;
  const shouldPulse = forcePulse ?? config.pulse ?? false;
  const displayLabel = label ?? autoLabel(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {shouldPulse && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {displayLabel}
    </span>
  );
};
