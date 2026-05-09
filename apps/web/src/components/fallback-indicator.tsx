'use client';

import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '@tevero/ui';

export interface FallbackIndicatorProps {
  /** Type of fallback being shown */
  type?: 'cached' | 'empty' | 'partial' | 'offline';
  /** Custom message to display */
  message?: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
}

const defaultMessages: Record<NonNullable<FallbackIndicatorProps['type']>, string> = {
  cached: 'Showing cached data. Some information may be outdated.',
  empty: 'No data available yet.',
  partial: 'Some data could not be loaded.',
  offline: 'You appear to be offline. Showing cached data.',
};

const icons: Record<NonNullable<FallbackIndicatorProps['type']>, typeof AlertCircle> = {
  cached: AlertCircle,
  empty: AlertCircle,
  partial: AlertCircle,
  offline: WifiOff,
};

/**
 * Visual indicator shown when displaying fallback/degraded data.
 *
 * Use this to inform users when:
 * - Cached data is being shown instead of live data
 * - Some parts of the data failed to load
 * - The user is offline and seeing cached content
 * - No data is available yet
 *
 * Usage:
 * ```tsx
 * // When showing cached data
 * {isUsingCache && <FallbackIndicator type="cached" onRetry={refetch} />}
 *
 * // When some data failed to load
 * {hasPartialData && <FallbackIndicator type="partial" />}
 *
 * // With custom message
 * <FallbackIndicator message="Unable to load recent activity" onRetry={refetch} />
 * ```
 */
export function FallbackIndicator({
  type = 'partial',
  message,
  onRetry,
  className,
  size = 'md',
}: FallbackIndicatorProps) {
  const Icon = icons[type];
  const displayMessage = message || defaultMessages[type];

  const isSmall = size === 'sm';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-200',
        isSmall ? 'px-2 py-1' : 'px-3 py-2',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn('flex-shrink-0', isSmall ? 'h-3 w-3' : 'h-4 w-4')} />
      <span className={cn('flex-1', isSmall ? 'text-xs-safe' : 'text-sm')}>
        {displayMessage}
      </span>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1 text-yellow-800 hover:bg-yellow-100 hover:text-yellow-900 dark:text-yellow-200 dark:hover:bg-yellow-900 dark:hover:text-yellow-100',
            isSmall ? 'h-5 px-1 text-xs-safe' : 'h-7 px-2 text-sm'
          )}
        >
          <RefreshCw className={cn(isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          Retry
        </Button>
      )}
    </div>
  );
}

/**
 * Inline fallback indicator for use within data displays.
 * Shows a subtle indicator that data may be stale or unavailable.
 */
export function InlineFallbackIndicator({
  message = 'Data unavailable',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs-safe text-muted-foreground italic',
        className
      )}
      title={message}
    >
      <AlertCircle className="h-3 w-3" />
      {message}
    </span>
  );
}
