"use client";

import * as React from "react";
import {
  Globe,
  RefreshCw,
  Link,
  Link2Off,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { RelativeTimestamp } from "./relative-timestamp";
import { Button } from "./button";

// ---------------------------------------------------------------------------
// ConnectionStatusCardProps
// ---------------------------------------------------------------------------

export type ConnectionService =
  | "gsc"
  | "ga4"
  | "gbp"
  | "wordpress"
  | "shopify"
  | "custom";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "expiring"
  | "syncing";

export interface ConnectionStatusCardProps {
  /** Service type */
  service: ConnectionService;
  /** Connection status */
  status: ConnectionStatus;
  /** Last sync timestamp */
  lastSync?: Date | string;
  /** Token expiration timestamp */
  expiresAt?: Date | string;
  /** Connected account name */
  account?: string;
  /** Property or site name */
  property?: string;
  /** Connect button callback */
  onConnect?: () => void;
  /** Disconnect button callback */
  onDisconnect?: () => void;
  /** Refresh button callback */
  onRefresh?: () => void;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

interface ServiceConfig {
  label: string;
  icon: LucideIcon;
}

const SERVICE_CONFIG: Record<ConnectionService, ServiceConfig> = {
  gsc: { label: "Google Search Console", icon: Globe },
  ga4: { label: "Google Analytics 4", icon: Globe },
  gbp: { label: "Google Business Profile", icon: Globe },
  wordpress: { label: "WordPress", icon: Globe },
  shopify: { label: "Shopify", icon: Globe },
  custom: { label: "Custom", icon: Globe },
};

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

interface StatusVisuals {
  dotColor: string;
  icon: LucideIcon;
  pulse: boolean;
}

const STATUS_CONFIG: Record<ConnectionStatus, StatusVisuals> = {
  connected: { dotColor: "bg-success", icon: CheckCircle2, pulse: false },
  disconnected: { dotColor: "bg-error", icon: Link2Off, pulse: false },
  error: { dotColor: "bg-error", icon: AlertTriangle, pulse: false },
  expiring: { dotColor: "bg-warning", icon: AlertTriangle, pulse: false },
  syncing: { dotColor: "bg-info", icon: Loader2, pulse: true },
};

// ---------------------------------------------------------------------------
// ConnectionStatusCard
// ---------------------------------------------------------------------------

/**
 * ConnectionStatusCard displays the status of an integration connection.
 *
 * Features:
 * - Service icon and name
 * - Status dot with semantic colors
 * - Last sync timestamp
 * - Expiring token warning banner
 * - Action buttons (Connect/Disconnect/Refresh)
 *
 * @example
 * <ConnectionStatusCard
 *   service="gsc"
 *   status="connected"
 *   lastSync={new Date()}
 *   account="user@example.com"
 *   property="example.com"
 *   onRefresh={() => {}}
 * />
 */
export function ConnectionStatusCard({
  service,
  status,
  lastSync,
  expiresAt,
  account,
  property,
  onConnect,
  onDisconnect,
  onRefresh,
  className,
}: ConnectionStatusCardProps) {
  const serviceConfig = SERVICE_CONFIG[service];
  const statusConfig = STATUS_CONFIG[status];
  const ServiceIcon = serviceConfig.icon;
  const StatusIcon = statusConfig.icon;

  // Check if token is expiring soon (within 7 days)
  const isExpiringSoon = React.useMemo(() => {
    if (!expiresAt) return false;
    const expDate = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
    const daysUntilExpiry = (expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry < 7;
  }, [expiresAt]);

  const isConnected = status === "connected" || status === "syncing" || status === "expiring";

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-surface",
        "shadow-[var(--shadow-card)]",
        "hover:shadow-[var(--shadow-lift)]",
        "transition-shadow duration-[280ms]",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Service icon */}
        <div className="h-10 w-10 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
          <ServiceIcon className="h-5 w-5 text-text-2" />
        </div>

        {/* Service name + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-text-1 truncate">
              {serviceConfig.label}
            </span>
            <span
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                statusConfig.dotColor,
                statusConfig.pulse && "animate-pulse"
              )}
            />
          </div>
          {account && (
            <p className="text-[12px] text-text-3 truncate">{account}</p>
          )}
        </div>

        {/* Status icon */}
        <StatusIcon
          className={cn(
            "h-5 w-5 shrink-0",
            status === "connected" && "text-success",
            status === "disconnected" && "text-error",
            status === "error" && "text-error",
            status === "expiring" && "text-warning",
            status === "syncing" && "text-info animate-spin"
          )}
        />
      </div>

      {/* Property info */}
      {property && isConnected && (
        <div className="px-4 py-2 border-t border-hairline-2">
          <div className="flex items-center gap-2">
            <Link className="h-3.5 w-3.5 text-text-4" />
            <span className="text-[12px] text-text-2 truncate">{property}</span>
          </div>
        </div>
      )}

      {/* Expiring warning banner */}
      {isExpiringSoon && (
        <div className="px-4 py-2 bg-warning-soft border-t border-warning/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
            <span className="text-[12px] text-warning">
              Token expires soon. Please reconnect.
            </span>
          </div>
        </div>
      )}

      {/* Last sync */}
      {lastSync && isConnected && (
        <div className="px-4 py-2 border-t border-hairline-2">
          <RelativeTimestamp timestamp={lastSync} prefix="Last sync:" mono />
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-hairline flex items-center gap-2">
        {isConnected ? (
          <>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={status === "syncing"}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
            )}
            {onDisconnect && (
              <Button variant="ghost" size="sm" onClick={onDisconnect}>
                <Link2Off className="h-4 w-4 mr-1.5" />
                Disconnect
              </Button>
            )}
          </>
        ) : (
          onConnect && (
            <Button variant="default" size="sm" onClick={onConnect}>
              <Link className="h-4 w-4 mr-1.5" />
              Connect
            </Button>
          )
        )}
      </div>
    </div>
  );
}

ConnectionStatusCard.displayName = "ConnectionStatusCard";
