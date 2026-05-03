'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@tevero/ui';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

import { logger } from '@/lib/logger';

// SECURITY: Never expose raw error messages to users in production
const isDev = process.env.NODE_ENV === 'development';

export default function ArticlesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.clientId as string | undefined;

  useEffect(() => {
    // Send error to Sentry with context
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
        clientId,
      },
      tags: {
        errorType: 'page-error',
        page: 'clients/[clientId]/articles',
      },
    });

    // Log locally for development debugging only
    if (isDev) {
      logger.error('[ArticlesError]', {
        digest: error.digest,
        message: error.message,
        clientId,
      });
    }
  }, [error, clientId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold">Unable to load articles</h2>
      <p className="text-muted-foreground text-center max-w-md">
        We encountered an issue loading the articles section. Please try again or return to the client dashboard.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Error ID: {error.digest}
        </p>
      )}
      {isDev && (
        <pre className="text-xs text-muted-foreground max-w-md overflow-auto p-2 bg-muted rounded">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        {clientId && (
          <Button variant="outline" onClick={() => router.push(`/clients/${clientId}` as Parameters<typeof router.push>[0])}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to client
          </Button>
        )}
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  );
}
