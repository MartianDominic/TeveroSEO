"use client";

import { useEffect } from "react";
import { Button } from "@tevero/ui";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ProspectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[prospects-error]", {
      digest: error.digest,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Unable to load prospects
          </h2>
          <p className="text-muted-foreground mt-2">
            We encountered an issue loading your prospects. Please try again.
          </p>
          {error.digest && (
            <p className="text-muted-foreground text-xs mt-1">
              Error ID: {error.digest}
            </p>
          )}
          {process.env.NODE_ENV === "development" && (
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
