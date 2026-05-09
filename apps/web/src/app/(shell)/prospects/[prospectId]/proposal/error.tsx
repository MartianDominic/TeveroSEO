"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { AlertCircle, RotateCcw, ArrowLeft } from "lucide-react";

import { logger } from '@/lib/logger';

import { Button } from "@tevero/ui";
export default function ProposalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    logger.error("[proposal-error]", {
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
            Unable to load proposal
          </h2>
          <p className="text-muted-foreground mt-2">
            We encountered an issue loading the proposal. Please try again.
          </p>
          {error.digest && (
            <p className="text-muted-foreground text-xs-safe mt-1">
              Error ID: {error.digest}
            </p>
          )}
          {process.env.NODE_ENV === "development" && (
            <pre className="text-xs-safe text-muted-foreground mt-2 overflow-auto p-2 bg-muted rounded text-left">
              {error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => router.back()}>
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
