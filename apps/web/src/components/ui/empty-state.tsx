"use client";

/**
 * EmptyState Component
 *
 * A consistent empty state pattern for use across features.
 * Provides visual feedback with icon, title, description, and action button.
 *
 * Phase 65: UX Dead End Fixes - MED-26
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@tevero/ui";

export interface EmptyStateProps {
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  /** Main heading text */
  title: string;
  /** Explanatory description */
  description?: string;
  /** Primary action - either button or link */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: "default" | "outline" | "secondary";
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Additional className for the container */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: {
    container: "py-8",
    iconWrapper: "w-12 h-12",
    icon: "h-6 w-6",
    title: "text-base",
    description: "text-sm",
  },
  md: {
    container: "py-12",
    iconWrapper: "w-16 h-16",
    icon: "h-8 w-8",
    title: "text-lg",
    description: "text-sm",
  },
  lg: {
    container: "py-16",
    iconWrapper: "w-20 h-20",
    icon: "h-10 w-10",
    title: "text-xl",
    description: "text-base",
  },
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  const renderAction = (
    actionConfig: NonNullable<EmptyStateProps["action"]>,
    isPrimary: boolean
  ) => {
    const variant = isPrimary
      ? actionConfig.variant ?? "default"
      : "outline";

    if (actionConfig.href) {
      return (
        <Button asChild variant={variant}>
          <a href={actionConfig.href}>{actionConfig.label}</a>
        </Button>
      );
    }

    return (
      <Button variant={variant} onClick={actionConfig.onClick}>
        {actionConfig.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        styles.container,
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted mb-4",
          styles.iconWrapper
        )}
      >
        <Icon className={cn("text-muted-foreground", styles.icon)} />
      </div>

      <h3 className={cn("font-semibold text-foreground mb-1", styles.title)}>
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-md mb-4",
            styles.description
          )}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {action && renderAction(action, true)}
          {secondaryAction &&
            renderAction(
              { ...secondaryAction, variant: "outline" },
              false
            )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
