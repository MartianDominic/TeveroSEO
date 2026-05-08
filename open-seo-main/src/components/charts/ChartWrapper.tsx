/**
 * ChartWrapper
 * Phase UI-04/05/06: Combined wrapper for chart components
 *
 * Provides:
 * - Error boundary with retry functionality
 * - Loading state with skeleton placeholder
 * - Empty state handling with customizable message
 * - Consistent styling and accessibility
 */
import { Suspense, type ReactNode } from 'react';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { ChartSkeleton, type ChartSkeletonVariant } from './ChartSkeleton';
import { Card } from '@/client/components/ui/card';
import { cn } from '@/client/lib/utils';
import { BarChart3 } from 'lucide-react';

interface ChartWrapperProps {
  children: ReactNode;
  /** Loading state - shows skeleton when true */
  isLoading?: boolean;
  /** Empty state - shows message when true */
  isEmpty?: boolean;
  /** Message to display when data is empty */
  emptyMessage?: string;
  /** Chart type for skeleton variant */
  variant?: ChartSkeletonVariant;
  /** Chart height in pixels */
  height?: number;
  /** Additional class names for the wrapper */
  className?: string;
  /** Show axis in skeleton */
  showAxis?: boolean;
  /** Show legend in skeleton */
  showLegend?: boolean;
  /** Called when chart error retry is clicked */
  onRetry?: () => void;
  /** Called when an error is caught */
  onError?: (error: Error) => void;
}

export function ChartWrapper({
  children,
  isLoading = false,
  isEmpty = false,
  emptyMessage = 'No data available',
  variant = 'line',
  height = 300,
  className,
  showAxis = true,
  showLegend = false,
  onRetry,
  onError,
}: ChartWrapperProps) {
  // Loading state
  if (isLoading) {
    return (
      <ChartSkeleton
        variant={variant}
        height={height}
        className={className}
        showAxis={showAxis}
        showLegend={showLegend}
      />
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <Card
        className={cn(
          'flex flex-col items-center justify-center gap-3 border-dashed bg-muted/30 text-muted-foreground',
          className
        )}
        style={{ height }}
      >
        <div className="rounded-full bg-muted p-3">
          <BarChart3 className="h-6 w-6" />
        </div>
        <p className="text-sm">{emptyMessage}</p>
      </Card>
    );
  }

  // Wrapped chart with error boundary
  return (
    <ChartErrorBoundary
      fallbackHeight={height}
      onError={onError ? (error) => onError(error) : undefined}
      fallback={
        onRetry
          ? (error, retry) => (
              <Card
                className={cn(
                  'flex flex-col items-center justify-center gap-4 border-dashed bg-muted/30 p-6',
                  className
                )}
                style={{ minHeight: height }}
              >
                <div className="rounded-full bg-muted p-3">
                  <BarChart3 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Failed to render chart
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error.message || 'An unexpected error occurred'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    retry();
                    onRetry();
                  }}
                  className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                >
                  Retry
                </button>
              </Card>
            )
          : undefined
      }
    >
      <Suspense
        fallback={
          <ChartSkeleton
            variant={variant}
            height={height}
            className={className}
            showAxis={showAxis}
            showLegend={showLegend}
          />
        }
      >
        <div className={className}>{children}</div>
      </Suspense>
    </ChartErrorBoundary>
  );
}

export default ChartWrapper;
