/**
 * StatusBadge component for prospects
 * Displays status with appropriate badge variant styling
 */
import { Badge } from "@/client/components/ui/badge";

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "secondary",
  analyzing: "outline",
  analyzed: "default",
  converted: "default",
  archived: "secondary",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANTS[status] ?? "secondary";
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
