'use client';

import { useEffect } from 'react';

import Link from 'next/link';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RefreshCw, ArrowLeft, Home } from 'lucide-react';

import { getUserFriendlyError } from '@/lib/errors';
import { logger } from '@/lib/logger';

import { Button } from '@tevero/ui';

// SECURITY: Never expose raw error messages to users in production
const isDev = process.env.NODE_ENV === 'development';

export interface PageErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Page title to show in error message */
  pageTitle?: string;
  /** Route segment for Sentry tags */
  pageRoute?: string;
  /** Optional back link URL */
  backHref?: string;
  /** Optional back link label */
  backLabel?: string;
  /** Show home button */
  showHomeButton?: boolean;
}

/**
 * Shared error boundary component for Next.js page error.tsx files.
 * Integrates with Sentry for production error tracking.
 * Only shows detailed error messages in development.
 *
 * Usage in error.tsx:
 * ```tsx
 * 'use client';
 * import { PageErrorBoundary } from '@/components/page-error-boundary';
 *
 * export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
 *   return (
 *     <PageErrorBoundary
 *       error={error}
 *       reset={reset}
 *       pageTitle="Onboarding"
 *       pageRoute="clients/[clientId]/onboarding"
 *       backHref="/clients"
 *       backLabel="Back to clients"
 *     />
 *   );
 * }
 * ```
 */
export function PageErrorBoundary({
  error,
  reset,
  pageTitle = 'This page',
  pageRoute = 'unknown',
  backHref,
  backLabel = 'Go back',
  showHomeButton = false,
}: PageErrorBoundaryProps) {
  const userMessage = getUserFriendlyError(error);

  useEffect(() => {
    // Send error to Sentry with context
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
      },
      tags: {
        errorType: 'page-error',
        page: pageRoute,
      },
    });

    // Log locally for development debugging only
    if (isDev) {
      logger.error(`[PageError:${pageRoute}]`, {
        digest: error.digest,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }, [error, pageRoute]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {pageTitle} failed to load
        </h2>
        <p className="text-muted-foreground mb-2">
          {isDev ? error.message : userMessage.description}
        </p>
        {userMessage.action && !isDev && (
          <p className="text-sm text-muted-foreground mb-4">
            {userMessage.action}
          </p>
        )}
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        {isDev && (
          <pre className="text-xs text-muted-foreground mb-4 max-w-md overflow-auto p-2 bg-muted rounded text-left">
            {error.stack || error.message}
          </pre>
        )}
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          {backHref && (
            <Button asChild variant="outline" className="gap-2">
              <Link href={backHref as Parameters<typeof Link>[0]['href']}>
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          )}
          {showHomeButton && (
            <Button asChild variant="outline" className="gap-2">
              <Link href={'/dashboard' as Parameters<typeof Link>[0]['href']}>
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Minimal error fallback for less critical sections.
 * Used for components that can fail without breaking the whole page.
 */
export function SectionErrorFallback({
  title = 'Unable to load this section',
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-6 border border-dashed border-muted-foreground/25 rounded-lg bg-muted/50">
      <AlertTriangle className="h-5 w-5 text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground text-center">{title}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="ghost" size="sm" className="mt-2 gap-1">
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}
