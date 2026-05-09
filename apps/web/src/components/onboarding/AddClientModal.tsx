"use client";

/**
 * AddClientModal - Client creation modal with sync confirmation
 *
 * FIX-16 Updates:
 * - H-ONBOARD-03: Added sync confirmation before redirect (verifySyncComplete)
 * - M-ONBOARD-01: Required fields already marked with asterisk
 * - M-ONBOARD-03: Form state preserved on error (already implemented)
 * - M-ONBOARD-05: Improved validation messages
 */

import React, { useState, useRef, useEffect } from "react";

import { Loader2, X } from "lucide-react";

import { apiPost, apiGet } from "@/lib/api-client";
import { useClientStore } from "@/stores/clientStore";

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


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clientId: string) => void;
}

type Step = "form" | "creating" | "syncing";

interface PlatformSecretStatus {
  key_name: string;
  configured: boolean;
  required: boolean;
}

// Timeout for creation process (60 seconds)
const CREATION_TIMEOUT_MS = 60000;

// H-ONBOARD-03: Max retries for sync verification
const SYNC_VERIFY_MAX_RETRIES = 5;
const SYNC_VERIFY_DELAY_MS = 500;
// FIX-08 H-SYNC-03: Exponential backoff constants for sync verification
const SYNC_VERIFY_INITIAL_DELAY_MS = 500;
const SYNC_VERIFY_BACKOFF_MULTIPLIER = 1.5;
const SYNC_VERIFY_MAX_DELAY_MS = 5000;

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

  // M-ONBOARD-05 FIX: Improved validation messages with specific guidance
  const validateForm = (): boolean => {
    let valid = true;

    if (!name.trim()) {
      setNameError("Enter a client name (e.g., company name or project name)");
      valid = false;
    } else if (name.trim().length < 2) {
      setNameError("Client name must be at least 2 characters");
      valid = false;
    } else {
      setNameError(null);
    }

    if (!url.trim()) {
      setUrlError("Enter the client's website URL (e.g., https://example.com)");
      valid = false;
    } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setUrlError("URL must start with https:// (recommended) or http://");
      valid = false;
    } else {
      try {
        new URL(url);
        setUrlError(null);
      } catch {
        setUrlError("Enter a valid URL (e.g., https://example.com)");
        valid = false;
      }
    }

    return valid;
  };

  /**
   * FIX-08 H-SYNC-03: Verify client sync is complete before redirect.
   * Uses exponential backoff for retries: 500ms, 1000ms, 2000ms, 4000ms, 4000ms
   * Polls the client endpoint to ensure the record is accessible.
   */
  const verifySyncComplete = async (clientId: string): Promise<boolean> => {
    for (let attempt = 0; attempt < SYNC_VERIFY_MAX_RETRIES; attempt++) {
      try {
        const client = await apiGet<{ id: string }>(`/api/clients/${clientId}`);
        if (client?.id === clientId) {
          return true;
        }
      } catch {
        // Client not yet accessible, retry
      }

      // FIX-08 H-SYNC-03: Calculate exponential backoff delay with cap
      const delay = Math.min(
        SYNC_VERIFY_INITIAL_DELAY_MS * Math.pow(SYNC_VERIFY_BACKOFF_MULTIPLIER, attempt),
        SYNC_VERIFY_MAX_DELAY_MS
      );
      // Add small jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
    return false;
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

      // H-ONBOARD-03 FIX: Update step to show syncing state
      setStep("syncing");

      // H-ONBOARD-03 FIX: Verify sync is complete before proceeding
      const syncComplete = await verifySyncComplete(newClient.id);
      if (!syncComplete) {
        // Log warning but continue - the client was created, just slow to sync
        console.warn(`Client ${newClient.id} sync verification timed out, proceeding anyway`);
      }

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

      // Clear timeout on success
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
      // M-ONBOARD-05 FIX: More helpful error message
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create client. Please check your connection and try again.";
      setSubmitError(msg);
      setStep("form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-modal)]">
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
                Creating client...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Step 1 of 2: Setting up client record
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

        {/* H-ONBOARD-03: Syncing step - confirm client is accessible */}
        {step === "syncing" && !isCancelling && (
          <div className="mt-6 flex flex-col items-center gap-3 py-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Finalizing setup...
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Step 2 of 2: Confirming client is ready
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
