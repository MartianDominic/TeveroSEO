"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Play, Trash2, Eye } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import {
  startAudit,
  getAuditStatus,
  getAuditResults,
  getAuditHistory,
  getCrawlProgress,
  deleteAudit,
} from "@/actions/seo/audit";
import {
  StatusBadge,
  HttpStatusBadge,
} from "@/components/seo/audit/StatusBadge";
import {
  extractHostname,
  extractPathname,
  formatStartedAt,
  SUPPORT_URL,
} from "@/lib/seo/shared";

interface AuditStatus {
  status: string;
  pagesCrawled: number;
  pagesTotal: number;
  lighthouseTotal: number;
  lighthouseCompleted: number;
  lighthouseFailed: number;
  currentPhase: string | null;
  startUrl: string;
  startedAt: string;
}

interface CrawlProgressEntry {
  url: string;
  statusCode: number | null;
  title: string | null;
  crawledAt: number;
}

export default function SiteAuditPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clientId, projectId } = params;
  const auditId = searchParams.get("auditId");
  const tab = searchParams.get("tab") ?? "overview";

  const setSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      router.replace(`?${newParams.toString()}`);
    },
    [router, searchParams]
  );

  if (!auditId) {
    return (
      <LaunchView
        projectId={projectId}
        clientId={clientId}
        onAuditStarted={(id) => setSearchParams({ auditId: id })}
      />
    );
  }

  return (
    <AuditDetail
      projectId={projectId}
      clientId={clientId}
      auditId={auditId}
      tab={tab}
      setSearchParams={setSearchParams}
      onBack={() => setSearchParams({ auditId: undefined })}
    />
  );
}

// ---------------------------------------------------------------------------
// LaunchView
// ---------------------------------------------------------------------------

function LaunchView({
  projectId,
  clientId,
  onAuditStarted,
}: {
  projectId: string;
  clientId: string;
  onAuditStarted: (auditId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [startUrl, setStartUrl] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [lighthouseStrategy, setLighthouseStrategy] = useState("mobile");

  const historyQuery = useQuery({
    queryKey: ["audit-history", projectId, clientId],
    queryFn: () => getAuditHistory({ projectId, clientId }),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      startAudit({
        projectId,
        clientId,
        startUrl,
        maxPages: parseInt(maxPages, 10),
        lighthouseStrategy,
      }),
    onSuccess: (result) => {
      if (result.auditId) {
        onAuditStarted(result.auditId);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (auditId: string) => deleteAudit({ projectId, clientId, auditId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-history"] });
    },
  });

  const history = (historyQuery.data as Array<{
    id: string;
    startUrl: string;
    status: string;
    startedAt: string;
    pagesCrawled: number;
  }>) ?? [];

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold">Site Audit</h1>

        {/* Launch Form */}
        <Card>
          <CardHeader>
            <CardTitle>Start New Audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="startUrl">Website URL</Label>
              <Input
                id="startUrl"
                type="url"
                placeholder="https://example.com"
                value={startUrl}
                onChange={(e) => setStartUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxPages">Max Pages</Label>
                <Select value={maxPages} onValueChange={setMaxPages}>
                  <SelectTrigger id="maxPages">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 pages</SelectItem>
                    <SelectItem value="25">25 pages</SelectItem>
                    <SelectItem value="50">50 pages</SelectItem>
                    <SelectItem value="100">100 pages</SelectItem>
                    <SelectItem value="250">250 pages</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lighthouseStrategy">Lighthouse Strategy</Label>
                <Select
                  value={lighthouseStrategy}
                  onValueChange={setLighthouseStrategy}
                >
                  <SelectTrigger id="lighthouseStrategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="none">Skip Lighthouse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => startMutation.mutate()}
              disabled={!startUrl || startMutation.isPending}
            >
              {startMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Audit
                </>
              )}
            </Button>

            {startMutation.isError && (
              <p className="text-sm text-red-600">
                Failed to start audit. Please try again.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Audit History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Audits</CardTitle>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No audits yet. Start your first audit above.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((audit) => (
                  <div
                    key={audit.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">
                        {extractHostname(audit.startUrl)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatStartedAt(audit.startedAt)} &middot;{" "}
                        {audit.pagesCrawled} pages
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={audit.status} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAuditStarted(audit.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(audit.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuditDetail
// ---------------------------------------------------------------------------

function AuditDetail({
  projectId,
  clientId,
  auditId,
  tab,
  setSearchParams,
  onBack,
}: {
  projectId: string;
  clientId: string;
  auditId: string;
  tab: string;
  setSearchParams: (updates: Record<string, string | undefined>) => void;
  onBack: () => void;
}) {
  const statusQuery = useQuery({
    queryKey: ["audit-status", projectId, auditId],
    queryFn: () => getAuditStatus({ projectId, clientId, auditId }),
    refetchInterval: (query) => {
      const data = query.state.data as AuditStatus | undefined;
      return data?.status === "running" ? 3000 : false;
    },
  });

  const isComplete = statusQuery.data?.status === "completed";
  const isFailed = statusQuery.data?.status === "failed";
  const isRunning = statusQuery.data?.status === "running";

  const resultsQuery = useQuery({
    queryKey: ["audit-results", projectId, auditId],
    queryFn: () => getAuditResults({ projectId, clientId, auditId }),
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
          <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5" />
            <span>
              We could not load this audit. It may have been deleted.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            &larr; Back to audits
          </Button>
        </div>
      </div>
    );
  }

  const status = statusQuery.data as AuditStatus;
  const showSupportCta =
    isFailed || (isComplete && status && status.pagesCrawled <= 1);

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="px-0" onClick={onBack}>
            &larr; All audits
          </Button>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Site Audit</h1>
            {status?.status !== "running" && status && (
              <StatusBadge status={status.status} />
            )}
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
            clientId={clientId}
            auditId={auditId}
            status={status}
          />
        )}

        {showSupportCta && (
          <div
            className={`flex items-start gap-3 p-4 rounded-lg ${
              isFailed
                ? "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                : "bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300"
            }`}
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">
                Site audit couldn&apos;t fully crawl this website.
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
                and we&apos;ll help configure auditing for your site.
              </p>
            </div>
          </div>
        )}

        {isComplete && resultsQuery.data ? (
          <ResultsView
            projectId={projectId}
            clientId={clientId}
            data={resultsQuery.data}
            tab={tab}
            setSearchParams={setSearchParams}
          />
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressCard
// ---------------------------------------------------------------------------

function ProgressCard({
  projectId,
  clientId,
  auditId,
  status,
}: {
  projectId: string;
  clientId: string;
  auditId: string;
  status: AuditStatus;
}) {
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

  const crawlProgressQuery = useQuery({
    queryKey: ["audit-crawl-progress", projectId, auditId],
    queryFn: () => getCrawlProgress({ projectId, clientId, auditId }),
    refetchInterval: 1500,
  });

  const crawledUrls = (crawlProgressQuery.data ?? []) as CrawlProgressEntry[];

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {isLighthousePhase
                ? "Running Lighthouse checks"
                : "Crawling pages"}
            </h2>
            <Badge variant="secondary">{phaseLabel}</Badge>
          </div>

          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

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
            <span className="text-muted-foreground">{progress}%</span>
          </div>
        </CardContent>
      </Card>

      {crawledUrls.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground/70">
              Crawled Pages ({crawledUrls.length})
            </h3>
            <p className="text-xs text-foreground/50">
              Updated {new Date(crawledUrls[0].crawledAt).toLocaleTimeString()}
            </p>
            <div className="max-h-[400px] overflow-y-auto -mx-1">
              {crawledUrls.map((entry, i) => (
                <div
                  key={`${entry.url}-${entry.crawledAt}`}
                  className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded text-sm ${
                    i === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <HttpStatusBadge code={entry.statusCode} />
                    <span
                      className="truncate text-foreground/80"
                      title={entry.url}
                    >
                      {extractPathname(entry.url)}
                    </span>
                  </div>
                  {entry.title && (
                    <span
                      className="text-xs text-foreground/40 truncate max-w-[260px] hidden md:block"
                      title={entry.title}
                    >
                      {entry.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultsView (Simplified)
// ---------------------------------------------------------------------------

function ResultsView({
  projectId,
  clientId,
  data,
  tab,
  setSearchParams,
}: {
  projectId: string;
  clientId: string;
  data: unknown;
  tab: string;
  setSearchParams: (updates: Record<string, string | undefined>) => void;
}) {
  const results = data as {
    summary?: {
      pagesScanned: number;
      issuesFound: number;
      lighthouseAvg?: {
        performance: number | null;
        accessibility: number | null;
        bestPractices: number | null;
        seo: number | null;
      };
    };
    pages?: Array<{
      url: string;
      statusCode: number;
      title: string | null;
      issues: number;
    }>;
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {results.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pages Scanned
              </p>
              <p className="text-2xl font-semibold">
                {results.summary.pagesScanned}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Issues Found
              </p>
              <p className="text-2xl font-semibold text-red-600">
                {results.summary.issuesFound}
              </p>
            </CardContent>
          </Card>
          {results.summary.lighthouseAvg && (
            <>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Performance
                  </p>
                  <p className="text-2xl font-semibold">
                    {results.summary.lighthouseAvg.performance ?? "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    SEO Score
                  </p>
                  <p className="text-2xl font-semibold">
                    {results.summary.lighthouseAvg.seo ?? "-"}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Pages Table */}
      {results.pages && results.pages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Crawled Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {results.pages.slice(0, 50).map((page) => (
                <div
                  key={page.url}
                  className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <HttpStatusBadge code={page.statusCode} />
                    <span className="truncate text-sm" title={page.url}>
                      {extractPathname(page.url)}
                    </span>
                  </div>
                  {page.issues > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {page.issues} issues
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
