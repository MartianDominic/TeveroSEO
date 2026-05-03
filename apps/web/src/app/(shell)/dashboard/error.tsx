"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@tevero/ui";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { logger } from '@/lib/logger';

// SECURITY: Never expose raw error messages to users in production
const USER_FRIENDLY_MESSAGE = "An unexpected error occurred while loading the dashboard. Our team has been notified.";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send error to Sentry with context
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
      },
      tags: {
        errorType: "dashboard-error",
        page: "dashboard",
      },
    });

    // Log locally for development debugging only
    if (process.env.NODE_ENV === "development") {
      logger.error("[DashboardError] Dashboard failed to load", error instanceof Error ? error : { error: String(error) });
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Dashboard failed to load
        </h2>
        <p className="text-muted-foreground mb-6">
          {process.env.NODE_ENV === "development"
            ? (error.message || USER_FRIENDLY_MESSAGE)
            : USER_FRIENDLY_MESSAGE}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        {process.env.NODE_ENV === "development" && (
          <pre className="text-xs text-muted-foreground mb-4 max-w-md overflow-auto p-2 bg-muted rounded">
            {error.message}
          </pre>
        )}
        <Button onClick={reset} variant="default" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
