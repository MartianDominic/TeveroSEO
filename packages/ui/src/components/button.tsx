"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  // Base styles
  cn(
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap font-medium",
    "rounded-[var(--radius-button)]",
    "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
  ),
  {
    variants: {
      variant: {
        // Default: white card-like button with v6 shadow
        default: cn(
          "bg-surface text-text-1",
          "shadow-[var(--shadow-card)]",
          "hover:shadow-[var(--shadow-pop)] hover:-translate-y-px"
        ),
        // Primary: accent gradient with CTA shadow
        primary: cn(
          "bg-gradient-to-b from-[#1A6E55] to-[#0F4F3D]",
          "text-white",
          "shadow-[var(--shadow-cta)]",
          "hover:shadow-[var(--shadow-cta-hover)] hover:-translate-y-px"
        ),
        // Destructive
        destructive: cn(
          "bg-error text-white",
          "shadow-[0_1px_2px_rgba(155,44,44,0.24)]",
          "hover:bg-error/90 hover:-translate-y-px"
        ),
        // Ghost: transparent with hairline border
        ghost: cn(
          "bg-transparent text-text-2",
          "border border-hairline",
          "hover:bg-surface-2 hover:border-text-4 hover:text-text-1"
        ),
        // Outline: similar to ghost but with more visible border
        outline: cn(
          "bg-transparent text-text-2",
          "border border-hairline",
          "hover:bg-surface-2 hover:text-text-1"
        ),
        // Secondary: subtle background
        secondary: cn(
          "bg-surface-2 text-text-2",
          "hover:bg-surface-3 hover:text-text-1"
        ),
        // Link
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-[34px] px-4 text-[14px]",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-10 px-6 text-[14px]",
        icon: cn(
          "h-8 w-8 p-0",
          "shadow-[var(--shadow-card)]",
          "hover:shadow-[var(--shadow-pop)] hover:-translate-y-px"
        ),
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
