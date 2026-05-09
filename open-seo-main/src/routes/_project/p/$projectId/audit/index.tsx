import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, XCircle, Clock } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelAudit,
  getAuditResults,
  getAuditStatus,
  getCrawlProgress,
  retryAudit,
} from "@/serverFunctions/audit";
import { auditSearchSchema } from "@/types/schemas/audit";
import { LaunchView } from "@/client/features/audit/launch/LaunchView";
import { ResultsView } from "@/client/features/audit/results/ResultsView";
import {
  extractHostname,
  extractPathname,
  formatStartedAt,
  HttpStatusBadge,
  StatusBadge,
  SUPPORT_URL,
} from "@/client/features/audit/shared";
import { toast } from "sonner";

export const Route = createFileRoute<"/_project/p/$projectId/audit/">(
  "/_project/p/$projectId/audit/",
)({
  validateSearch: auditSearchSchema,
  component: SiteAuditPage,
});

function SiteAuditPage() {
  const { projectId } = Route.useParams();
  const { auditId, tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      void navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );

  if (!auditId) {
    return (
      <LaunchView
        projectId={projectId}
        onAuditStarted={(id) => setSearchParams({ auditId: id })}
      />
    );
  }

  return (
    <AuditDetail
      projectId={projectId}
      auditId={auditId}
      tab={tab}
      setSearchParams={setSearchParams}
      onBack={() => setSearchParams({ auditId: undefined })}
    />
  );
}

function AuditDetail({
  projectId,
  auditId,
  tab,
  setSearchParams,
  onBack,
}: {
  projectId: string;
  auditId: string;
  tab: string;
  setSearchParams: (updates: Record<string, string | undefined>) => void;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["audit-status", projectId, auditId],
    queryFn: () => getAuditStatus({ data: { projectId, auditId } }),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "running" ? 3000 : false;
    },
  });

  // H-AUDIT-01: Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelAudit({ data: { projectId, auditId } }),
    onSuccess: () => {
      toast.success("Audit cancelled");
      void queryClient.invalidateQueries({ queryKey: ["audit-status", projectId, auditId] });
    },
    onError: (error) => {
      toast.error("Failed to cancel audit", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  // M-AUDIT-02: Retry mutation
  const retryMutation = useMutation({
    mutationFn: () => retryAudit({ data: { projectId, auditId } }),
    onSuccess: () => {
      toast.success("Audit restarted");
      void queryClient.invalidateQueries({ queryKey: ["audit-status", projectId, auditId] });
    },
    onError: (error) => {
      toast.error("Failed to retry audit", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const isComplete = statusQuery.data?.status === "completed";
  const isFailed = statusQuery.data?.status === "failed";
  const isCancelled = statusQuery.data?.status === "cancelled";
  const isRunning = statusQuery.data?.status === "running";

  const resultsQuery = useQuery({
    queryKey: ["audit-results", projectId, auditId],
    queryFn: () => getAuditResults({ data: { projectId, auditId } }),
    enabled: isComplete,
  });

  if (statusQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="alert alert-error">
            <AlertCircle className="size-5" />
            <span>We could not load this audit. It may have been deleted.</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            &larr; Back to audits
          </Button>
        </div>
      </div>
    );
  }

  const status = statusQuery.data;
  const showSupportCta =
    isFailed || (isComplete && status && status.pagesCrawled <= 1);
  const canRetry = isFailed || isCancelled;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="px-0" onClick={onBack}>
            &larr; All audits
          </Button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Site Audit</h1>
            <div className="flex items-center gap-2">
              {status?.status !== "running" && status && (
                <StatusBadge status={status.status} />
              )}
              {/* M-AUDIT-02: Retry button for failed/cancelled audits */}
              {canRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="size-3 mr-1" />
                  )}
                  Retry
                </Button>
              )}
            </div>
          </div>
          {status && (
            <p className="text-sm text-foreground/70">
              {extractHostname(status.startUrl)} &middot; Started{" "}
              {formatStartedAt(status.startedAt)}
            </p>
          )}
        </div>

        {isRunning && status && (
          <ProgressCard
            projectId={projectId}
            auditId={auditId}
            status={status}
            startedAt={status.startedAt}
            onCancel={() => cancelMutation.mutate()}
            isCancelling={cancelMutation.isPending}
          />
        )}

        {showSupportCta && (
          <div
            className={isFailed ? "alert alert-error" : "alert alert-warning"}
          >
            <AlertCircle className="size-5" />
            <div className="space-y-1">
              <p className="font-medium">
                Site audit couldn't fully crawl this website.
              </p>
              <p>
                This is often caused by anti-bot or firewall settings. Reach out
                at{" "}
                <a
                  className="underline underline-offset-4 hover:opacity-80"
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  everyapp.dev/support
                </a>{" "}
                and we'll help configure auditing for your site.
              </p>
            </div>
          </div>
        )}

        {/* Show cancelled state message */}
        {isCancelled && (
          <div className="alert alert-info">
            <AlertCircle className="size-5" />
            <div className="space-y-1">
              <p className="font-medium">Audit was cancelled</p>
              <p>You can retry this audit using the button above.</p>
            </div>
          </div>
        )}

        {isComplete && resultsQuery.data && (
          <ResultsView
            projectId={projectId}
            data={resultsQuery.data}
            tab={tab}
            setSearchParams={setSearchParams}
          />
        )}
      </div>
    </div>
  );
}

/**
 * H-AUDIT-01: Audit timeout configuration
 * Max duration is 30 minutes, warning shown at 80% (24 minutes)
 */
const MAX_AUDIT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const TIMEOUT_WARNING_THRESHOLD = 0.8; // 80%

/**
 * Estimate remaining time based on progress and elapsed time.
 * M-AUDIT-01: Granular progress with estimated time remaining.
 */
function estimateRemainingTime(
  progress: number,
  startedAt: Date | string | null,
): string | null {
  if (!startedAt || progress <= 0 || progress >= 100) return null;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  const estimatedTotal = (elapsed / progress) * 100;
  const remaining = estimatedTotal - elapsed;

  if (remaining < 0 || remaining > MAX_AUDIT_DURATION_MS) return null;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (minutes > 0) {
    return `~${minutes}m ${seconds}s remaining`;
  }
  return `~${seconds}s remaining`;
}

function ProgressCard({
  projectId,
  auditId,
  status,
  startedAt,
  onCancel,
  isCancelling,
}: {
  projectId: string;
  auditId: string;
  status: {
    pagesCrawled: number;
    pagesTotal: number;
    lighthouseTotal: number;
    lighthouseCompleted: number;
    lighthouseFailed: number;
    currentPhase: string | null;
  };
  startedAt: Date | string | null;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  const crawlProgress =
    status.pagesTotal > 0
      ? Math.round((status.pagesCrawled / status.pagesTotal) * 100)
      : 0;
  const lighthouseDone = status.lighthouseCompleted + status.lighthouseFailed;
  const lighthouseProgress =
    status.lighthouseTotal > 0
      ? Math.round((lighthouseDone / status.lighthouseTotal) * 100)
      : 0;
  const isLighthousePhase = status.currentPhase === "lighthouse";
  const phaseLabel =
    status.currentPhase === "discovery"
      ? "Discovery"
      : status.currentPhase === "crawling"
        ? "Crawling"
        : status.currentPhase === "lighthouse"
          ? "Lighthouse"
          : status.currentPhase === "finalizing"
            ? "Finalizing"
            : (status.currentPhase ?? "Running");
  const progress = isLighthousePhase ? lighthouseProgress : crawlProgress;

  // H-AUDIT-01: Calculate estimated remaining time
  const estimatedTime = estimateRemainingTime(progress, startedAt);

  // H-AUDIT-01: Show timeout warning at 80% of max duration
  useEffect(() => {
    if (!startedAt) return;

    const checkTimeout = () => {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const threshold = MAX_AUDIT_DURATION_MS * TIMEOUT_WARNING_THRESHOLD;

      if (elapsed >= threshold && !showTimeoutWarning) {
        setShowTimeoutWarning(true);
        toast.warning("Audit is taking longer than expected", {
          description: "The audit may timeout soon. Consider cancelling and trying with fewer pages.",
          duration: 10000,
        });
      }
    };

    checkTimeout();
    const interval = setInterval(checkTimeout, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [startedAt, showTimeoutWarning]);

  const crawlProgressQuery = useQuery({
    queryKey: ["audit-crawl-progress", projectId, auditId],
    queryFn: () => getCrawlProgress({ data: { projectId, auditId } }),
    refetchInterval: 1500,
  });

  const crawledUrls = crawlProgressQuery.data ?? [];

  return (
    <div className="space-y-3">
      {/* H-AUDIT-01: Timeout warning banner */}
      {showTimeoutWarning && (
        <div className="alert alert-warning">
          <Clock className="size-5" />
          <div>
            <p className="font-medium">Audit is taking longer than expected</p>
            <p className="text-sm">Consider cancelling and retrying with fewer pages.</p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="gap-3 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              {isLighthousePhase
                ? "Running Lighthouse checks"
                : "Crawling pages"}
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{phaseLabel}</Badge>
              {/* H-AUDIT-01: Cancel button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isCancelling}
                className="text-destructive hover:text-destructive"
              >
                {isCancelling ? (
                  <Loader2 className="size-3 animate-spin mr-1" />
                ) : (
                  <XCircle className="size-3 mr-1" />
                )}
                Cancel
              </Button>
            </div>
          </div>

          <progress
            className="progress progress-primary w-full"
            value={progress}
            max={100}
          />

          <div className="flex items-center justify-between text-sm">
            {isLighthousePhase ? (
              <span>
                {lighthouseDone} / {status.lighthouseTotal} checks
                {status.lighthouseFailed > 0
                  ? ` (${status.lighthouseFailed} failed)`
                  : ""}
              </span>
            ) : (
              <span>
                {status.pagesCrawled} / {status.pagesTotal} pages
              </span>
            )}
            <div className="flex items-center gap-3">
              {/* H-AUDIT-01: Estimated time remaining */}
              {estimatedTime && (
                <span className="text-muted-foreground text-xs-safe flex items-center gap-1">
                  <Clock className="size-3" />
                  {estimatedTime}
                </span>
              )}
              <span className="text-muted-foreground">{progress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {crawledUrls.length > 0 && (
        <Card>
          <CardContent className="gap-2 p-4">
            <h3 className="text-sm font-medium text-foreground/70">
              Crawled Pages ({crawledUrls.length})
            </h3>
            <p className="text-xs-safe text-foreground/50">
              Updated {new Date(crawledUrls[0].crawledAt).toLocaleTimeString()}
            </p>
            <div className="max-h-[400px] overflow-y-auto -mx-1">
              {crawledUrls.map((entry, i) => (
                <ProgressRow
                  key={`${entry.url}-${entry.crawledAt}`}
                  entry={entry}
                  index={i}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProgressRow({
  entry,
  index,
}: {
  entry: {
    url: string;
    statusCode: number | null;
    title: string | null;
    crawledAt: number;
  };
  index: number;
}) {
  const pathname = extractPathname(entry.url);

  return (
    <div
      className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded text-sm ${
        index === 0
          ? "bg-primary/5 animate-in fade-in slide-in-from-top-1 duration-300"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <HttpStatusBadge code={entry.statusCode} />
        <span className="truncate text-foreground/80" title={entry.url}>
          {pathname}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {entry.title && (
          <span
            className="text-xs-safe text-foreground/40 truncate max-w-[260px] hidden md:block"
            title={entry.title}
          >
            {entry.title}
          </span>
        )}
      </div>
    </div>
  );
}
