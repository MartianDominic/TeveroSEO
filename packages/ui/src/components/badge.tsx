import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  // Base styles - v6 pill/badge
  cn(
    "inline-flex items-center gap-1.5",
    "rounded-[var(--radius-pill)]",
    "px-[11px] py-[5px]",
    "text-[12px] font-medium",
    "tracking-[0.06em]",
    "[font-variant-caps:all-small-caps]", // OpenType small caps
    "transition-colors duration-[160ms]"
  ),
  {
    variants: {
      variant: {
        // Default: accent
        default: cn(
          "bg-accent-soft text-accent",
          "shadow-[0_0_0_1px_rgba(15,79,61,0.12)]"
        ),
        // Success: green
        success: cn(
          "bg-success-soft text-success",
          "shadow-[0_0_0_1px_rgba(27,110,69,0.12)]"
        ),
        // Warning: amber
        warning: cn(
          "bg-warning-soft text-warning",
          "shadow-[0_0_0_1px_rgba(168,127,26,0.12)]"
        ),
        // Error: red
        error: cn(
          "bg-error-soft text-error",
          "shadow-[0_0_0_1px_rgba(155,44,44,0.12)]"
        ),
        // Info: blue
        info: cn(
          "bg-info-soft text-info",
          "shadow-[0_0_0_1px_rgba(45,90,135,0.12)]"
        ),
        // Muted: neutral
        muted: cn(
          "bg-surface-2 text-text-2",
          "shadow-[0_0_0_1px_var(--hairline)]"
        ),
        // Outline: border only
        outline: cn(
          "bg-transparent text-text-2",
          "border border-hairline"
        ),
        // Secondary (for backwards compatibility)
        secondary: cn(
          "bg-surface-2 text-text-2",
          "shadow-[0_0_0_1px_var(--hairline)]"
        ),
        // Destructive (for backwards compatibility)
        destructive: cn(
          "bg-error-soft text-error",
          "shadow-[0_0_0_1px_rgba(155,44,44,0.12)]"
        ),
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional leading dot indicator */
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "error" && "bg-error",
            variant === "destructive" && "bg-error",
            variant === "info" && "bg-info",
            variant === "default" && "bg-accent",
            variant === "muted" && "bg-text-3",
            variant === "secondary" && "bg-text-3",
            (!variant || variant === "outline") && "bg-text-3"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
