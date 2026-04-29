"use client";

import { useEffect } from "react";
import { Button } from "@tevero/ui";
import { AlertCircle, RotateCcw, Home } from "lucide-react";

/**
 * Error boundary for sign-up page.
 * Catches errors during the authentication flow.
 */
export default function SignUpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sign-up-error]", {
      digest: error.digest,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Unable to load sign up
          </h2>
          <p className="text-muted-foreground mt-2">
            We encountered an issue with the sign up page. Please try again or
            return to the home page.
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
        <div className="flex gap-3 mt-2">
          <Button onClick={reset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Try again
          </Button>
          <Button onClick={() => (window.location.href = "/")}>
            <Home className="h-4 w-4 mr-2" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
}
