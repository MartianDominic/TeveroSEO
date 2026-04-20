"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
} from "@tevero/ui";
import type { Webhook, WebhookEvent } from "@/actions/webhooks";
import { createWebhook, updateWebhook } from "@/actions/webhooks";

interface WebhookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  webhook?: Webhook;
  events: WebhookEvent[];
  categories: string[];
}

export function WebhookForm({
  open,
  onOpenChange,
  clientId,
  webhook,
  events,
  categories,
}: WebhookFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(webhook?.name ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    (webhook?.events as string[]) ?? [],
  );
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const isEditing = !!webhook;

  const toggleEvent = (eventType: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventType)
        ? prev.filter((e) => e !== eventType)
        : [...prev, eventType],
    );
  };

  const toggleCategory = (category: string) => {
    const categoryEvents = events
      .filter((e) => e.category === category)
      .map((e) => e.type);

    const allSelected = categoryEvents.every((e) =>
      selectedEvents.includes(e),
    );

    if (allSelected) {
      setSelectedEvents((prev) =>
        prev.filter((e) => !categoryEvents.includes(e)),
      );
    } else {
      setSelectedEvents((prev) => [
        ...new Set([...prev, ...categoryEvents]),
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      if (isEditing) {
        await updateWebhook(webhook.id, {
          name,
          url,
          events: selectedEvents,
        });
      } else {
        const result = await createWebhook({
          clientId,
          name,
          url,
          events: selectedEvents,
        });
        setNewSecret(result.secret);
      }
      router.refresh();
      if (isEditing) {
        onOpenChange(false);
      }
    });
  };

  const handleClose = () => {
    setNewSecret(null);
    setName("");
    setUrl("");
    setSelectedEvents([]);
    onOpenChange(false);
  };

  if (newSecret) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Created</DialogTitle>
            <DialogDescription>
              Save this secret - it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Signing Secret</Label>
            <code className="block mt-2 p-3 bg-muted rounded text-sm break-all">
              {newSecret}
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Use this secret to verify webhook signatures.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Webhook" : "Create Webhook"}
          </DialogTitle>
          <DialogDescription>
            Configure the endpoint and events for this webhook.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My webhook"
                required
              />
            </div>

            <div>
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                required
              />
            </div>

            <div>
              <Label>Events</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select which events trigger this webhook.
              </p>

              <div className="space-y-4">
                {categories.map((category) => {
                  const categoryEvents = events.filter(
                    (e) => e.category === category,
                  );
                  const selectedCount = categoryEvents.filter((e) =>
                    selectedEvents.includes(e.type),
                  ).length;

                  return (
                    <div key={category} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className="font-medium capitalize hover:text-primary"
                        >
                          {category}
                        </button>
                        <Badge variant="outline">
                          {selectedCount}/{categoryEvents.length}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categoryEvents.map((event) => (
                          <Badge
                            key={event.type}
                            variant={
                              selectedEvents.includes(event.type)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() => toggleEvent(event.type)}
                          >
                            {event.type.split(".")[1]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || selectedEvents.length === 0}>
              {isPending
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
