'use client';

import { useEffect } from 'react';
import { Button } from '@tevero/ui';
import { logError } from '@/lib/errors';

/**
 * Error boundary for client pages.
 * Catches errors in the client route segment and displays a user-friendly error UI.
 *
 * This file is automatically used by Next.js as an error boundary for the
 * /clients/[clientId] route and all its children.
 */
export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error with context for monitoring
    logError('ClientPageError', error, {
      digest: error.digest,
      page: 'clients/[clientId]',
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h2 className="text-xl font-semibold mb-4">Unable to load client</h2>
      <p className="text-muted-foreground mb-4 text-center max-w-md">
        We encountered an issue loading this client. Please try again or contact support if the problem persists.
      </p>
      <div className="flex gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.href = '/clients'}>
          Back to clients
        </Button>
      </div>
    </div>
  );
}
