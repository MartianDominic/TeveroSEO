"use client";

/**
 * ManualCheck Component
 * Phase 66-06: Verification UI
 *
 * Single-request manual verification button.
 * Used when auto-polling fails and user wants to check immediately.
 */

import { useState } from "react";
import { RefreshCw, Check, X } from "lucide-react";
import { Button } from "@tevero/ui";
import type { GeoLocation } from "@/hooks/use-verification-poll";

// ============================================================================
// Types
// ============================================================================

type CheckResult = "idle" | "checking" | "success" | "pending" | "error";

interface VerificationResponse {
  status: "pending" | "detected" | "verified" | "error";
  location?: GeoLocation;
  pingCount?: number;
}

export interface ManualCheckProps {
  /** Site ID to check */
  siteId: string;
  /** Called when installation is detected */
  onSuccess: (data: VerificationResponse) => void;
  /** Called when still pending */
  onStillPending: () => void;
  /** Called on error */
  onError: (error: Error) => void;
  /** Custom button text */
  buttonText?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function ManualCheck({
  siteId,
  onSuccess,
  onStillPending,
  onError,
  buttonText = "Check now",
}: ManualCheckProps) {
  const [result, setResult] = useState<CheckResult>("idle");

  const handleCheck = async () => {
    setResult("checking");

    try {
      const response = await fetch(
        `/api/connect/verify?siteId=${encodeURIComponent(siteId)}&timeoutMs=5000`
      );

      if (!response.ok) {
        throw new Error("Verification request failed");
      }

      const data: VerificationResponse = await response.json();

      if (data.status === "detected" || data.status === "verified") {
        setResult("success");
        onSuccess(data);
      } else if (data.status === "error") {
        setResult("error");
        onError(new Error("Verification failed"));
      } else {
        setResult("pending");
        onStillPending();
      }
    } catch (error) {
      setResult("error");
      onError(error instanceof Error ? error : new Error("Unknown error"));
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleCheck}
        disabled={result === "checking"}
        variant="outline"
        className="gap-2"
      >
        <RefreshCw
          className={`h-4 w-4 ${result === "checking" ? "animate-spin" : ""}`}
        />
        {result === "checking" ? "Checking..." : buttonText}
      </Button>

      {/* Result feedback */}
      {result === "success" && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span>Connected!</span>
        </div>
      )}

      {result === "pending" && (
        <div className="text-sm text-muted-foreground">
          Not detected yet. Make sure you've added the code and visited your
          website.
        </div>
      )}

      {result === "error" && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <X className="h-4 w-4" />
          <span>Something went wrong. Please try again.</span>
        </div>
      )}
    </div>
  );
}
