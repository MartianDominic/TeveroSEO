/**
 * Payment Stats Cards Component
 * Phase 60-03: Agency Installment Tracking Dashboard
 *
 * Displays 4 stat cards in a responsive grid:
 * - Upcoming: Payments due in next 7 days
 * - Overdue: Past due payments (highlighted in red if > 0)
 * - This Month: Payments received this month
 * - Total YTD: Year-to-date payments
 *
 * Design reference: D-11 from 60-CONTEXT.md
 */
import * as React from "react";
import { Card, CardContent } from "@/client/components/ui/card";
import { Skeleton } from "@/client/components/ui/skeleton";
import { cn } from "@/client/lib/utils";
import { formatCurrency } from "@/lib/format-currency";
import { CalendarClock, AlertTriangle, CalendarCheck, TrendingUp } from "lucide-react";

/**
 * Single stat object from the API
 */
interface StatValue {
  count: number;
  amountCents: number;
}

/**
 * Props for the PaymentStatsCards component
 */
export interface PaymentStatsCardsProps {
  /** Stats data from /api/payments/stats */
  stats: {
    upcoming: StatValue;
    overdue: StatValue;
    thisMonth: StatValue;
    ytd: StatValue;
  } | null;
  /** Currency code for formatting (default: EUR) */
  currency?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Configuration for each stat card
 */
interface CardConfig {
  key: "upcoming" | "overdue" | "thisMonth" | "ytd";
  label: string;
  icon: React.ElementType;
  iconClass: string;
  highlightOnNonZero?: boolean;
}

const cardConfigs: CardConfig[] = [
  {
    key: "upcoming",
    label: "Upcoming",
    icon: CalendarClock,
    iconClass: "text-blue-600",
  },
  {
    key: "overdue",
    label: "Overdue",
    icon: AlertTriangle,
    iconClass: "text-destructive",
    highlightOnNonZero: true,
  },
  {
    key: "thisMonth",
    label: "This Month",
    icon: CalendarCheck,
    iconClass: "text-green-600",
  },
  {
    key: "ytd",
    label: "Total YTD",
    icon: TrendingUp,
    iconClass: "text-primary",
  },
];

/**
 * Single stat card skeleton for loading state
 */
function StatCardSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Single stat card with icon, amount, and count
 */
function StatCard({
  config,
  value,
  currency,
}: {
  config: CardConfig;
  value: StatValue;
  currency: string;
}): React.ReactElement {
  const Icon = config.icon;
  const isHighlighted = config.highlightOnNonZero && value.count > 0;

  return (
    <Card
      className={cn(
        "transition-colors",
        isHighlighted && "border-destructive bg-destructive/5"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg bg-muted",
              isHighlighted && "bg-destructive/10"
            )}
          >
            <Icon
              className={cn("h-5 w-5", config.iconClass)}
              aria-hidden="true"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {config.label}
            </p>
            <p
              className={cn(
                "text-xl font-semibold truncate",
                isHighlighted && "text-destructive"
              )}
            >
              {formatCurrency(value.amountCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              {value.count} {value.count === 1 ? "payment" : "payments"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * PaymentStatsCards displays payment statistics in a responsive 4-card grid.
 *
 * Layout:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Desktop: 4 columns
 *
 * @example
 * <PaymentStatsCards
 *   stats={statsData}
 *   currency="EUR"
 *   isLoading={false}
 * />
 */
export function PaymentStatsCards({
  stats,
  currency = "EUR",
  isLoading = false,
  className,
}: PaymentStatsCardsProps): React.ReactElement {
  // Loading state
  if (isLoading || !stats) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
          className
        )}
        aria-busy="true"
        aria-label="Loading payment statistics"
      >
        {cardConfigs.map((config) => (
          <StatCardSkeleton key={config.key} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
      role="region"
      aria-label="Payment statistics"
    >
      {cardConfigs.map((config) => (
        <StatCard
          key={config.key}
          config={config}
          value={stats[config.key]}
          currency={currency}
        />
      ))}
    </div>
  );
}
