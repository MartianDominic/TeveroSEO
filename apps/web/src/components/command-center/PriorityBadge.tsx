/**
 * PriorityBadge Component
 * Phase 62-06: Needs Attention List
 *
 * Displays priority level with color-coded badge styling.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@tevero/ui";
import type { Priority } from "@/types/command-center";

const PRIORITY_STYLES: Record<Priority, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

export interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", PRIORITY_STYLES[priority], className)}
    >
      {priority}
    </Badge>
  );
}
