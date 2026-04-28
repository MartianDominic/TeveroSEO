'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@tevero/ui';

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
    // Log to error reporting service
    console.error('[articles] Error:', error.digest || error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Unable to load articles</h2>
      <p className="text-muted-foreground text-center max-w-md">
        We encountered an issue loading the articles section. Please try again or return to the client dashboard.
      </p>
      <div className="flex gap-3">
        {clientId && (
          <Button variant="outline" onClick={() => router.push(`/clients/${clientId}` as Parameters<typeof router.push>[0])}>
            Return to client
          </Button>
        )}
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
