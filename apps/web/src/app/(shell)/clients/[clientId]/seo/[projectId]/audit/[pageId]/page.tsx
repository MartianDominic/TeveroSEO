"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, XCircle, Wrench } from "lucide-react";
import { Button, Card, CardContent } from "@tevero/ui";
import { getPageFindings, exportFindingsCSV } from "@/actions/seo/findings";
import { ScoreCard } from "@/components/seo/ScoreCard";
import { FindingsTable } from "@/components/seo/FindingsTable";
import type { PageFindingsResponse } from "@/actions/seo/findings";

export default function PageFindingsPage() {
  const params = useParams<{
    clientId: string;
    projectId: string;
    pageId: string;
  }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clientId, projectId, pageId } = params;
  const auditId = searchParams.get("auditId") ?? "";

  const [isExporting, setIsExporting] = useState(false);

  const findingsQuery = useQuery({
    queryKey: ["page-findings", projectId, auditId, pageId],
    queryFn: () =>
      getPageFindings({
        projectId,
        clientId,
        auditId,
        pageId,
      }),
    enabled: Boolean(auditId),
  });

  const handleExport = useCallback(async () => {
    if (!auditId) return;
    setIsExporting(true);
    try {
      const csv = await exportFindingsCSV({ projectId, clientId, auditId });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-findings-${auditId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [auditId, projectId, clientId]);

  const goBack = () => {
    window.location.href = `/clients/${clientId}/seo/${projectId}/audit?auditId=${auditId}`;
  };

  if (!auditId) {
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="h-5 w-5" />
            <span>No audit ID provided. Please select an audit first.</span>
          </div>
          <Button variant="ghost" size="sm" className="mt-4" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to audit
          </Button>
        </div>
      </div>
    );
  }

  if (findingsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (findingsQuery.isError) {
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load page findings. Please try again.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to audit
          </Button>
        </div>
      </div>
    );
  }

  const data = findingsQuery.data as PageFindingsResponse;
  const { findings, score, pageUrl } = data;

  const passedCount = findings.filter((f) => f.passed).length;
  const failedCount = findings.filter((f) => !f.passed).length;
  const autoFixableCount = findings.filter((f) => f.autoEditable && !f.passed).length;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to audit
          </Button>
          <h1 className="text-2xl font-semibold">Page SEO Analysis</h1>
          <p className="text-sm text-muted-foreground break-all">{pageUrl}</p>
        </div>

        {/* Score Card */}
        <ScoreCard score={score.score} breakdown={score.breakdown} gates={score.gates} />

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Checks
              </p>
              <p className="text-2xl font-semibold">{findings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Passed
                </p>
                <p className="text-2xl font-semibold text-green-600">
                  {passedCount}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Failed
                </p>
                <p className="text-2xl font-semibold text-red-600">
                  {failedCount}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Auto-Fixable
                </p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {autoFixableCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Findings Table */}
        <FindingsTable
          findings={findings}
          onExport={isExporting ? undefined : handleExport}
        />
      </div>
    </div>
  );
}
