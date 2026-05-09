"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Send, Eye, Download, Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
} from "@tevero/ui";


import { sendContract } from "../actions";
import { SignatureStatus } from "./SignatureStatus";

import type { ContractSummary } from "../actions";

interface ContractTableProps {
  contracts: ContractSummary[];
  prospectId: string;
}

export function ContractTable({ contracts, prospectId }: ContractTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = (contractId: string) => {
    setError(null);
    setActionId(contractId);
    startTransition(async () => {
      const result = await sendContract(contractId, prospectId);
      if (result.success && result.data?.signingUrl) {
        // Redirect to Dokobit signing page
        window.open(result.data.signingUrl, "_blank");
        router.refresh();
      } else {
        setError(!result.success ? result.error : "Failed to send contract");
      }
      setActionId(null);
    });
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
        <CardTitle className="text-base">Sutartys</CardTitle>
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
                <th className="py-3 px-2 font-medium text-muted-foreground">Pavadinimas</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Pasirašymo būsena</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Sukurta</th>
                <th className="py-3 px-2 font-medium text-muted-foreground">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    Sutarčių dar nėra
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => {
                  const isLoading = isPending && actionId === contract.id;

                  return (
                    <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">{contract.title}</td>
                      <td className="py-3 px-2">
                        <SignatureStatus
                          status={contract.status}
                          signedAt={contract.signedAt}
                          signerName={contract.signerName}
                        />
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {formatDate(contract.createdAt)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          {/* Draft: Send action */}
                          {contract.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSend(contract.id)}
                              disabled={isLoading}
                              title="Siųsti pasirašyti"
                            >
                              {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {/* Signed: Download action */}
                          {contract.status === "signed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Download signed PDF
                                window.open(`/api/contracts/${contract.id}/download`, "_blank");
                              }}
                              title="Atsisiųsti"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {/* View action */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              router.push(`/prospects/${prospectId}/contracts/${contract.id}` as never);
                            }}
                            title="Peržiūrėti"
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
