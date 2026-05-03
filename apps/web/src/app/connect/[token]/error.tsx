'use client';

import { useEffect } from 'react';
import { Button } from '@tevero/ui';

import { logger } from '@/lib/logger';
export default function ConnectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service
    logger.error('[connect] Error', { error: error.digest || error.message });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
      <h2 className="text-xl font-semibold">Connection failed</h2>
      <p className="text-muted-foreground text-center max-w-md">
        We were unable to complete your connection request. The link may have expired or is no longer valid.
      </p>
      <p className="text-sm text-muted-foreground">
        Please contact the person who sent you this link for assistance.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
