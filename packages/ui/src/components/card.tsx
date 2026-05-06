import * as React from "react";

import { cn } from "../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Disable hover lift effect for non-interactive cards */
  noHover?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, noHover = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Base v6 card styles - ghost-edge shadows, no border
        "bg-surface rounded-[var(--radius-card)]",
        "shadow-[var(--shadow-card)]",
        // Hover effect (unless noHover)
        !noHover && [
          "hover:shadow-[var(--shadow-lift)]",
          "hover:-translate-y-px",
        ],
        // Motion
        "transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

// CardHeader with v6 styling
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-7 py-[18px] flex items-center gap-3",
      "border-b border-hairline-2",
      className
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// CardTitle with v6 typography
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "font-sans text-[15px] font-medium text-text-1",
      "tracking-[-0.005em]",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// CardDescription
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-[13px] text-text-3", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// CardContent with v6 padding
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-7 py-6", className)}
    {...props}
  />
));
CardContent.displayName = "CardContent";

// CardFooter with v6 styling (surface-2 background)
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-7 py-3 bg-surface-2",
      "border-t border-hairline-2",
      "text-[13px] text-text-3",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
