"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientStore } from "@/stores/clientStore";
import { apiGet } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformSecretStatus {
  key_name: string;
  configured: boolean;
  required: boolean;
}

// ---------------------------------------------------------------------------
// StepIndicator
// ---------------------------------------------------------------------------

const StepIndicator = ({ done }: { done: boolean }) => (
  <span
    className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
      done
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        : "border border-border text-muted-foreground"
    )}
  >
    {done ? "✓" : ""}
  </span>
);

// ---------------------------------------------------------------------------
// GettingStartedCard
// ---------------------------------------------------------------------------

interface GettingStartedCardProps {
  onAddClient: () => void;
}

export const GettingStartedCard: React.FC<GettingStartedCardProps> = ({
  onAddClient,
}) => {
  const router = useRouter();
  const { clients } = useClientStore();

  const [apisReady, setApisReady] = useState(false);
  const [secretsLoading, setSecretsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSecretsLoading(true);
    apiGet<PlatformSecretStatus[]>("/api/platform-secrets/status")
      .then((statuses) => {
        if (cancelled) return;
        const requiredKeys = statuses.filter((s) => s.required);
        const allConfigured =
          requiredKeys.length > 0 && requiredKeys.every((s) => s.configured);
        setApisReady(allConfigured);
      })
      .catch(() => {
        if (!cancelled) setApisReady(false);
      })
      .finally(() => {
        if (!cancelled) setSecretsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasClients = clients.length > 0;

  // Step completion state
  const step1Done = true; // Account created is always done
  const step2Done = apisReady;
  const step3Done = hasClients;

  const completedCount = [step1Done, step2Done, step3Done].filter(Boolean)
    .length;

  // Auto-hide when all steps complete
  if (!secretsLoading && step2Done && step3Done) {
    return null;
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          Getting Started
        </span>
        <span className="text-xs text-muted-foreground">
          — {completedCount}/3 complete
        </span>
      </div>

      <div className="space-y-3">
        {/* Step 1 — Account created (always done) */}
        <div className="flex items-start gap-3">
          <StepIndicator done={step1Done} />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                step1Done
                  ? "text-foreground line-through opacity-60"
                  : "text-foreground"
              )}
            >
              Account created
            </p>
          </div>
        </div>

        {/* Step 2 — Configure API integrations */}
        <div className="flex items-start gap-3">
          <StepIndicator done={step2Done} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  step2Done
                    ? "text-foreground line-through opacity-60"
                    : "text-foreground"
                )}
              >
                Configure API integrations
              </p>
              {!step2Done && (
                <button
                  onClick={() => router.push("/settings" as Parameters<typeof router.push>[0])}
                  className="shrink-0 text-xs text-primary hover:underline"
                >
                  Go to Settings →
                </button>
              )}
            </div>
            {!step2Done && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gemini, DataForSEO, BrightData
              </p>
            )}
          </div>
        </div>

        {/* Step 3 — Add first client */}
        <div className="flex items-start gap-3">
          <StepIndicator done={step3Done} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  step3Done
                    ? "text-foreground line-through opacity-60"
                    : "text-foreground"
                )}
              >
                Add your first client
              </p>
              {!step3Done && (
                <button
                  onClick={onAddClient}
                  className="shrink-0 text-xs text-primary hover:underline"
                >
                  Add Client →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
