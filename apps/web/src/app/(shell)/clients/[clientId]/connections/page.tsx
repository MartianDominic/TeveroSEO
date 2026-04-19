"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Link2,
  Link2Off,
  RotateCcw,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

import {
  Button,
  PageHeader,
  Skeleton,
  StatusChip,
} from "@tevero/ui";

import type { OAuthConnection, OAuthProvider } from "@tevero/types";
import { useClientStore } from "@/stores/clientStore";
import {
  fetchConnections,
  createInvite,
  revokeConnection,
} from "@/lib/clientOAuth";

// ── Provider configuration ───────────────────────────────────────────────────

interface ProviderConfig {
  id: OAuthProvider;
  name: string;
  description: string;
  available: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    name: "Google",
    description: "Search Console, Analytics, Business Profile",
    available: true,
  },
  {
    id: "bing",
    name: "Bing",
    description: "Webmaster Tools",
    available: false, // Not yet implemented
  },
  {
    id: "wordpress",
    name: "WordPress",
    description: "Direct blog publishing",
    available: false, // Uses CMS credentials, not OAuth
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "Store blog publishing",
    available: false, // Uses API key, not OAuth
  },
  {
    id: "wix",
    name: "Wix",
    description: "Site blog publishing",
    available: false, // Not yet implemented
  },
];

// ── Toast state ──────────────────────────────────────────────────────────────

interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "error";
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPropertyKey(key: string): string {
  const keyMap: Record<string, string> = {
    gsc_site_url: "Site URL",
    ga4_property_id: "GA4 Property",
    gbp_location_id: "GBP Location",
  };
  return keyMap[key] || key;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const clients = useClientStore((s) => s.clients);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? null;

  // ── State ────────────────────────────────────────────────────────────────
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "success",
  });

  const showToast = useCallback(
    (message: string, severity: "success" | "error" = "success") => {
      setToast({ open: true, message, severity });
      setTimeout(() => setToast((t) => ({ ...t, open: false })), 3000);
    },
    []
  );

  // ── Load connections ─────────────────────────────────────────────────────
  const loadConnections = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setLoadError(false);

    try {
      const data = await fetchConnections(clientId);
      setConnections(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  // ── Get connection for provider ──────────────────────────────────────────
  const getConnection = useCallback(
    (providerId: OAuthProvider): OAuthConnection | undefined => {
      return connections.find(
        (c) => c.provider === providerId && c.is_active
      );
    },
    [connections]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleDirectConnect = useCallback(
    (_provider: OAuthProvider) => {
      // For direct connect, redirect to OAuth flow with client_id
      const publicUrl =
        process.env.NEXT_PUBLIC_AI_WRITER_URL || "http://localhost:8000";
      window.location.href = `${publicUrl}/api/auth/google/start?client_id=${clientId}`;
    },
    [clientId]
  );

  const handleSendInvite = useCallback(
    async (_provider: OAuthProvider) => {
      if (!clientId) return;
      setActionLoading("invite");

      try {
        const invite = await createInvite(clientId, []);
        setInviteUrl(invite.url);
        // Auto-copy to clipboard
        await navigator.clipboard.writeText(invite.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast("Invite link copied to clipboard");
      } catch {
        showToast("Failed to create invite link", "error");
      } finally {
        setActionLoading(null);
      }
    },
    [clientId, showToast]
  );

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast("Copied to clipboard");
    } catch {
      showToast("Failed to copy", "error");
    }
  }, [inviteUrl, showToast]);

  const handleReconnect = useCallback(
    (provider: OAuthProvider) => {
      // Reconnect is the same as direct connect - starts new OAuth flow
      handleDirectConnect(provider);
    },
    [handleDirectConnect]
  );

  const handleDisconnect = useCallback(
    async (provider: OAuthProvider) => {
      if (!clientId) return;
      setActionLoading(`disconnect-${provider}`);

      try {
        await revokeConnection(clientId, provider);
        await loadConnections();
        showToast(`${provider} disconnected`);
      } catch {
        showToast(`Failed to disconnect ${provider}`, "error");
      } finally {
        setActionLoading(null);
      }
    },
    [clientId, loadConnections, showToast]
  );

  // ── Render loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render error state ───────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PageHeader
          title="Connections"
          subtitle={clientName ?? undefined}
          backHref={clientId ? `/clients/${clientId}` : "/clients"}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center mt-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-base font-semibold text-foreground">
              Failed to load connections
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              There was a problem loading this client&apos;s connections.
            </p>
          </div>
          <Button variant="outline" onClick={loadConnections}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Render main page ─────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <PageHeader
        title="Connections"
        subtitle={clientName ?? undefined}
        backHref={clientId ? `/clients/${clientId}` : "/clients"}
      />

      <div className="mt-6 space-y-4">
        {PROVIDERS.map((provider) => {
          const connection = getConnection(provider.id);
          const isConnected = !!connection;

          return (
            <div
              key={provider.id}
              className="rounded-lg border border-border bg-card p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {provider.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                </div>
                <StatusChip status={isConnected ? "connected" : "draft"} />
              </div>

              {/* Connected state */}
              {isConnected && connection && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Connected by {connection.connected_by} on{" "}
                    {formatDate(connection.connected_at)}
                  </div>

                  {/* Properties */}
                  {connection.properties && connection.properties.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-md bg-muted/50">
                      {connection.properties.map((prop) => (
                        <div
                          key={prop.key}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {formatPropertyKey(prop.key)}
                          </span>
                          <span className="text-foreground font-mono text-xs">
                            {prop.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReconnect(provider.id)}
                      disabled={!provider.available}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(provider.id)}
                      disabled={actionLoading === `disconnect-${provider.id}`}
                    >
                      {actionLoading === `disconnect-${provider.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Link2Off className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}

              {/* Not connected state */}
              {!isConnected && (
                <div className="space-y-3">
                  {provider.available ? (
                    <>
                      <Button onClick={() => handleDirectConnect(provider.id)}>
                        <Link2 className="h-4 w-4 mr-2" />
                        Connect {provider.name}
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendInvite(provider.id)}
                          disabled={actionLoading === "invite"}
                        >
                          {actionLoading === "invite" ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Send invite link
                        </Button>
                        {inviteUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopyInvite}
                            title="Copy invite link"
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      {inviteUrl && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs text-muted-foreground break-all font-mono">
                            {inviteUrl}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Coming soon — configure in Settings &gt; CMS Integration
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast notification */}
      {toast.open && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg bg-card border border-border transition-opacity">
          <div className="flex items-center gap-2">
            <StatusChip
              status={toast.severity === "success" ? "published" : "failed"}
            />
            <span className="text-foreground">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
