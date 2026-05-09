'use client';

import { useEffect } from 'react';

import { useParams, useRouter } from 'next/navigation';

import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';

import { logger } from '@/lib/logger';

import { Button } from '@tevero/ui';
export default function BrandingError({
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
    logger.error('[BrandingError]', {
      digest: error.digest,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">Unable to load branding settings</h2>
      <p className="text-muted-foreground text-center max-w-md">
        We encountered an error loading the branding settings. Please try again.
      </p>
      {error.digest && (
        <p className="text-muted-foreground text-xs-safe">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3 mt-2">
        {clientId && (
          <Button variant="outline" onClick={() => router.push(`/clients/${clientId}/settings` as Parameters<typeof router.push>[0])}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to settings
          </Button>
        )}
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  );
}
