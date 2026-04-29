"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { Button } from "./button";

const emptyStateVariants = cva(
  "flex flex-col items-center justify-center text-center py-[var(--space-8)] px-[var(--space-6)]",
  {
    variants: {
      variant: {
        default: "",
        search: "",
        "first-time": "",
        filtered: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
}

export interface EmptyStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyStateVariants> {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      variant,
      icon: Icon,
      title,
      description,
      action,
      secondaryAction,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(emptyStateVariants({ variant, className }))}
        {...props}
      >
        {Icon && (
          <div className="mb-[var(--space-5)]">
            <Icon className="h-12 w-12 text-[var(--text-3)]" />
          </div>
        )}

        <h3 className="font-display text-[var(--type-h3)] text-[var(--text-1)] mb-[var(--space-2)] tracking-[-0.005em]">
          {title}
        </h3>

        {description && (
          <p className="text-[var(--type-body)] text-[var(--text-2)] max-w-[320px] mb-[var(--space-5)] leading-[1.55]">
            {description}
          </p>
        )}

        {action && (
          <Button
            variant={action.variant === "ghost" ? "ghost" : "default"}
            onClick={action.onClick}
            className="bg-[var(--accent)] hover:bg-[var(--accent-2)] text-white"
          >
            {action.label}
          </Button>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="mt-[var(--space-3)] text-[var(--type-small)] text-[var(--accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 rounded"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState, emptyStateVariants };
