'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tevero/ui';

export default function ProspectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log to error reporting service
    console.error('[prospect] Error:', error.digest || error.message);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Unable to load prospect</h2>
      <p className="text-muted-foreground text-center max-w-md">
        We encountered an issue loading this prospect. It may have been removed or you may not have access.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.push('/prospects' as Parameters<typeof router.push>[0])}>
          Return to prospects
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
