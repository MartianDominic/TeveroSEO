"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from "@tevero/ui";
import { Eye, Send, Edit, RefreshCw, Loader2 } from "lucide-react";
import type { ProposalSummary } from "../actions";
import { sendProposal, resendProposal } from "../actions";

interface ProposalTableProps {
  proposals: ProposalSummary[];
  prospectId: string;
}

/**
 * Status badge configuration mapping.
 * Maps proposal status to badge label and variant.
 */
const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  viewed: { label: "Viewed", variant: "default" },
  accepted: { label: "Accepted", variant: "default" },
  signed: { label: "Signed", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  onboarded: { label: "Onboarded", variant: "default" },
  declined: { label: "Declined", variant: "destructive" },
  expired: { label: "Expired", variant: "outline" },
};

/**
 * ProposalTable component displays a list of proposals with status badges
 * and quick actions (Edit, Send, Resend, View).
 */
export function ProposalTable({ proposals, prospectId }: ProposalTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = (proposalId: string) => {
    setError(null);
    setActionId(proposalId);
    startTransition(async () => {
      const result = await sendProposal(proposalId, prospectId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
      setActionId(null);
    });
  };

  const handleResend = (proposalId: string) => {
    setError(null);
    setActionId(proposalId);
    startTransition(async () => {
      const result = await resendProposal(proposalId, prospectId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
      setActionId(null);
    });
  };

  const formatCurrency = (cents: number | null, currency: string | null) => {
    if (cents === null) return "-";
    return new Intl.NumberFormat("lt-LT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("lt-LT", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proposals</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3 px-2 font-medium text-muted-foreground">Type</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Status</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Price</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Created</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No proposals yet
                  </td>
                </tr>
              ) : (
                proposals.map((proposal) => {
                  const statusInfo = STATUS_MAP[proposal.status] || STATUS_MAP.draft;
                  const isLoading = isPending && actionId === proposal.id;

                  return (
                    <tr key={proposal.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 capitalize">{proposal.template || "standard"}</td>
                      <td className="py-3 px-2">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div>
                          <div>{formatCurrency(proposal.setupFeeCents, proposal.currency)} setup</div>
                          <div className="text-muted-foreground">
                            {formatCurrency(proposal.monthlyFeeCents, proposal.currency)}/mo
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {formatDate(proposal.createdAt)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {/* Draft: Edit and Send actions */}
                          {proposal.status === "draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const editUrl = `/prospects/${prospectId}/proposal/builder?edit=${proposal.id}`;
                                  router.push(editUrl as never);
                                }}
                                title="Edit proposal"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSend(proposal.id)}
                                disabled={isLoading}
                                title="Send proposal"
                              >
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {/* Sent: Resend action */}
                          {proposal.status === "sent" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResend(proposal.id)}
                              disabled={isLoading}
                              title="Resend proposal"
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {/* View action (available for all statuses) */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const previewUrl = `/prospects/${prospectId}/proposal/preview?id=${proposal.id}`;
                              router.push(previewUrl as never);
                            }}
                            title="View proposal"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
