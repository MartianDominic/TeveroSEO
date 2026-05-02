"use client";

/**
 * Dashboard Skeleton Components
 * Phase 62-05: Command Center Dashboard Core
 *
 * Loading skeletons for dashboard widgets with matching dimensions.
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full dashboard skeleton showing all widget placeholders.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Today Action Bar skeleton */}
      <Skeleton className="h-16 w-full rounded-lg" />

      {/* Pipeline Health Cards skeleton - 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>

      {/* Bottom row - Revenue Pipeline and Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Single card skeleton for Pipeline Health Cards.
 */
export function CardSkeleton() {
  return <Skeleton className="h-40 rounded-lg" />;
}

/**
 * Chart skeleton for Revenue Pipeline and Funnel.
 */
export function ChartSkeleton() {
  return <Skeleton className="h-64 rounded-lg" />;
}

/**
 * Today Action Bar skeleton.
 */
export function TodayBarSkeleton() {
  return <Skeleton className="h-16 w-full rounded-lg" />;
}
