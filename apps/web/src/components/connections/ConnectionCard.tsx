"use client";

import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Unplug, Search, BarChart3, MapPin, ShoppingBag, Globe, FileCode } from "lucide-react";
import { Button, Card, CardHeader, CardContent, Badge } from "@tevero/ui";

interface ConnectionCardProps {
  id: string;
  platform: string;
  platformAccountName?: string | null;
  platformSiteUrl?: string | null;
  status: string;
  lastSyncAt?: Date | string | null;
  lastError?: string | null;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  isLoading?: boolean;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  google_search_console: <Search className="h-4 w-4" />,
  google_analytics: <BarChart3 className="h-4 w-4" />,
  google_business_profile: <MapPin className="h-4 w-4" />,
  shopify: <ShoppingBag className="h-4 w-4" />,
  wix: <Globe className="h-4 w-4" />,
  wordpress_org: <FileCode className="h-4 w-4" />,
  wordpress_com: <FileCode className="h-4 w-4" />,
};

const PLATFORM_NAMES: Record<string, string> = {
  google_search_console: "Google Search Console",
  google_analytics: "Google Analytics",
  google_business_profile: "Google Business Profile",
  shopify: "Shopify",
  wix: "Wix",
  wordpress_org: "WordPress",
  wordpress_com: "WordPress.com",
  squarespace: "Squarespace",
  webflow: "Webflow",
  hubspot: "HubSpot",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "error" | "info" | "muted" | "destructive" | "outline" | "secondary"> = {
  active: "success",
  error: "error",
  expired: "warning",
  pending: "muted",
  connecting: "muted",
  revoked: "error",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Connected",
  error: "Error",
  expired: "Expired",
  pending: "Pending",
  connecting: "Connecting",
  revoked: "Revoked",
};

export function ConnectionCard({
  id,
  platform,
  platformAccountName,
  platformSiteUrl,
  status,
  lastSyncAt,
  lastError,
  onSync,
  onDisconnect,
  isLoading,
}: ConnectionCardProps) {
  const icon = PLATFORM_ICONS[platform] ?? <Globe className="h-4 w-4" />;
  const platformName = PLATFORM_NAMES[platform] ?? platform;
  const variant = STATUS_VARIANTS[status] ?? "default";
  const statusLabel = STATUS_LABELS[status] ?? status;

  const parsedLastSync = lastSyncAt
    ? typeof lastSyncAt === "string"
      ? new Date(lastSyncAt)
      : lastSyncAt
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{platformName}</span>
        </div>
        <Badge variant={variant}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          {platformAccountName ?? platformSiteUrl ?? "Unknown site"}
        </div>

        {parsedLastSync && (
          <div className="text-xs text-muted-foreground mt-1">
            Last sync:{" "}
            {formatDistanceToNow(parsedLastSync, { addSuffix: true })}
          </div>
        )}

        {lastError && status === "error" && (
          <div className="text-xs text-destructive mt-1">Error: {lastError}</div>
        )}

        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(id)}
            disabled={isLoading || status !== "active"}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Sync Now
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDisconnect(id)}
            disabled={isLoading}
          >
            <Unplug className="h-3 w-3 mr-1" />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
