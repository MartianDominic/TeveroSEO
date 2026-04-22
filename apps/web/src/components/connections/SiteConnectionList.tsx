"use client";

import { useState } from "react";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Link2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Button, StatusChip } from "@tevero/ui";
import {
  verifySiteConnection,
  deleteSiteConnection,
} from "@/lib/siteConnections";
import type { SiteConnection } from "@/lib/siteConnections";

interface SiteConnectionListProps {
  connections: SiteConnection[];
  onRefresh: () => void;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusIcon(status: SiteConnection["status"]) {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "pending":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function SiteConnectionList({
  connections,
  onRefresh,
}: SiteConnectionListProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleVerify(id: string) {
    setActionLoading(`verify-${id}`);
    try {
      await verifySiteConnection(id);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    // Confirm dialog before delete (T-31-09 mitigation)
    if (!confirm("Are you sure you want to disconnect this site?")) return;
    setActionLoading(`delete-${id}`);
    try {
      await deleteSiteConnection(id);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  }

  if (connections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No site connections yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center gap-3">
            {getStatusIcon(conn.status)}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {conn.displayName || conn.siteUrl}
                </span>
                <StatusChip
                  status={conn.status === "active" ? "connected" : "draft"}
                />
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="capitalize">{conn.platform}</span>
                <span>*</span>
                <span>Verified: {formatDate(conn.lastVerifiedAt)}</span>
                {conn.lastErrorMessage && (
                  <>
                    <span>*</span>
                    <span className="text-destructive">
                      {conn.lastErrorMessage}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleVerify(conn.id)}
              disabled={actionLoading === `verify-${conn.id}`}
              title="Verify connection"
            >
              {actionLoading === `verify-${conn.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDelete(conn.id)}
              disabled={actionLoading === `delete-${conn.id}`}
              title="Disconnect"
            >
              {actionLoading === `delete-${conn.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
