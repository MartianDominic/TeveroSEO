"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@tevero/ui";
import { AlertCircle, RotateCcw } from "lucide-react";

import { logger } from "@/lib/logger";

const USER_FRIENDLY_MESSAGE = "Something went wrong. Please try again.";
const isDev = process.env.NODE_ENV === "development";

export default function ContractDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      extra: { digest: error.digest },
      tags: { errorType: "contract-detail-error" },
    });

    if (isDev) {
      logger.error("[contract-detail-error]", {
        digest: error.digest,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="text-muted-foreground mt-2">{USER_FRIENDLY_MESSAGE}</p>
          {error.digest && (
            <p className="text-muted-foreground text-xs mt-1">
              Error ID: {error.digest}
            </p>
          )}
          {isDev && (
            <pre className="text-xs text-muted-foreground mt-2 overflow-auto p-2 bg-muted rounded text-left">
              {error.message}
            </pre>
          )}
        </div>
        <Button onClick={reset} variant="outline" className="mt-2">
          <RotateCcw className="h-4 w-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  );
}
