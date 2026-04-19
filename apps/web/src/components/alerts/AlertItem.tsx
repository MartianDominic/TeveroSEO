"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, AlertCircle, Info, Check, X } from "lucide-react";
import { Button, Badge, cn } from "@tevero/ui";
import type { Alert } from "@/actions/alerts";

interface AlertItemProps {
  alert: Alert;
  onAcknowledge?: (id: string) => void;
  onDismiss?: (id: string) => void;
  compact?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50",
    badge: "destructive" as const,
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-50",
    badge: "outline" as const,
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50",
    badge: "secondary" as const,
  },
};

export function AlertItem({ alert, onAcknowledge, onDismiss, compact }: AlertItemProps) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        alert.status === "pending" ? config.bg : "bg-muted/30",
        alert.status === "pending" ? "border-transparent" : "border-border/50",
      )}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={config.badge} className="text-xs">
            {alert.severity}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </span>
        </div>
        <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
          {alert.title}
        </p>
        {!compact && (
          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
        )}
      </div>
      {alert.status === "pending" && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onAcknowledge && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onAcknowledge(alert.id)}
              title="Acknowledge"
            >
              <Check className="h-4 w-4" />
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDismiss(alert.id)}
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
