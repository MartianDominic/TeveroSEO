"use client";

/**
 * Revenue metric cards grid component.
 * Phase 51-01: MRR & Retention Dashboard
 *
 * D-12: 4 metric cards (MRR, One-Time, Collected, Outstanding)
 */

import { DollarSign, CreditCard, Banknote, AlertCircle } from "lucide-react";

import { formatCurrency } from "@/lib/currency";

import { MetricCard } from "@tevero/ui";

/**
 * Props for RevenueCards component.
 */
export interface RevenueCardsProps {
  mrrCents: number;
  oneTimeCents: number;
  collectedCents: number;
  outstandingCents: number;
  currency: string;
  mrrTrend?: number[];
  mrrDelta?: {
    value: number;
    direction: "up" | "down" | "flat";
    period?: string;
  };
  loading?: boolean;
}

/**
 * Grid of 4 revenue metric cards per D-12.
 */
export function RevenueCards({
  mrrCents,
  oneTimeCents,
  collectedCents,
  outstandingCents,
  currency,
  mrrTrend,
  mrrDelta,
  loading = false,
}: RevenueCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* D-12: Monthly Recurring Revenue */}
      <MetricCard
        label="Monthly Recurring Revenue"
        value={formatCurrency(mrrCents, currency, { compact: true })}
        icon={DollarSign}
        delta={mrrDelta}
        trend={mrrTrend}
        loading={loading}
      />

      {/* D-12: One-Time Revenue */}
      <MetricCard
        label="One-Time Revenue"
        value={formatCurrency(oneTimeCents, currency, { compact: true })}
        icon={Banknote}
        loading={loading}
      />

      {/* D-12: Collected This Month */}
      <MetricCard
        label="Collected This Month"
        value={formatCurrency(collectedCents, currency, { compact: true })}
        icon={CreditCard}
        loading={loading}
      />

      {/* D-12: Outstanding */}
      <MetricCard
        label="Outstanding"
        value={formatCurrency(outstandingCents, currency, { compact: true })}
        icon={AlertCircle}
        loading={loading}
      />
    </div>
  );
}

RevenueCards.displayName = "RevenueCards";
