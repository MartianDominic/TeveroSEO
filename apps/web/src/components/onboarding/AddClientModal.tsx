"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost, apiGet } from "@/lib/api-client";
import { useClientStore } from "@/stores/clientStore";
import { Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clientId: string) => void;
}

type Step = "form" | "creating";

interface PlatformSecretStatus {
  key_name: string;
  configured: boolean;
  required: boolean;
}

// ---------------------------------------------------------------------------
// AddClientModal
// ---------------------------------------------------------------------------

export const AddClientModal: React.FC<AddClientModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { fetchClients, setActiveClient } = useClientStore();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleClose = () => {
    if (step === "creating") return; // Don't allow close during creation
    setName("");
    setUrl("");
    setUrlError(null);
    setNameError(null);
    setSubmitError(null);
    setStep("form");
    onClose();
  };

  const validateForm = (): boolean => {
    let valid = true;

    if (!name.trim()) {
      setNameError("Client name is required");
      valid = false;
    } else {
      setNameError(null);
    }

    if (!url.trim()) {
      setUrlError("Website URL is required");
      valid = false;
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setUrlError("URL must start with http:// or https://");
      valid = false;
    } else {
      setUrlError(null);
    }

    return valid;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validateForm()) return;

    setStep("creating");

    try {
      // Create the client
      const newClient = await apiPost<{
        id: string;
        name: string;
        website_url: string | null;
      }>("/api/clients", { name: name.trim(), website_url: url.trim() });

      // Refresh client list and set as active
      await fetchClients();
      setActiveClient(newClient.id);

      // Check if BrightData + DataForSEO are configured before triggering scrape
      try {
        const statuses = await apiGet<PlatformSecretStatus[]>(
          "/api/platform-secrets/status"
        );
        const brightDataConfigured = statuses.some(
          (s) =>
            s.key_name.toLowerCase().includes("brightdata") && s.configured
        );
        const dataForSeoConfigured = statuses.some(
          (s) =>
            s.key_name.toLowerCase().includes("dataforseo") && s.configured
        );

        if (brightDataConfigured && dataForSeoConfigured) {
          // Fire and forget — don't await; scrape is a background operation
          apiPost(
            `/api/client-intelligence/${newClient.id}/scrape`,
            {}
          ).catch(() => {
            // Intentionally ignored — scrape failure is non-blocking
          });
        }
      } catch {
        // Secrets check failed — skip scrape trigger, non-blocking
      }

      // Reset form state before calling onCreated
      setName("");
      setUrl("");
      setUrlError(null);
      setNameError(null);
      setSubmitError(null);
      setStep("form");

      onCreated(newClient.id);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create client";
      setSubmitError(msg);
      setStep("form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription>
            We&apos;ll automatically gather intelligence on their website after
            creation.
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="mt-5 space-y-4">
            {/* Name field */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-client-name">
                Client name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="modal-client-name"
                placeholder="Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
            </div>

            {/* URL field */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-client-url">
                Website URL <span className="text-destructive">*</span>
              </Label>
              <Input
                id="modal-client-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
            </div>

            {/* Submit error */}
            {submitError && (
              <p className="text-xs text-destructive">{submitError}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || !url.trim()}
              >
                Add Client →
              </Button>
            </div>
          </div>
        )}

        {step === "creating" && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Creating client and gathering intelligence...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This usually takes 30–60 seconds
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
