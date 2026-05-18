'use client';

/**
 * SEO Chat Error Boundary
 * Phase 98: Error recovery UI for SEO Chat route
 *
 * Catches unhandled errors in the SEO Chat route tree and displays
 * a user-friendly recovery interface instead of crashing.
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface SeoChatErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SeoChatError({ error, reset }: SeoChatErrorProps) {
  useEffect(() => {
    // Log error for debugging/monitoring
    console.error('SEO Chat error:', error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md px-4">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground mb-6">
          We encountered an error loading SEO Chat. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
