"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Card, CardContent, Skeleton } from "@tevero/ui";
import { WebhookList, WebhookForm } from "@/components/webhooks";
import type { Webhook, WebhookEvent } from "@/actions/webhooks";
import { getClientWebhooks, getEventRegistry } from "@/actions/webhooks";

export default function WebhooksSettingsPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | undefined>();

  useEffect(() => {
    async function load() {
      const [webhooksData, registryData] = await Promise.all([
        getClientWebhooks(clientId),
        getEventRegistry(),
      ]);
      setWebhooks(webhooksData);
      setEvents(registryData.events);
      setCategories(registryData.categories);
      setLoading(false);
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
      getClientWebhooks(clientId).then(setWebhooks);
    }
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
