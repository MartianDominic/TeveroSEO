"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";

const errorStateVariants = cva("", {
  variants: {
    variant: {
      inline:
        "flex items-center gap-3 p-3 bg-[var(--error-soft)] text-[var(--error)] border border-[rgba(155,44,44,0.2)] rounded-[var(--radius-input)]",
      card: "flex flex-col items-center justify-center text-center py-[var(--space-6)] px-[var(--space-5)] bg-[var(--surface)]",
      fullPage:
        "flex flex-col items-center justify-center text-center min-h-[400px] py-[var(--space-8)] px-[var(--space-6)]",
    },
  },
  defaultVariants: {
    variant: "card",
  },
});

export interface ErrorStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof errorStateVariants> {
  title?: string;
  message: string;
  errorCode?: string;
  retryLabel?: string;
  onRetry?: () => void;
  reportLabel?: string;
  onReport?: () => void;
}

const DEFAULT_TITLES: Record<string, string> = {
  card: "Something went wrong",
  fullPage: "We hit a snag",
};

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      variant = "card",
      title,
      message,
      errorCode,
      retryLabel = "Try again",
      onRetry,
      reportLabel = "Report issue",
      onReport,
      ...props
    },
    ref
  ) => {
    const displayTitle = title ?? DEFAULT_TITLES[variant ?? "card"];

    if (variant === "inline") {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(errorStateVariants({ variant, className }))}
          {...props}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-[var(--type-body)] leading-[1.55]">
            {message}
          </span>
        </div>
      );
    }

    if (variant === "fullPage") {
      return (
        <div
          ref={ref}
          role="alert"
          className={cn(errorStateVariants({ variant, className }))}
          {...props}
        >
          <AlertTriangle className="h-16 w-16 text-[var(--error)] mb-[var(--space-5)]" />

          <h2 className="font-display text-[var(--type-h2)] text-[var(--text-1)] mb-[var(--space-2)] tracking-[-0.012em]">
            {displayTitle}
          </h2>

          <p className="text-[var(--type-body)] text-[var(--text-2)] max-w-md mb-[var(--space-3)] leading-[1.55]">
            {message}
          </p>

          {errorCode && (
            <p className="text-[var(--type-tiny)] font-mono text-[var(--text-3)] mb-[var(--space-5)]">
              Error code: {errorCode}
            </p>
          )}

          <div className="flex items-center gap-[var(--space-3)]">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="bg-[var(--accent)] hover:bg-[var(--accent-2)] text-white"
              >
                {retryLabel}
              </Button>
            )}

            {onReport && (
              <button
                type="button"
                onClick={onReport}
                className="text-[var(--type-small)] text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded"
              >
                {reportLabel}
              </button>
            )}
          </div>
        </div>
      );
    }

    // card variant (default)
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(errorStateVariants({ variant, className }))}
        {...props}
      >
        <AlertTriangle className="h-10 w-10 text-[var(--error)] mb-[var(--space-4)]" />

        <h3 className="font-display text-[var(--type-h3)] text-[var(--text-1)] mb-[var(--space-2)] tracking-[-0.005em]">
          {displayTitle}
        </h3>

        <p className="text-[var(--type-body)] text-[var(--text-2)] max-w-[280px] mb-[var(--space-4)] leading-[1.55]">
          {message}
        </p>

        {errorCode && (
          <p className="text-[var(--type-tiny)] font-mono text-[var(--text-3)] mb-[var(--space-4)]">
            {errorCode}
          </p>
        )}

        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="bg-[var(--accent)] hover:bg-[var(--accent-2)] text-white"
          >
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }
);
ErrorState.displayName = "ErrorState";

export { ErrorState, errorStateVariants };
