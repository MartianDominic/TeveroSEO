"use client";

import * as React from "react";
import { cn } from "../lib/utils";
import { CardActionMenu, type CardAction } from "./card-action-menu";
import type { StatusConfig } from "../lib/status-config";

/**
 * Avatar configuration for EntityCard
 */
export interface EntityCardAvatar {
  type: "initials" | "image" | "icon";
  value: string | React.ReactNode;
  color?: string;
}

/**
 * Props for EntityCard component
 */
export interface EntityCardProps {
  avatar?: EntityCardAvatar;
  title: string;
  subtitle?: string;
  description?: string;
  status?: {
    key: string;
    config: StatusConfig;
  };
  meta?: React.ReactNode;
  actions?: CardAction[];
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * A generic entity display card with avatar, title, subtitle, status, and actions.
 * Uses v6 design tokens for consistent styling.
 */
export function EntityCard({
  avatar,
  title,
  subtitle,
  description,
  status,
  meta,
  actions,
  selected = false,
  onClick,
  className,
}: EntityCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        // Base card styles with v6 tokens
        "relative bg-surface rounded-[var(--radius-card)] shadow-card",
        "p-[var(--space-5)]",
        // Transition for hover effects
        "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        // Hover state
        "hover:shadow-lift hover:-translate-y-px",
        // Selection ring
        selected && "ring-2 ring-accent",
        // Clickable state
        isClickable && "cursor-pointer",
        // Group for hover reveal
        "group",
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Actions menu - hidden at rest, shown on hover */}
      {actions && actions.length > 0 && (
        <div
          className={cn(
            "absolute top-[var(--space-3)] right-[var(--space-3)]",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-[240ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
          )}
        >
          <CardActionMenu actions={actions} />
        </div>
      )}

      <div className="flex items-start gap-[var(--space-4)]">
        {/* Avatar section */}
        {avatar && (
          <div
            className={cn(
              "flex-shrink-0 flex items-center justify-center",
              "w-10 h-10 rounded-full",
              "text-sm font-medium"
            )}
            style={
              avatar.type === "initials"
                ? { backgroundColor: avatar.color || "var(--accent-soft)" }
                : undefined
            }
          >
            {avatar.type === "initials" && (
              <span
                className="text-accent"
                style={avatar.color ? { color: "var(--text-1)" } : undefined}
              >
                {typeof avatar.value === "string"
                  ? avatar.value.slice(0, 2).toUpperCase()
                  : avatar.value}
              </span>
            )}
            {avatar.type === "image" && typeof avatar.value === "string" && (
              <img
                src={avatar.value}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            )}
            {avatar.type === "icon" && (
              <span className="text-text-2">{avatar.value}</span>
            )}
          </div>
        )}

        {/* Content section */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3
            className={cn(
              "text-[length:var(--type-h3)] font-medium leading-[1.4]",
              "text-text-1 truncate"
            )}
          >
            {title}
          </h3>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-[length:var(--type-small)] text-text-2 mt-0.5 truncate">
              {subtitle}
            </p>
          )}

          {/* Description */}
          {description && (
            <p className="text-[length:var(--type-small)] text-text-3 mt-1 line-clamp-2">
              {description}
            </p>
          )}

          {/* Status pill */}
          {status && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5",
                  "rounded-[var(--radius-pill)]",
                  "text-[length:var(--type-tiny)] font-medium",
                  "tracking-[0.06em] [font-variant-caps:all-small-caps]",
                  status.config.bgColor,
                  status.config.textColor
                )}
              >
                {status.config.pulse && (
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      status.config.color
                    )}
                  />
                )}
                {status.config.label}
              </span>
            </div>
          )}

          {/* Meta slot */}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
      </div>
    </div>
  );
}

EntityCard.displayName = "EntityCard";
