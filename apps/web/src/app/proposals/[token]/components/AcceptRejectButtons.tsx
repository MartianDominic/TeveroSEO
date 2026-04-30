"use client";

/**
 * Accept/Reject buttons for public proposal page.
 * Phase 46-47: Proposal System
 *
 * Provides interactive buttons for proposal acceptance/rejection.
 * Shows appropriate states based on current proposal status.
 */

import { useState, useTransition } from "react";
import { Check, X, Loader2, PartyPopper } from "lucide-react";
import { acceptProposal, rejectProposal } from "../actions";

interface AcceptRejectButtonsProps {
  proposalId: string;
  status: string;
}

export function AcceptRejectButtons({
  proposalId,
  status,
}: AcceptRejectButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"accept" | "reject" | null>(null);
  const [result, setResult] = useState<"accepted" | "rejected" | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Already accepted
  if (status === "accepted" || result === "accepted") {
    return (
      <div className="text-center py-8">
        <PartyPopper className="h-16 w-16 mx-auto mb-4 text-green-600 animate-bounce" />
        <h2
          className="text-2xl font-semibold text-green-800 mb-2"
          style={{ fontFamily: "Newsreader, serif" }}
        >
          Pasiulymas priimtas!
        </h2>
        <p className="text-gray-600">
          Dekojame! Netrukus susisieksime su jumis del tolesniu zingsniu.
        </p>
      </div>
    );
  }

  // Already declined
  if (status === "declined" || result === "rejected") {
    return (
      <div className="text-center py-8">
        <X className="h-16 w-16 mx-auto mb-4 text-gray-400" />
        <h2
          className="text-2xl font-semibold text-gray-600 mb-2"
          style={{ fontFamily: "Newsreader, serif" }}
        >
          Pasiulymas atmestas
        </h2>
        <p className="text-gray-500">
          Dekojame uz laika. Jei apsigalvosite, susisiekite su mumis.
        </p>
      </div>
    );
  }

  // Can only accept/reject from sent or viewed status
  if (!["sent", "viewed"].includes(status)) {
    return null;
  }

  const handleAccept = () => {
    setError(null);
    setAction("accept");
    startTransition(async () => {
      const res = await acceptProposal(proposalId);
      if (res.success) {
        setResult("accepted");
      } else {
        setError(res.error || "Nepavyko priimti pasiulymo");
      }
      setAction(null);
    });
  };

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }

    setError(null);
    setAction("reject");
    startTransition(async () => {
      const res = await rejectProposal(proposalId, rejectReason || undefined);
      if (res.success) {
        setResult("rejected");
      } else {
        setError(res.error || "Nepavyko atmesti pasiulymo");
      }
      setAction(null);
    });
  };

  const handleCancelReject = () => {
    setShowRejectInput(false);
    setRejectReason("");
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {showRejectInput && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priezastis (neprivaloma)
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            rows={3}
            placeholder="Pasakykite, kodel pasiulymas netinka..."
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">
            {rejectReason.length}/500
          </p>
        </div>
      )}

      <div className="flex gap-4 justify-center flex-wrap">
        {!showRejectInput && (
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-8 py-3 text-lg font-medium rounded-lg transition-colors"
          >
            {isPending && action === "accept" ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Check className="mr-2 h-5 w-5" />
            )}
            Priimti pasiulyma
          </button>
        )}

        <button
          onClick={handleReject}
          disabled={isPending}
          className={`inline-flex items-center justify-center px-8 py-3 text-lg font-medium rounded-lg transition-colors ${
            showRejectInput
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300"
          } disabled:opacity-50`}
        >
          {isPending && action === "reject" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <X className="mr-2 h-5 w-5" />
          )}
          {showRejectInput ? "Patvirtinti atmietima" : "Atmesti"}
        </button>

        {showRejectInput && (
          <button
            onClick={handleCancelReject}
            disabled={isPending}
            className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium rounded-lg transition-colors bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 disabled:opacity-50"
          >
            Atsaukti
          </button>
        )}
      </div>
    </div>
  );
}
