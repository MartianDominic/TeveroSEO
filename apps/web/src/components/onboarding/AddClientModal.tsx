"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@tevero/ui";
import { apiPost, apiGet } from "@/lib/api-client";
import { useClientStore } from "@/stores/clientStore";
import { Loader2, X } from "lucide-react";

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

// Timeout for creation process (60 seconds)
const CREATION_TIMEOUT_MS = 60000;

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
  const [isCancelling, setIsCancelling] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Store the trigger element for focus management
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  const handleClose = (force = false) => {
    if (step === "creating" && !force) {
      // Show cancel confirmation instead of blocking
      setIsCancelling(true);
      return;
    }

    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setName("");
    setUrl("");
    setUrlError(null);
    setNameError(null);
    setSubmitError(null);
    setStep("form");
    setIsCancelling(false);
    onClose();

    // Return focus to trigger element
    setTimeout(() => {
      triggerRef.current?.focus();
    }, 0);
  };

  const handleCancelCreation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setSubmitError("Client creation was cancelled.");
    setStep("form");
    setIsCancelling(false);
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

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    // Set timeout protection
    timeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setSubmitError("Client creation timed out. Please try again.");
      setStep("form");
    }, CREATION_TIMEOUT_MS);

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
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Don't show error if cancelled
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
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

        {/* Cancel confirmation during creation */}
        {isCancelling && (
          <div className="mt-4 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10">
            <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
              Are you sure you want to cancel? The client creation is in progress.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelling(false)}
              >
                Continue Waiting
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelCreation}
              >
                Cancel Creation
              </Button>
            </div>
          </div>
        )}

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
              <Button variant="outline" onClick={() => handleClose()}>
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

        {step === "creating" && !isCancelling && (
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
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-muted-foreground hover:text-foreground"
              onClick={() => handleClose()}
              aria-label="Cancel client creation"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
