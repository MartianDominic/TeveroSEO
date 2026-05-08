/**
 * ChartSkeleton
 * Phase UI-05: Loading skeleton for chart components
 *
 * Displays animated skeleton placeholders while chart data loads.
 * Supports multiple chart type variants for accurate visual matching.
 */
import { Skeleton } from '@/client/components/ui/skeleton';
import { cn } from '@/client/lib/utils';

export type ChartSkeletonVariant = 'line' | 'bar' | 'pie' | 'area' | 'composed';

interface ChartSkeletonProps {
  /** Type of chart skeleton to display */
  variant?: ChartSkeletonVariant;
  /** Height in pixels */
  height?: number;
  /** Additional class names */
  className?: string;
  /** Show axis labels skeleton */
  showAxis?: boolean;
  /** Show legend skeleton */
  showLegend?: boolean;
}

/**
 * Deterministic height generator for skeleton bars
 * Uses index to create consistent but varied heights
 */
function getBarHeight(index: number, count: number): number {
  const heights = [65, 45, 80, 55, 70, 40, 75, 50, 60, 85, 48, 72];
  return heights[index % heights.length];
}

export function ChartSkeleton({
  variant = 'line',
  height = 300,
  className,
  showAxis = true,
  showLegend = false,
}: ChartSkeletonProps) {
  return (
    <div
      className={cn('relative w-full', className)}
      style={{ height }}
      role="progressbar"
      aria-label="Loading chart"
      aria-busy="true"
    >
      {/* Legend skeleton */}
      {showLegend && (
        <div className="mb-4 flex items-center justify-center gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      <div className="flex h-full">
        {/* Y-axis skeleton */}
        {showAxis && (
          <div className="flex w-10 flex-col items-end justify-between py-4 pr-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-8" />
            ))}
          </div>
        )}

        {/* Chart area */}
        <div className="flex-1 p-4">
          {variant === 'line' && <LineChartSkeleton />}
          {variant === 'bar' && <BarChartSkeleton />}
          {variant === 'pie' && <PieChartSkeleton />}
          {variant === 'area' && <AreaChartSkeleton />}
          {variant === 'composed' && <ComposedChartSkeleton />}
        </div>
      </div>

      {/* X-axis skeleton */}
      {showAxis && (
        <div className="ml-10 flex justify-between px-4 pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-10" />
          ))}
        </div>
      )}
    </div>
  );
}

function LineChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col items-center">
          <Skeleton
            className="w-full rounded-sm"
            style={{ height: `${getBarHeight(i, 12)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function BarChartSkeleton() {
  return (
    <div className="flex h-full items-end justify-around gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-12 rounded-t-sm"
          style={{ height: `${getBarHeight(i, 6)}%` }}
        />
      ))}
    </div>
  );
}

function PieChartSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative">
        <Skeleton className="h-48 w-48 rounded-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 rounded-full bg-background" />
        </div>
      </div>
    </div>
  );
}

function AreaChartSkeleton() {
  return (
    <div className="relative flex h-full items-end gap-0.5">
      {Array.from({ length: 16 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-none rounded-t-sm opacity-60"
          style={{ height: `${getBarHeight(i, 16)}%` }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-background/80" />
    </div>
  );
}

function ComposedChartSkeleton() {
  return (
    <div className="relative flex h-full items-end gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton
            className="w-full rounded-t-sm"
            style={{ height: `${getBarHeight(i, 8)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export default ChartSkeleton;
