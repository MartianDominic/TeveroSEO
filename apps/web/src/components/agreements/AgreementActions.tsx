"use client";

/**
 * AgreementActions Component
 * Phase 59-08: Success Page & Status Tracking
 *
 * Action buttons for agreement management in admin view.
 * Handles send, remind, cancel, download PDF actions.
 */

import { useState } from "react";

import { Send, Mail, XCircle, Download, Loader2, MoreHorizontal } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tevero/ui";

export type AgreementStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_signed"
  | "completed"
  | "cancelled";

interface AgreementActionsProps {
  agreementId: string;
  status: AgreementStatus;
  onSend?: () => Promise<void>;
  onRemindAll?: () => Promise<void>;
  onCancel?: () => Promise<void>;
  onDownloadPdf?: () => Promise<void>;
  locale?: string;
}

export function AgreementActions({
  agreementId,
  status,
  onSend,
  onRemindAll,
  onCancel,
  onDownloadPdf,
  locale = "en",
}: AgreementActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, handler?: () => Promise<void>) => {
    if (!handler) return;
    setLoading(action);
    try {
      await handler();
    } finally {
      setLoading(null);
    }
  };

  const isDraft = status === "draft";
  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";
  const canSend = isDraft && onSend;
  const canRemind = !isDraft && !isCancelled && !isCompleted && onRemindAll;
  const canCancel = !isCancelled && !isCompleted && onCancel;
  const canDownload = isCompleted && onDownloadPdf;

  // Labels
  const labels = {
    send: locale === "lt" ? "Siusti pasirasymui" : "Send for Signing",
    remind: locale === "lt" ? "Priminti visiems" : "Remind All",
    cancel: locale === "lt" ? "Atsaukti sutarti" : "Cancel Agreement",
    download: locale === "lt" ? "Atsisiusti PDF" : "Download PDF",
    actions: locale === "lt" ? "Veiksmai" : "Actions",
  };

  return (
    <div className="flex items-center gap-2">
      {/* Primary action button */}
      {canSend && (
        <Button
          onClick={() => handleAction("send", onSend)}
          disabled={loading === "send"}
        >
          {loading === "send" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {labels.send}
        </Button>
      )}

      {canDownload && (
        <Button
          onClick={() => handleAction("download", onDownloadPdf)}
          disabled={loading === "download"}
        >
          {loading === "download" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {labels.download}
        </Button>
      )}

      {/* Secondary actions in dropdown */}
      {(canRemind || canCancel) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{labels.actions}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canRemind && (
              <DropdownMenuItem
                onClick={() => handleAction("remind", onRemindAll)}
                disabled={loading === "remind"}
              >
                {loading === "remind" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {labels.remind}
              </DropdownMenuItem>
            )}

            {canRemind && canCancel && <DropdownMenuSeparator />}

            {canCancel && (
              <DropdownMenuItem
                onClick={() => handleAction("cancel", onCancel)}
                disabled={loading === "cancel"}
                className="text-destructive focus:text-destructive"
              >
                {loading === "cancel" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {labels.cancel}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Status indicator for cancelled/completed */}
      {isCancelled && (
        <span className="text-sm text-muted-foreground px-3 py-2 bg-muted rounded-md">
          {locale === "lt" ? "Sutartis atsaukta" : "Agreement cancelled"}
        </span>
      )}
    </div>
  );
}

export default AgreementActions;
