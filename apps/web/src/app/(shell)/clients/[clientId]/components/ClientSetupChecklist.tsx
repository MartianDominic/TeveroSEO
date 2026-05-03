"use client";

/**
 * ClientSetupChecklist - Per-client onboarding checklist.
 *
 * Extracted from client dashboard page.
 */

import React from "react";
import { useRouter } from "next/navigation";
import type { IntelligenceStatus } from "./IntelligenceStatusBanner";

export interface ClientSetupChecklistProps {
  clientId: string;
  intelligenceStatus: IntelligenceStatus;
}

export const ClientSetupChecklist: React.FC<ClientSetupChecklistProps> = ({
  clientId,
  intelligenceStatus,
}) => {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="mb-3 text-sm font-semibold text-foreground">Client Setup</p>
      <div className="space-y-2.5">
        {/* Step 1 - Client added (always done on this page) */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            ✓
          </span>
          <span className="text-sm text-muted-foreground line-through opacity-60">
            Client added
          </span>
        </div>

        {/* Step 2 - Intelligence gathering */}
        <div className="flex items-center gap-2.5">
          {intelligenceStatus === "in_progress" ? (
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            </span>
          ) : intelligenceStatus === "completed" ? (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ✓
            </span>
          ) : (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border" />
          )}
          <span
            className={
              intelligenceStatus === "completed"
                ? "text-sm text-muted-foreground line-through opacity-60"
                : "text-sm text-foreground"
            }
          >
            Intelligence gathering
          </span>
        </div>

        {/* Step 3 - Configure CMS publishing */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border" />
            <span className="text-sm text-foreground">Configure CMS publishing</span>
          </div>
          <button
            onClick={() =>
              router.push(
                `/clients/${clientId}/settings` as Parameters<typeof router.push>[0]
              )
            }
            className="text-xs text-primary hover:underline shrink-0"
          >
            Configure
          </button>
        </div>

        {/* Step 4 - Publish first article */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border" />
            <span className="text-sm text-foreground">Publish first article</span>
          </div>
          <button
            onClick={() =>
              router.push(
                `/clients/${clientId}/calendar` as Parameters<typeof router.push>[0]
              )
            }
            className="text-xs text-primary hover:underline shrink-0"
          >
            Open Calendar
          </button>
        </div>
      </div>
    </div>
  );
};
