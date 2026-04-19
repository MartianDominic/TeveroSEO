"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button, Badge, cn } from "@tevero/ui";

interface AlertBadgeProps {
  count: number;
  hasCritical?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AlertBadge({ count, hasCritical, onClick, className }: AlertBadgeProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (hasCritical && count > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCritical, count]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={cn("relative", className)}
      aria-label={`${count} alerts`}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <Badge
          variant="destructive"
          className={cn(
            "absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs",
            pulse && "animate-pulse",
          )}
        >
          {count > 99 ? "99+" : count}
        </Badge>
      )}
      {count === 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
      )}
    </Button>
  );
}
