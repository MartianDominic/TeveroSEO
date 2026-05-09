/**
 * QuickActionDialog Component
 * Phase 62-06: Quick Actions
 *
 * Dialog for executing quick actions from the Needs Attention list:
 * - Send Reminder: Send a reminder email with optional custom message
 * - Snooze: Defer follow-up until a specific date with optional reason
 * - Mark as Lost: Mark deal as lost with reason from dropdown
 * - Add Note: Add a note to the entity's activity log
 *
 * Uses native date input for snooze date picker.
 * Provides optimistic feedback with toast-like notifications.
 */
"use client";

import { useState, useTransition } from "react";

import { format, addDays } from "date-fns";
import { Loader2, CalendarIcon, AlertCircle, CheckCircle2 } from "lucide-react";

import type { AttentionItem, QuickActionType, LossReason } from "@/types/command-center";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  cn,
} from "@tevero/ui";

import {
  sendReminder,
  snoozeFollowUp,
  markAsLost,
  addNote,
} from "../actions";


/**
 * Loss reason options for the dropdown.
 * Subset of full taxonomy for quick action simplicity.
 */
const LOSS_REASONS: { value: LossReason; label: string }[] = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "budget_cut", label: "Budget cut" },
  { value: "competitor_cheaper", label: "Competitor cheaper" },
  { value: "bad_timing", label: "Bad timing" },
  { value: "chose_competitor", label: "Chose competitor" },
  { value: "went_internal", label: "Went in-house" },
  { value: "unresponsive", label: "Unresponsive" },
  { value: "ghosted", label: "Ghosted" },
  { value: "wrong_fit", label: "Wrong fit" },
  { value: "other", label: "Other" },
];

/**
 * Action type to dialog title mapping.
 */
const ACTION_TITLES: Record<QuickActionType, string> = {
  reminder: "Send Reminder",
  snooze: "Snooze Follow-up",
  lost: "Mark as Lost",
  note: "Add Note",
};

/**
 * Feedback message state.
 */
interface Feedback {
  type: "success" | "error";
  message: string;
}

export interface QuickActionDialogProps {
  item: AttentionItem;
  actionType: QuickActionType;
  onClose: () => void;
}

export function QuickActionDialog({
  item,
  actionType,
  onClose,
}: QuickActionDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Form state
  const [message, setMessage] = useState("");
  const [snoozeDate, setSnoozeDate] = useState<string>(
    format(addDays(new Date(), 3), "yyyy-MM-dd")
  );
  const [lossReason, setLossReason] = useState<LossReason | "">("");
  const [competitorName, setCompetitorName] = useState("");

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        switch (actionType) {
          case "reminder":
            await sendReminder({
              entityType: item.entityType as "prospect" | "proposal" | "contract" | "invoice",
              entityId: item.entityId,
              message: message || undefined,
            });
            setFeedback({ type: "success", message: "Reminder sent" });
            break;

          case "snooze":
            if (!snoozeDate) {
              setFeedback({ type: "error", message: "Please select a date" });
              return;
            }
            await snoozeFollowUp({
              entityType: item.entityType as "prospect" | "proposal" | "contract" | "invoice" | "follow_up",
              entityId: item.entityId,
              snoozedUntil: new Date(snoozeDate).toISOString(),
              reason: message || undefined,
            });
            setFeedback({
              type: "success",
              message: `Snoozed until ${format(new Date(snoozeDate), "PPP")}`,
            });
            break;

          case "lost":
            if (!lossReason) {
              setFeedback({ type: "error", message: "Please select a reason" });
              return;
            }
            await markAsLost({
              entityType: item.entityType as "prospect" | "proposal",
              entityId: item.entityId,
              reason: lossReason,
              notes: message || undefined,
              competitorName: competitorName || undefined,
            });
            setFeedback({ type: "success", message: "Marked as lost" });
            break;

          case "note":
            if (!message.trim()) {
              setFeedback({ type: "error", message: "Please enter a note" });
              return;
            }
            await addNote({
              entityType: item.entityType,
              entityId: item.entityId,
              note: message,
            });
            setFeedback({ type: "success", message: "Note added" });
            break;
        }

        // Close dialog after short delay to show success message
        setTimeout(onClose, 800);
      } catch (error) {
        setFeedback({
          type: "error",
          message: error instanceof Error ? error.message : "Action failed",
        });
      }
    });
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ACTION_TITLES[actionType]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Feedback message */}
          {feedback && (
            <div
              className={cn(
                "flex items-center gap-2 p-3 rounded-md text-sm",
                feedback.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              )}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {feedback.message}
            </div>
          )}

          {/* Entity context */}
          <div className="text-sm text-muted-foreground">
            {item.title} - {item.subtitle}
          </div>

          {/* Snooze date picker */}
          {actionType === "snooze" && (
            <div className="space-y-2">
              <Label htmlFor="snooze-date">Follow up on</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="snooze-date"
                  type="date"
                  value={snoozeDate}
                  onChange={(e) => setSnoozeDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Loss reason dropdown */}
          {actionType === "lost" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="loss-reason">Reason</Label>
                <Select
                  value={lossReason}
                  onValueChange={(value) => setLossReason(value as LossReason)}
                >
                  <SelectTrigger id="loss-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOSS_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Competitor name field (shown when "chose competitor" selected) */}
              {lossReason === "chose_competitor" && (
                <div className="space-y-2">
                  <Label htmlFor="competitor-name">Competitor name</Label>
                  <Input
                    id="competitor-name"
                    placeholder="Enter competitor name"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {/* Message / Note textarea */}
          <div className="space-y-2">
            <Label htmlFor="message">
              {actionType === "note" ? "Note" : "Message (optional)"}
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                actionType === "reminder"
                  ? "Custom message for reminder..."
                  : actionType === "snooze"
                    ? "Reason for snoozing..."
                    : actionType === "lost"
                      ? "Additional notes..."
                      : "Add details..."
              }
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {actionType === "reminder"
              ? "Send"
              : actionType === "lost"
                ? "Mark Lost"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
