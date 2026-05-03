"use client";

import { useEffect } from "react";
import { Button } from "@tevero/ui";
import { AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";

import { logger } from '@/lib/logger';
/**
 * Error boundary for keyword import page.
 * Catches errors during CSV/bulk keyword import operations.
 */
export default function KeywordImportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[keyword-import-error]", {
      digest: error.digest,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-error" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Unable to import keywords
          </h2>
          <p className="text-text-3 mt-2">
            We encountered an issue importing your keywords. Please check your
            file format and try again.
          </p>
          {error.digest && (
            <p className="text-text-3 text-[12px] mt-1">
              Error ID: {error.digest}
            </p>
          )}
          {process.env.NODE_ENV === "development" && (
            <pre className="text-[12px] text-text-3 mt-2 overflow-auto p-2 bg-surface-2 rounded-[var(--radius-input)] text-left">
              {error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-3 mt-2">
          <Button onClick={() => window.history.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go back
          </Button>
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
