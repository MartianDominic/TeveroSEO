/**
 * Loss Reason Modal for declining proposals.
 * Phase 30-08: Pipeline & Automation
 *
 * Features:
 * - Predefined loss reasons
 * - Custom notes for "other"
 * - Lithuanian labels
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";

/**
 * Predefined loss reasons with Lithuanian labels.
 */
export const LOSS_REASONS = [
  { id: "price", label: "Kaina per didele" },
  { id: "competitor", label: "Pasirinko konkurenta" },
  { id: "timing", label: "Netinkamas laikas" },
  { id: "no_response", label: "Neatsake" },
  { id: "internal", label: "Vidinis sprendimas" },
  { id: "other", label: "Kita" },
] as const;

export type LossReasonId = (typeof LOSS_REASONS)[number]["id"];

/**
 * Validate if a string is a valid loss reason ID.
 */
export function validateLossReason(reason: string): reason is LossReasonId {
  return LOSS_REASONS.some((r) => r.id === reason);
}

/**
 * Input type for declining a proposal.
 */
export const DeclineProposalInput = {
  proposalId: "" as string,
  reason: "" as LossReasonId,
  notes: undefined as string | undefined,
};

export type DeclineProposalInputType = typeof DeclineProposalInput;

/**
 * Props for LossReasonModal component.
 */
export interface LossReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  companyName?: string;
  onSubmit: (data: { reason: LossReasonId; notes?: string }) => Promise<void>;
}

/**
 * Loss Reason Modal - Collects reason when declining a proposal.
 */
export function LossReasonModal({
  open,
  onOpenChange,
  proposalId,
  companyName,
  onSubmit,
}: LossReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<LossReasonId | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        reason: selectedReason,
        notes: selectedReason === "other" ? notes : undefined,
      });
      // Reset state after successful submission
      setSelectedReason(null);
      setNotes("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kodel pasiulymas nepriimtas?</DialogTitle>
          <DialogDescription>
            {companyName
              ? `Pasirinkite priezasti, kodel ${companyName} atsisake pasiulymo.`
              : "Pasirinkite priezasti, kodel klientas atsisake pasiulymo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Loss reason buttons */}
          <div className="grid grid-cols-2 gap-2">
            {LOSS_REASONS.map((reason) => (
              <button
                key={reason.id}
                type="button"
                onClick={() => setSelectedReason(reason.id)}
                className={`p-3 border rounded-lg text-left transition-colors ${
                  selectedReason === reason.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {reason.label}
              </button>
            ))}
          </div>

          {/* Notes field for "other" reason */}
          {selectedReason === "other" && (
            <div className="space-y-2">
              <label htmlFor="loss-notes" className="text-sm font-medium">
                Papildoma informacija
              </label>
              <Textarea
                id="loss-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Iveskite priezasti..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Atsaukti
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReason || isSubmitting}
          >
            {isSubmitting ? "Issaugoma..." : "Issaugoti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LossReasonModal;
