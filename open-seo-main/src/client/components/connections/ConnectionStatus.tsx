/**
 * Connection Status Badge Component
 * Phase 31-04: Connection Wizard UI
 *
 * Displays connection status with color-coded badge,
 * last verified timestamp, and capabilities list.
 */
import { Badge } from "@/client/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Unplug } from "lucide-react";
import type { ConnectionWithoutCredentials } from "@/server/features/connections";

interface ConnectionStatusProps {
  connection: ConnectionWithoutCredentials;
  showCapabilities?: boolean;
}

type StatusConfigKey = "pending" | "active" | "error" | "disconnected";

/**
 * Status badge with color and icon based on connection status.
 */
export function ConnectionStatus({
  connection,
  showCapabilities = false,
}: ConnectionStatusProps) {
  const { status, lastVerifiedAt, lastErrorMessage, capabilities } = connection;

  const statusConfig = {
    pending: {
      variant: "secondary" as const,
      icon: Clock,
      label: "Pending",
      className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    },
    active: {
      variant: "default" as const,
      icon: CheckCircle2,
      label: "Active",
      className: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    error: {
      variant: "destructive" as const,
      icon: AlertCircle,
      label: "Error",
      className: "bg-red-500/10 text-red-600 border-red-500/20",
    },
    disconnected: {
      variant: "outline" as const,
      icon: Unplug,
      label: "Disconnected",
      className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    },
  };

  const statusKey = (status in statusConfig ? status : "pending") as StatusConfigKey;
  const config = statusConfig[statusKey];
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Badge variant={config.variant} className={config.className}>
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
      </div>

      {lastVerifiedAt && (
        <span className="text-xs text-muted-foreground">
          Verified {formatRelativeTime(lastVerifiedAt)}
        </span>
      )}

      {status === "error" && lastErrorMessage && (
        <span className="text-xs text-red-600">{lastErrorMessage}</span>
      )}

      {showCapabilities && capabilities && capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {capabilities.map((cap) => (
            <Badge key={cap} variant="outline" className="text-xs">
              {formatCapability(cap)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Format a timestamp as relative time (e.g., "2 hours ago").
 */
function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const diff = now.getTime() - then.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return then.toLocaleDateString();
}

/**
 * Format capability name for display.
 */
function formatCapability(cap: string): string {
  return cap
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default ConnectionStatus;
