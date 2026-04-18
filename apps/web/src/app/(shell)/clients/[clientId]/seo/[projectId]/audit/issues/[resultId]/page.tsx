"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle, Info } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@tevero/ui";
import { getAuditResults } from "@/actions/seo/audit";

interface LighthouseAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  details?: {
    items?: Array<Record<string, unknown>>;
  };
}

interface LighthouseResult {
  categories?: Record<string, { score: number | null; title: string }>;
  audits?: Record<string, LighthouseAudit>;
}

export default function LighthouseIssuesPage() {
  const params = useParams<{
    clientId: string;
    projectId: string;
    resultId: string;
  }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clientId, projectId, resultId } = params;
  const auditId = searchParams.get("auditId") ?? "";
  const category = searchParams.get("category") ?? "performance";

  const resultsQuery = useQuery({
    queryKey: ["audit-results", projectId, auditId],
    queryFn: () => getAuditResults({ projectId, clientId, auditId }),
    enabled: !!auditId,
  });

  const handleBack = () => {
    const backPath = `/clients/${clientId}/seo/${projectId}/audit${auditId ? `?auditId=${auditId}` : ""}`;
    router.push(backPath as Parameters<typeof router.push>[0]);
  };

  if (resultsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (resultsQuery.isError || !resultsQuery.data) {
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to audit
          </Button>
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Could not load Lighthouse results for this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Find the lighthouse result for this specific page
  const results = resultsQuery.data as {
    lighthouseResults?: Record<string, LighthouseResult>;
  };

  const pageResult = results.lighthouseResults?.[resultId];

  if (!pageResult) {
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to audit
          </Button>
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No Lighthouse results found for this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const categories = pageResult.categories ?? {};
  const audits = pageResult.audits ?? {};

  // Filter audits by category and score
  const categoryAudits = Object.values(audits).filter((audit) => {
    // Simple heuristic - in production would use proper category mapping
    if (audit.score === null) return false;
    if (audit.score >= 0.9) return false; // Skip passed audits
    return true;
  });

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to audit
        </Button>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Lighthouse Issues</h1>
          <p className="text-sm text-muted-foreground">{resultId}</p>
        </div>

        {/* Category Scores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(categories).map(([key, cat]) => (
            <Card
              key={key}
              className={category === key ? "ring-2 ring-primary" : ""}
            >
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {cat.title}
                </p>
                <p
                  className={`text-2xl font-semibold ${
                    (cat.score ?? 0) >= 0.9
                      ? "text-green-600"
                      : (cat.score ?? 0) >= 0.5
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {cat.score !== null ? Math.round(cat.score * 100) : "-"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Issues List */}
        <Card>
          <CardHeader>
            <CardTitle>Issues to Fix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryAudits.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>No significant issues found!</span>
              </div>
            ) : (
              categoryAudits.map((audit) => (
                <div
                  key={audit.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {(audit.score ?? 0) < 0.5 ? (
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-medium">{audit.title}</p>
                        {audit.displayValue && (
                          <p className="text-sm text-muted-foreground">
                            {audit.displayValue}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={
                        (audit.score ?? 0) < 0.5 ? "destructive" : "secondary"
                      }
                    >
                      {audit.score !== null
                        ? Math.round(audit.score * 100)
                        : "N/A"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {audit.description}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
