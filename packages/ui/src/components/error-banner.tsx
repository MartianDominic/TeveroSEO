"use client";

import * as React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

interface ErrorBannerProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBanner({
  message = "Something went wrong. Please try again.",
  onRetry,
  className,
}: ErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-destructive">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
