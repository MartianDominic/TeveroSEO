'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from './error-boundary';

import { logger } from '@/lib/logger';
interface WithErrorBoundaryProps {
  children: ReactNode;
  name: string;
  fallback?: ReactNode;
}

/**
 * Wrapper component for easier ErrorBoundary usage.
 * Provides a named error boundary with optional custom fallback.
 *
 * Usage:
 * ```tsx
 * <WithErrorBoundary name="DashboardWidget">
 *   <DashboardWidget />
 * </WithErrorBoundary>
 * ```
 */
export function WithErrorBoundary({
  children,
  name,
  fallback,
}: WithErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error, errorInfo) => {
        logger.error(`[${name}] Error`, error instanceof Error ? error : { error: String(error) });
        console.error(`[${name}] Component Stack:`, errorInfo.componentStack);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
