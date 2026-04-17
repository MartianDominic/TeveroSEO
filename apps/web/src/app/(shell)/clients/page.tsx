"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClientStore } from "@/stores/clientStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { AddClientModal } from "@/components/onboarding/AddClientModal";
import { Building2, Globe, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// CMS display label helper
// ---------------------------------------------------------------------------
const CMS_LABELS: Record<string, string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  wix: "Wix",
  webhook: "Webhook",
};

function getCmsLabel(cmsType: string | null | undefined): string {
  if (!cmsType) return "Not configured";
  return CMS_LABELS[cmsType.toLowerCase()] ?? cmsType;
}

// ---------------------------------------------------------------------------
// ClientListPage
// ---------------------------------------------------------------------------
export default function ClientsPage() {
  const { clients, isLoading, error, fetchClients, setActiveClient } =
    useClientStore();
  const router = useRouter();

  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardClick = (id: string) => {
    setActiveClient(id);
    router.push(`/clients/${id}`);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <PageHeader
        title="Clients"
        subtitle="Manage your agency clients"
        actions={
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus />
            Add Client
          </Button>
        }
      />

      {/* Getting Started card — self-hides when all steps complete */}
      {!isLoading && (
        <GettingStartedCard onAddClient={() => setAddModalOpen(true)} />
      )}

      {/* Loading state — 3 skeleton cards */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg p-4 space-y-3"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-destructive">Failed to load clients</p>
          <Button variant="outline" onClick={fetchClients}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && clients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <Building2 className="w-12 h-12 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              No clients yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first client to get started.
            </p>
          </div>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus />
            Add Client
          </Button>
        </div>
      )}

      {/* Client grid */}
      {!isLoading && !error && clients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const c = client as Record<string, unknown>;
            return (
              <div
                key={client.id}
                onClick={() => handleCardClick(client.id)}
                className={cn(
                  "bg-card border border-border rounded-lg p-4",
                  "hover:border-border/80 transition-colors cursor-pointer",
                  "flex flex-col gap-3"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate">
                    {client.name}
                  </h3>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                {client.website_url && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{client.website_url}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <StatusChip
                    status={(c.cms_type as string) || "draft"}
                    label={getCmsLabel(c.cms_type as string | null)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {c.last_published_at
                      ? `Published ${new Date(
                          c.last_published_at as string
                        ).toLocaleDateString()}`
                      : "Never published"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Client Modal */}
      <AddClientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={(id) => {
          setAddModalOpen(false);
          router.push(`/clients/${id}`);
        }}
      />
    </div>
  );
}
