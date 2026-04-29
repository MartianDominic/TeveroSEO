"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/**
 * LoadingSkeleton - Loading placeholder with CSS opacity animation
 *
 * CRITICAL: Uses opacity animation, NOT animate-pulse (per design-system-v6.md)
 * Respects prefers-reduced-motion media query
 */

const skeletonBaseStyles = `
  bg-[var(--surface-3)]
  animate-[skeleton-shimmer_1.5s_cubic-bezier(0.16,1,0.3,1)_infinite]
  motion-reduce:animate-none
  motion-reduce:opacity-70
`;

const loadingSkeletonVariants = cva(skeletonBaseStyles, {
  variants: {
    variant: {
      text: "rounded-[var(--radius-input)]",
      card: "rounded-[var(--radius-card)] aspect-video",
      table: "rounded-[var(--radius-input)]",
      chart: "rounded-[var(--radius-card)]",
      avatar: "rounded-full",
      button: "rounded-[var(--radius-button)]",
    },
  },
  defaultVariants: {
    variant: "text",
  },
});

export interface LoadingSkeletonProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof loadingSkeletonVariants> {
  /** Number of text lines (for variant="text") */
  lines?: number;
  /** Number of table rows (for variant="table") */
  rows?: number;
  /** Custom width */
  width?: string | number;
  /** Custom height */
  height?: string | number;
}

// Text line width pattern for natural appearance
const TEXT_LINE_WIDTHS = ["100%", "90%", "75%", "60%", "85%"];

const LoadingSkeleton = React.forwardRef<HTMLDivElement, LoadingSkeletonProps>(
  (
    {
      className,
      variant = "text",
      lines = 1,
      rows = 3,
      width,
      height,
      style,
      ...props
    },
    ref
  ) => {
    const customStyle: React.CSSProperties = {
      ...style,
      ...(width !== undefined && {
        width: typeof width === "number" ? `${width}px` : width,
      }),
      ...(height !== undefined && {
        height: typeof height === "number" ? `${height}px` : height,
      }),
    };

    // Text variant: multiple lines with varying widths
    if (variant === "text" && lines > 1) {
      return (
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={cn(loadingSkeletonVariants({ variant: "text" }))}
              style={{
                width: TEXT_LINE_WIDTHS[i % TEXT_LINE_WIDTHS.length],
                height: height ?? "16px",
              }}
            />
          ))}
        </div>
      );
    }

    // Table variant: multiple rows
    if (variant === "table") {
      return (
        <div ref={ref} className={cn("space-y-2", className)} {...props}>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className={cn(loadingSkeletonVariants({ variant: "table" }))}
              style={{
                width: width ?? "100%",
                height: height ?? "40px",
              }}
            />
          ))}
        </div>
      );
    }

    // Avatar variant: default 40px circle
    if (variant === "avatar") {
      return (
        <div
          ref={ref}
          className={cn(loadingSkeletonVariants({ variant, className }))}
          style={{
            width: width ?? "40px",
            height: height ?? "40px",
            ...customStyle,
          }}
          {...props}
        />
      );
    }

    // Button variant: default 80x36
    if (variant === "button") {
      return (
        <div
          ref={ref}
          className={cn(loadingSkeletonVariants({ variant, className }))}
          style={{
            width: width ?? "80px",
            height: height ?? "36px",
            ...customStyle,
          }}
          {...props}
        />
      );
    }

    // Chart variant: rectangle with chart proportions
    if (variant === "chart") {
      return (
        <div
          ref={ref}
          className={cn(loadingSkeletonVariants({ variant, className }))}
          style={{
            width: width ?? "100%",
            height: height ?? "200px",
            ...customStyle,
          }}
          {...props}
        />
      );
    }

    // Card variant: 16:9 aspect ratio by default
    if (variant === "card") {
      return (
        <div
          ref={ref}
          className={cn(loadingSkeletonVariants({ variant, className }))}
          style={customStyle}
          {...props}
        />
      );
    }

    // Default text variant (single line)
    return (
      <div
        ref={ref}
        className={cn(loadingSkeletonVariants({ variant, className }))}
        style={{
          width: width ?? "100%",
          height: height ?? "16px",
          ...customStyle,
        }}
        {...props}
      />
    );
  }
);
LoadingSkeleton.displayName = "LoadingSkeleton";

export { LoadingSkeleton, loadingSkeletonVariants };
