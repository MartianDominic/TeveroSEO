"use client";

import { useEffect } from "react";

// SECURITY: Never expose raw error messages to users in production
const USER_FRIENDLY_MESSAGE = "Something went wrong. Please try again.";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error details for debugging/monitoring
    // In production, send to error tracking service (Sentry, etc.)
    console.error("[global-error]", {
      digest: error.digest,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <h2 className="text-xl font-semibold">Something went wrong!</h2>
        <p className="text-muted-foreground mt-2">{USER_FRIENDLY_MESSAGE}</p>
        {error.digest && (
          <p className="text-muted-foreground text-xs mt-1">
            Error ID: {error.digest}
          </p>
        )}
        {process.env.NODE_ENV === "development" && (
          <pre className="text-xs text-muted-foreground mt-2 max-w-md overflow-auto p-2 bg-gray-100 dark:bg-gray-800 rounded">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
