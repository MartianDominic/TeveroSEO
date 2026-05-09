"use client";

import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@tevero/ui";

import { ConnectionCard } from "./ConnectionCard";
import { PlatformConnectionFlow } from "./PlatformConnectionFlow";

interface Connection {
  id: string;
  platform: string;
  platformAccountName?: string | null;
  platformSiteUrl?: string | null;
  status: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

interface ConnectionStatusDashboardProps {
  prospectId?: string;
}

async function fetchConnections(prospectId?: string): Promise<Connection[]> {
  const params = new URLSearchParams();
  if (prospectId) params.set("prospectId", prospectId);
  const res = await fetch(`/api/connections?${params}`);
  if (!res.ok) throw new Error("Failed to fetch connections");
  const data = await res.json();
  return data.connections ?? [];
}

async function syncConnection(id: string): Promise<void> {
  const res = await fetch(`/api/connections/${id}/sync`, { method: "POST" });
  if (!res.ok) throw new Error("Sync failed");
}

async function disconnectConnection(id: string): Promise<void> {
  const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Disconnect failed");
}

export function ConnectionStatusDashboard({
  prospectId,
}: ConnectionStatusDashboardProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["connections", prospectId],
    queryFn: () => fetchConnections(prospectId),
  });

  const syncMutation = useMutation({
    mutationFn: syncConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  const handleSync = (id: string) => {
    syncMutation.mutate(id);
  };

  const handleDisconnect = (id: string) => {
    if (confirm("Are you sure you want to disconnect this platform?")) {
      disconnectMutation.mutate(id);
    }
  };

  const handleAddSuccess = () => {
    setShowAddDialog(false);
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Platform Connections</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Connection
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No connections yet. Connect a platform to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              id={conn.id}
              platform={conn.platform}
              platformAccountName={conn.platformAccountName}
              platformSiteUrl={conn.platformSiteUrl}
              status={conn.status}
              lastSyncAt={conn.lastSyncAt}
              lastError={conn.lastError}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
              isLoading={syncMutation.isPending || disconnectMutation.isPending}
            />
          ))}
        </div>
      )}

      {showAddDialog && (
        <PlatformConnectionFlow
          prospectId={prospectId}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleAddSuccess}
        />
      )}
    </div>
  );
}
