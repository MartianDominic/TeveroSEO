"use client";

/**
 * StatCard - Simple stat display card.
 *
 * Extracted from client dashboard page.
 */

import React from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subtitle }) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
    {subtitle && (
      <p className="mt-0.5 text-xs-safe text-muted-foreground">{subtitle}</p>
    )}
  </div>
);
