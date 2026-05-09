"use client";

/**
 * ClassificationProgress: SSE-based progress display for keyword classification.
 *
 * Connects to /api/keywords/progress/:jobId for real-time updates.
 * Shows current stage, progress bar, and processing statistics.
 */

import { useEffect, useState } from "react";

import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

import { ProgressBar } from "@tevero/ui";

export interface ProgressEvent {
  stage: "expanding" | "pass1" | "pass2" | "complete" | "error";
  progress: number;
  message: string;
  stats?: {
    total: number;
    processed: number;
    pass1Rate?: number;
  };
}

export interface ClassificationResult {
  keywords: Array<{
    keyword: string;
    include: boolean;
    confidence: number;
    type: string | null;
    reasoning: string;
    pass: 1 | 2;
  }>;
  stats: {
    totalInput: number;
    included: number;
    excluded: number;
    pass1Rate: number;
  };
}

interface ClassificationProgressProps {
  jobId: string;
  onComplete?: (result: ClassificationResult) => void;
  onError?: (error: string) => void;
}

export function ClassificationProgress({
  jobId,
  onComplete,
  onError,
}: ClassificationProgressProps) {
  const [event, setEvent] = useState<ProgressEvent>({
    stage: "expanding",
    progress: 0,
    message: "Expanding keywords...",
  });

  useEffect(() => {
    const eventSource = new EventSource(`/api/keywords/progress/${jobId}`);

    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data) as ProgressEvent;
      setEvent(data);

      if (data.stage === "complete" && onComplete) {
        eventSource.close();
        // Fetch final result
        fetch(`/api/keywords/result/${jobId}`)
          .then((res) => res.json())
          .then(onComplete)
          .catch((err) => onError?.(err.message));
      }

      if (data.stage === "error" && onError) {
        eventSource.close();
        onError(data.message);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      onError?.("Connection lost");
    };

    return () => eventSource.close();
  }, [jobId, onComplete, onError]);

  const getStageIcon = () => {
    if (event.stage === "complete") {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    if (event.stage === "error") {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
  };

  const getStageLabel = (stage: ProgressEvent["stage"]): string => {
    switch (stage) {
      case "expanding":
        return "Expanding keywords";
      case "pass1":
        return "Pass 1: Quick classification";
      case "pass2":
        return "Pass 2: Deep analysis";
      case "complete":
        return "Classification complete";
      case "error":
        return "Error occurred";
      default:
        return "Processing";
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        {getStageIcon()}
        <div>
          <span className="font-medium">{getStageLabel(event.stage)}</span>
          <p className="text-sm text-muted-foreground">{event.message}</p>
        </div>
      </div>

      <ProgressBar value={event.progress} size="md" />

      {event.stats && (
        <div className="text-sm text-muted-foreground">
          Processed {event.stats.processed} of {event.stats.total} keywords
          {event.stats.pass1Rate !== undefined && (
            <span className="ml-2">
              (Pass 1 rate: {event.stats.pass1Rate.toFixed(0)}%)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
