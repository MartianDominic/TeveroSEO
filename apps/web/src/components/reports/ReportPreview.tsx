"use client";

import { useEffect, useState } from "react";
import { getReportStatus } from "@/lib/reports/actions";
import { Button } from "@tevero/ui";
import { Loader2, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReportMetadata } from "@tevero/types";

interface ReportPreviewProps {
  reportId: string;
  initialStatus: ReportMetadata;
}

export function ReportPreview({ reportId, initialStatus }: ReportPreviewProps) {
  const [status, setStatus] = useState(initialStatus);

  // Poll for status updates while generating
  useEffect(() => {
    if (status.status === "pending" || status.status === "generating") {
      const interval = setInterval(async () => {
        try {
          const updated = await getReportStatus(reportId);
          setStatus(updated);
          if (updated.status === "complete" || updated.status === "failed") {
            clearInterval(interval);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("Failed to fetch status:", error);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [reportId, status.status]);

  if (status.status === "pending" || status.status === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg font-medium">
          {status.status === "pending" ? "Queued..." : "Generating report..."}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This usually takes 30-60 seconds.
        </p>
      </div>
    );
  }

  if (status.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-lg font-medium text-destructive">
          Report generation failed
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {status.errorMessage || "Unknown error occurred"}
        </p>
      </div>
    );
  }

  // Complete - show download option
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <p className="mt-4 text-lg font-medium text-emerald-600">Report Ready!</p>
      <p className="text-sm text-muted-foreground mt-2">
        Generated {status.generatedAt ? new Date(status.generatedAt).toLocaleString() : ""}
      </p>
      <a
        href={`/api/reports/${reportId}/download`}
        download
        className="mt-6"
      >
        <Button size="lg">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </a>
    </div>
  );
}
