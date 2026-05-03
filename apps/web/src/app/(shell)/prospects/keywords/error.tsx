'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@tevero/ui';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

import { logger } from '@/lib/logger';
export default function KeywordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logger.error('[KeywordsError]', {
      digest: error.digest,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <AlertTriangle className="h-12 w-12 text-error" />
      <h2 className="text-xl font-semibold">Unable to load keywords</h2>
      <p className="text-text-3 text-center max-w-md">
        We encountered an error loading the keywords section. Please try again.
      </p>
      {error.digest && (
        <p className="text-text-3 text-[12px]">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={() => router.push('/prospects' as Parameters<typeof router.push>[0])}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to prospects
        </Button>
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  );
}
