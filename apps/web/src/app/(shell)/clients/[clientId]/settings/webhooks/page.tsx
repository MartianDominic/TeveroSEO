"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Card, CardContent, Skeleton, Button } from "@tevero/ui";
import { WebhookList, WebhookForm } from "@/components/webhooks";
import type { Webhook, WebhookEvent } from "@/actions/webhooks";
import { getClientWebhooks, getEventRegistry } from "@/actions/webhooks";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function WebhooksSettingsPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | undefined>();

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const [webhooksData, registryData] = await Promise.all([
          getClientWebhooks(clientId),
          getEventRegistry(),
        ]);
        setWebhooks(webhooksData);
        setEvents(registryData.events);
        setCategories(registryData.categories);
      } catch (err) {
        console.error('[WebhooksPage] Load error:', err);
        setError('Failed to load webhooks. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId]);

  const handleCreateClick = () => {
    setEditingWebhook(undefined);
    setFormOpen(true);
  };

  const handleEditClick = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingWebhook(undefined);
      getClientWebhooks(clientId)
        .then(setWebhooks)
        .catch((err) => {
          console.error('[WebhooksPage] Refresh error:', err);
        });
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    Promise.all([getClientWebhooks(clientId), getEventRegistry()])
      .then(([webhooksData, registryData]) => {
        setWebhooks(webhooksData);
        setEvents(registryData.events);
        setCategories(registryData.categories);
      })
      .catch((err) => {
        console.error('[WebhooksPage] Retry error:', err);
        setError('Failed to load webhooks. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Webhooks"
          subtitle="Configure webhook endpoints for real-time notifications"
          backHref={`/clients/${clientId}/settings`}
        />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Webhooks"
          subtitle="Configure webhook endpoints for real-time notifications"
          backHref={`/clients/${clientId}/settings`}
        />
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center min-h-[200px] gap-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-muted-foreground text-center">{error}</p>
              <Button variant="outline" onClick={handleRetry}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Webhooks"
        subtitle="Configure webhook endpoints for real-time notifications"
        backHref={`/clients/${clientId}/settings`}
      />

      <Card>
        <CardContent className="p-6">
          <WebhookList
            webhooks={webhooks}
            clientId={clientId}
            onCreateClick={handleCreateClick}
            onEditClick={handleEditClick}
          />
        </CardContent>
      </Card>

      <WebhookForm
        open={formOpen}
        onOpenChange={handleFormClose}
        clientId={clientId}
        webhook={editingWebhook}
        events={events}
        categories={categories}
      />
    </div>
  );
}
