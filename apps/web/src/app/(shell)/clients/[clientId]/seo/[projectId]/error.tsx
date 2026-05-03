'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tevero/ui';

import { logger } from '@/lib/logger';
export default function SEOProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log to error reporting service
    logger.error('[seo-project] Error', { error: error.digest || error.message });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Unable to load SEO project</h2>
      <p className="text-muted-foreground text-center max-w-md">
        We encountered an issue loading this project. The project may have been deleted or you may not have access.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          Go back
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
