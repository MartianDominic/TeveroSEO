"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Webhook, Plus, MoreVertical, Trash2, Edit, Key } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Badge,
  Switch,
  cn,
} from "@tevero/ui";
import type { Webhook as WebhookType } from "@/actions/webhooks";
import { updateWebhook, deleteWebhookAction } from "@/actions/webhooks";

interface WebhookListProps {
  webhooks: WebhookType[];
  clientId: string;
  onCreateClick: () => void;
  onEditClick: (webhook: WebhookType) => void;
}

export function WebhookList({
  webhooks,
  clientId,
  onCreateClick,
  onEditClick,
}: WebhookListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = async (webhookId: string, enabled: boolean) => {
    startTransition(async () => {
      await updateWebhook(webhookId, { enabled });
      router.refresh();
    });
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Delete this webhook?")) return;
    startTransition(async () => {
      await deleteWebhookAction(webhookId);
      router.refresh();
    });
  };

  if (webhooks.length === 0) {
    return (
      <div className="text-center py-12">
        <Webhook className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No webhooks configured</h3>
        <p className="text-muted-foreground mb-4">
          Webhooks let you receive real-time notifications when events happen.
        </p>
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead className="w-[100px]">Enabled</TableHead>
              <TableHead className="w-[100px]">Created</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.map((webhook) => (
              <TableRow key={webhook.id}>
                <TableCell className="font-medium">{webhook.name}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {webhook.url.length > 40
                      ? webhook.url.slice(0, 40) + "..."
                      : webhook.url}
                  </code>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(webhook.events as string[]).slice(0, 2).map((event) => (
                      <Badge key={event} variant="secondary" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                    {(webhook.events as string[]).length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{(webhook.events as string[]).length - 2} more
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={(enabled) =>
                      handleToggle(webhook.id, enabled)
                    }
                    disabled={isPending}
                  />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(webhook.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEditClick(webhook)}
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(webhook.id)}
                      disabled={isPending}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
