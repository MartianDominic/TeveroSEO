"use client";

/**
 * Pre-Signing Form Component
 * Phase 59: Agreement & Signing Excellence - Pre-Signing Flow (59-06)
 *
 * Manages signer configuration, signing mode selection, and invitation sending.
 * Per D-07: Sequential mode sends to signers in order.
 * Per D-08: Parallel mode sends to all signers simultaneously.
 */

import { useState } from "react";

import { Send, Plus, CheckCircle } from "lucide-react";

import {
  addSigner,
  removeSigner,
  updateSigningMode,
  updateSigningOrder,
  sendInvitations,
  type PreSigningData,
  type SignerData,
} from "@/app/(shell)/clients/[clientId]/agreements/[agreementId]/pre-sign/actions";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { Button } from "@tevero/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import { Alert, AlertDescription } from "@tevero/ui";
import { Label } from "@tevero/ui";



import { AddSignerDialog } from "./AddSignerDialog";
import { SignerList } from "./SignerList";

interface PreSigningFormProps {
  initialData: PreSigningData;
}

export function PreSigningForm({ initialData }: PreSigningFormProps) {
  const [data, setData] = useState(initialData);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleAddSigner = async (signerData: {
    name: string;
    email: string;
    phone?: string;
    title?: string;
    role?: string;
  }) => {
    const result = await addSigner(data.agreement.id, signerData);
    if (result.success && result.signer) {
      setData((prev) => ({
        ...prev,
        signers: [...prev.signers, result.signer!],
        canSend: true,
        sendMessage: undefined,
      }));
    }
    setIsAddDialogOpen(false);
  };

  const handleRemoveSigner = async (signerId: string) => {
    const result = await removeSigner(data.agreement.id, signerId);
    if (result.success) {
      setData((prev) => ({
        ...prev,
        signers: prev.signers.filter((s) => s.id !== signerId),
        canSend: prev.signers.length > 1,
        sendMessage: prev.signers.length <= 1 ? "Add at least one signer" : undefined,
      }));
    }
  };

  const handleReorder = async (newOrder: string[]) => {
    await updateSigningOrder(data.agreement.id, newOrder);
    setData((prev) => ({
      ...prev,
      signers: newOrder.map((id, idx) => {
        const signer = prev.signers.find((s) => s.id === id)!;
        return { ...signer, signingOrder: idx + 1 };
      }),
    }));
  };

  const handleModeChange = async (mode: "sequential" | "parallel") => {
    await updateSigningMode(data.agreement.id, mode);
    setData((prev) => ({
      ...prev,
      agreement: { ...prev.agreement, signingMode: mode },
    }));
  };

  const handleSendInvitations = async () => {
    setIsSending(true);
    setSendError(null);

    const result = await sendInvitations(data.agreement.id);

    if (result.success) {
      setSendSuccess(true);
    } else {
      setSendError(result.error || "Failed to send invitations");
    }

    setIsSending(false);
  };

  if (sendSuccess) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-green-800 mb-2">
            Invitations Sent Successfully
          </h2>
          <p className="text-green-700">
            {data.agreement.signingMode === "sequential"
              ? "The first signer has been notified. Subsequent signers will be notified after each signature."
              : `All ${data.signers.length} signers have been notified via email.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Signing Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Signing Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={data.agreement.signingMode}
            onValueChange={(v) => handleModeChange(v as "sequential" | "parallel")}
            className="space-y-4"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="sequential" id="sequential" className="mt-1" />
              <Label htmlFor="sequential" className="cursor-pointer flex-1">
                <span className="font-medium text-gray-900 block">Sequential</span>
                <span className="text-sm text-gray-500 block mt-0.5">
                  Signers sign in order. Provider signs first, then client receives invitation.
                </span>
              </Label>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="parallel" id="parallel" className="mt-1" />
              <Label htmlFor="parallel" className="cursor-pointer flex-1">
                <span className="font-medium text-gray-900 block">Parallel</span>
                <span className="text-sm text-gray-500 block mt-0.5">
                  All signers receive invitations simultaneously. Any order allowed.
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Signers List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Signers</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Signer
          </Button>
        </CardHeader>
        <CardContent>
          {data.signers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No signers configured yet.</p>
              <p className="text-sm mt-1">Add at least one signer to proceed.</p>
            </div>
          ) : (
            <SignerList
              signers={data.signers}
              mode={data.agreement.signingMode}
              onRemove={handleRemoveSigner}
              onReorder={handleReorder}
            />
          )}
        </CardContent>
      </Card>

      {/* Send Button */}
      <div className="flex flex-col items-end gap-3">
        {sendError && (
          <Alert variant="destructive" className="w-full">
            <AlertDescription>{sendError}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          {data.sendMessage && (
            <p className="text-sm text-gray-500">{data.sendMessage}</p>
          )}
          <Button
            size="lg"
            onClick={handleSendInvitations}
            disabled={!data.canSend || isSending}
          >
            <Send className="w-4 h-4 mr-2" />
            {isSending ? "Sending..." : "Send Invitations"}
          </Button>
        </div>
      </div>

      <AddSignerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddSigner}
      />
    </div>
  );
}
