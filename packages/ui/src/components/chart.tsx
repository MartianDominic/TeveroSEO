"use client";

import * as React from "react";
import { Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "../lib/utils";

export type ChartConfig = Record<string, { label?: string; color?: string }>;

interface ChartContainerProps {
  config: ChartConfig;
  children: React.ReactElement;
  className?: string;
}

export function ChartContainer({ config, children, className }: ChartContainerProps) {
  const cssVars = Object.entries(config).reduce<Record<string, string>>((acc, [key, val]) => {
    if (val.color) {
      acc[`--color-${key}`] = val.color;
    }
    return acc;
  }, {});

  return (
    <div
      className={cn("relative w-full", className)}
      style={cssVars as React.CSSProperties}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  dataKey?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

export function ChartTooltipContent({ active, payload, label }: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-sm p-2 text-xs">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((item, index) => (
        <p key={index} className="text-muted-foreground">
          {item.name ?? item.dataKey}: <span className="font-semibold text-foreground">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

export const ChartTooltip = Tooltip;
