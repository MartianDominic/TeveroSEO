"use client";

/**
 * Toggle Group Component
 *
 * Based on Radix UI ToggleGroup primitive.
 */

import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

const ToggleGroupContext = React.createContext<{
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline";
}>({
  size: "default",
  variant: "default",
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
  }
>(({ className, variant = "default", size = "default", children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("flex items-center justify-center gap-1", className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const toggleGroupItemVariants = {
  base: "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
  variant: {
    default: "bg-transparent hover:bg-muted hover:text-muted-foreground",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
  },
  size: {
    default: "h-10 px-3",
    sm: "h-9 px-2.5",
    lg: "h-11 px-5",
  },
};

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
    variant?: "default" | "outline";
    size?: "default" | "sm" | "lg";
  }
>(({ className, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);
  const resolvedVariant = variant || context.variant || "default";
  const resolvedSize = size || context.size || "default";

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupItemVariants.base,
        toggleGroupItemVariants.variant[resolvedVariant],
        toggleGroupItemVariants.size[resolvedSize],
        className
      )}
      {...props}
    />
  );
});
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
