"use client";

/**
 * TrustIndicator Component
 *
 * Shows the source/trust level of data per D-02 constraint.
 * - verified: checkmark icon, "GSC" label (Google Search Console data)
 * - estimated: asterisk, "* estimated" label (DataForSEO volume/CPC)
 * - client: user icon, "your input" label (client-provided data)
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, User, Asterisk } from "lucide-react";
import type { TrustLevel } from "@/lib/portal/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TrustIndicatorProps {
  /** Trust level of the data */
  level: TrustLevel;
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const trustConfig: Record<
  TrustLevel,
  {
    icon: React.ElementType;
    label: string;
    tooltip: string;
    colorClass: string;
  }
> = {
  verified: {
    icon: Check,
    label: "GSC",
    tooltip: "Verified data from Google Search Console",
    colorClass: "text-success",
  },
  estimated: {
    icon: Asterisk,
    label: "* estimated",
    tooltip: "Estimated data (volume, CPC) - may vary from actual values",
    colorClass: "text-text-3",
  },
  client: {
    icon: User,
    label: "your input",
    tooltip: "Data provided by you",
    colorClass: "text-accent",
  },
};

export function TrustIndicator({
  level,
  showLabel = true,
  className,
}: TrustIndicatorProps) {
  const config = trustConfig[level];
  const Icon = config.icon;

  const indicator = (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        "text-[12px] font-sans",
        config.colorClass,
        className
      )}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      {showLabel && (
        <span className="font-medium tracking-[0.02em]">{config.label}</span>
      )}
    </span>
  );

  // Wrap in tooltip for additional context
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="text-[13px]">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Footnote component for pages with estimated data
 * Per D-02: Show asterisk footnote explaining estimated values
 */
export function EstimatedDataFootnote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "text-[12px] text-text-3 font-sans flex items-center gap-1",
        className
      )}
    >
      <Asterisk className="h-3 w-3 inline" />
      <span>
        Values marked with * are estimates from third-party data providers and
        may differ from actual values.
      </span>
    </p>
  );
}
