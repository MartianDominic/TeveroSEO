"use client";

/**
 * IntelligenceStatusBanner - Displays intelligence gathering status.
 *
 * Extracted from client dashboard page.
 */

import React from "react";

import { Loader2, AlertCircle, Brain } from "lucide-react";

export type IntelligenceStatus = "not_started" | "in_progress" | "completed" | "failed";

export interface IntelligenceStatusBannerProps {
  status: IntelligenceStatus;
  onTriggerScrape: () => void;
}

export const IntelligenceStatusBanner: React.FC<IntelligenceStatusBannerProps> = ({
  status,
  onTriggerScrape,
}) => {
  if (status === "completed") {
    return null;
  }

  if (status === "in_progress") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Gathering intelligence...
          </p>
          <p className="text-xs-safe text-muted-foreground">
            Analysing website, extracting brand voice and keyword opportunities.
            Usually takes 30-90 seconds.
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">
            Intelligence gathering failed
          </p>
          <p className="text-xs-safe text-muted-foreground">
            Check that BrightData and DataForSEO are configured in Global Settings.
          </p>
        </div>
        <button
          onClick={onTriggerScrape}
          className="ml-auto shrink-0 text-xs-safe text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // status === "not_started"
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-sm font-medium text-foreground">
          Intelligence not gathered yet
        </p>
        <p className="text-xs-safe text-muted-foreground">
          Trigger a scan to extract brand voice, keyword opportunities, and
          competitor insights.
        </p>
      </div>
      <button
        onClick={onTriggerScrape}
        className="ml-auto shrink-0 text-xs-safe text-primary hover:underline"
      >
        Run now
      </button>
    </div>
  );
};
