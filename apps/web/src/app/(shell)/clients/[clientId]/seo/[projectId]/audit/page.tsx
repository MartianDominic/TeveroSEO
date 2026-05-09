"use client";

import { useCallback, useState, useEffect, useRef } from "react";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Play, Trash2, Eye, FolderX, XCircle, RotateCcw, Clock, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { z } from "zod";

import {
  startAudit,
  getAuditStatus,
  getAuditResults,
  getAuditHistory,
  getCrawlProgress,
  deleteAudit,
  cancelAudit,
  retryAudit,
} from "@/actions/seo/audit";
import { getProject } from "@/actions/seo/projects";
import {
  StatusBadge,
  HttpStatusBadge,
} from "@/components/seo/audit/StatusBadge";
import { calculateAuditRefetchInterval } from "@/hooks/use-audit-polling";
import { logger } from '@/lib/logger';
import { getAdaptiveDelay } from "@/lib/polling/adaptive-poll";
import {
  extractHostname,
  extractPathname,
  formatStartedAt,
  SUPPORT_URL,
} from "@/lib/seo/shared";
import {
  AuditStatusSchema,
  CrawlProgressArraySchema,
  AuditHistoryArraySchema,
  type AuditStatus,
  type CrawlProgressEntry,
  type AuditHistoryEntry,
} from "@/lib/validations/api-response-schemas";

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

// Zod schema for audit results validation
const AuditResultsSchema = z.object({
  summary: z.object({
    pagesScanned: z.number(),
    issuesFound: z.number(),
    lighthouseAvg: z.object({
      performance: z.number().nullable(),
      accessibility: z.number().nullable(),
      bestPractices: z.number().nullable(),
      seo: z.number().nullable(),
    }).optional(),
  }).optional(),
  pages: z.array(z.object({
    url: z.string(),
    statusCode: z.number(),
    title: z.string().nullable(),
    issues: z.number(),
  })).optional(),
  // HIGH-13-02: Check breakdown by category
  findings: z.array(z.object({
    checkId: z.string(),
    tier: z.number(),
    category: z.string(),
    passed: z.boolean(),
    severity: z.string(),
    message: z.string(),
  })).optional(),
});

// MEDIUM-13-01: Pagination constants
const PAGES_PER_PAGE = 25;
import { safeFirst, safeFormatTime } from "@/lib/utils/safe-parse";

export default function SiteAuditPage() {
  const params = useParams<{ clientId: string; projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clientId, projectId } = params;
  const auditId = searchParams.get("auditId");
  const tab = searchParams.get("tab") ?? "overview";

  // Project existence validation state
  const [projectExists, setProjectExists] = useState<boolean | null>(null);

  useEffect(() => {
    async function validateProject() {
      try {
        const result = await getProject({ projectId, clientId });
        setProjectExists(result.success && result.data !== null);
      } catch {
        setProjectExists(false);
      }
    }
    validateProject();
  }, [projectId, clientId]);

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

  // Show loading state while validating project
  if (projectExists === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show error state if project doesn't exist
  if (projectExists === false) {
    return (
      <div className="px-4 py-6 md:px-6">
        <div className="mx-auto max-w-3xl flex flex-col items-center justify-center min-h-[400px] text-center">
          <FolderX className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            The SEO project you are looking for does not exist or you do not have access to it.
          </p>
          <Button onClick={() => router.push(`/clients/${clientId}/seo` as never)}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

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
        lighthouseStrategy: lighthouseStrategy === "none" ? undefined : lighthouseStrategy as "mobile" | "desktop",
      }),
    onSuccess: (result) => {
      if (result.success && result.data.auditId) {
        onAuditStarted(result.data.auditId);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (auditId: string) => deleteAudit({ projectId, clientId, auditId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-history"] });
    },
  });

  const historyData = historyQuery.data;
  const historyRaw = historyData?.success ? historyData.data : [];
  const historyParsed = AuditHistoryArraySchema.safeParse(historyRaw);
  const history: AuditHistoryEntry[] = historyParsed.success ? historyParsed.data : [];

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
                      <p className="text-xs-safe text-muted-foreground">
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
  // FIX-17 HIGH-UJ-04: Use adaptive polling with exponential backoff
  // Replaces fixed 3s interval - starts at 1s, increases to max 30s
  const statusUnchangedCountRef = useRef(0);
  const lastStatusRef = useRef<string | undefined>(undefined);

  const statusQuery = useQuery({
    queryKey: ["audit-status", projectId, auditId],
    queryFn: () => getAuditStatus({ projectId, clientId, auditId }),
    refetchInterval: (query) => {
      const result = query.state.data;
      const data = result?.success ? result.data : undefined;
      const currentStatus = data?.status;

      // Track unchanged responses for backoff calculation
      if (currentStatus === lastStatusRef.current) {
        statusUnchangedCountRef.current += 1;
      } else {
        statusUnchangedCountRef.current = 0;
        lastStatusRef.current = currentStatus;
      }

      // Use adaptive polling with exponential backoff
      return calculateAuditRefetchInterval(
        currentStatus,
        statusUnchangedCountRef.current
      );
    },
  });

  const queryClient = useQueryClient();
  const statusData = statusQuery.data?.success ? statusQuery.data.data : undefined;
  const isComplete = statusData?.status === "completed";
  const isFailed = statusData?.status === "failed";
  const isCancelled = statusData?.status === "cancelled";
  const isRunning = statusData?.status === "running";

  // HIGH-13-01: Cancel mutation for running audits
  const cancelMutation = useMutation({
    mutationFn: () => cancelAudit({ projectId, clientId, auditId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-status", projectId, auditId] });
    },
  });

  // HIGH-13-01: Retry mutation for failed/cancelled audits
  const retryMutation = useMutation({
    mutationFn: () => retryAudit({ projectId, clientId, auditId }),
    onSuccess: (result) => {
      if (result.success && result.data?.auditId) {
        setSearchParams({ auditId: result.data.auditId });
      }
    },
  });

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

  // Validate status data with Zod schema instead of unsafe type assertion
  const statusParsed = statusData ? AuditStatusSchema.safeParse(statusData) : null;
  const status = statusParsed?.success ? statusParsed.data : null;
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
            <div className="flex items-center gap-2">
              {/* HIGH-13-01: Cancel button for running audits */}
              {isRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-3 w-3" />
                  )}
                  Cancel
                </Button>
              )}
              {/* HIGH-13-01: Retry button for failed/cancelled audits */}
              {(isFailed || isCancelled) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                >
                  {retryMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-3 w-3" />
                  )}
                  Retry
                </Button>
              )}
              {status?.status !== "running" && status && (
                <StatusBadge status={status.status} />
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

  // MEDIUM-13-02: Calculate ETA based on progress
  const startTime = new Date(status.startedAt).getTime();
  const elapsedMs = Date.now() - startTime;
  const estimatedEta = (() => {
    if (progress <= 0) return null;
    const totalEstimatedMs = (elapsedMs / progress) * 100;
    const remainingMs = totalEstimatedMs - elapsedMs;
    if (remainingMs <= 0) return "Almost done";
    const remainingMins = Math.ceil(remainingMs / 60000);
    if (remainingMins < 1) return "Less than a minute";
    if (remainingMins === 1) return "About 1 minute";
    return `About ${remainingMins} minutes`;
  })();

  // FIX-17 HIGH-UJ-05: Use adaptive polling for crawl progress
  // Replaces fixed 1.5s interval - starts at 1.5s, increases to max 15s
  const crawlUnchangedCountRef = useRef(0);
  const lastCrawlLengthRef = useRef(0);

  const crawlProgressQuery = useQuery({
    queryKey: ["audit-crawl-progress", projectId, auditId],
    queryFn: () => getCrawlProgress({ projectId, clientId, auditId }),
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const currentLength = Array.isArray(data) ? data.length : 0;

      // Track unchanged responses for backoff
      if (currentLength === lastCrawlLengthRef.current) {
        crawlUnchangedCountRef.current += 1;
      } else {
        crawlUnchangedCountRef.current = 0;
        lastCrawlLengthRef.current = currentLength;
      }

      // Adaptive polling: 1.5s initial, max 15s, 1.3x multiplier
      return getAdaptiveDelay(crawlUnchangedCountRef.current, {
        initialDelayMs: 1500,
        maxDelayMs: 15000,
        backoffMultiplier: 1.3,
        jitterFactor: 0.15,
      });
    },
  });

  const crawlProgressRaw = crawlProgressQuery.data ?? [];
  const crawlProgressParsed = CrawlProgressArraySchema.safeParse(crawlProgressRaw);
  const crawledUrls: CrawlProgressEntry[] = crawlProgressParsed.success ? crawlProgressParsed.data : [];

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
          {/* MEDIUM-13-02: Display ETA */}
          {estimatedEta && (
            <div className="flex items-center gap-1 text-xs-safe text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{estimatedEta} remaining</span>
            </div>
          )}
        </CardContent>
      </Card>

      {crawledUrls.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground/70">
              Crawled Pages ({crawledUrls.length})
            </h3>
            <p className="text-xs-safe text-foreground/50">
              Updated {safeFormatTime(safeFirst(crawledUrls)?.crawledAt)}
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
                      className="text-xs-safe text-foreground/40 truncate max-w-[260px] hidden md:block"
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
  // MEDIUM-13-01: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  // HIGH-13-02: Expanded categories for check breakdown
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Validate audit results with Zod schema instead of unsafe type assertion
  const parsed = AuditResultsSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("Invalid audit results format", { error: parsed.error.message });
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Invalid audit data format. Please try running a new audit.</p>
        </CardContent>
      </Card>
    );
  }
  const results = parsed.data;

  // MEDIUM-13-01: Paginate pages list
  const pages = results.pages ?? [];
  const totalPages = Math.ceil(pages.length / PAGES_PER_PAGE);
  const paginatedPages = pages.slice(
    (currentPage - 1) * PAGES_PER_PAGE,
    currentPage * PAGES_PER_PAGE
  );

  // HIGH-13-02: Group findings by category
  const findings = results.findings ?? [];
  const findingsByCategory = findings.reduce((acc, finding) => {
    const cat = finding.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(finding);
    return acc;
  }, {} as Record<string, typeof findings>);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      {results.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                Pages Scanned
              </p>
              <p className="text-2xl font-semibold">
                {results.summary.pagesScanned}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
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
                  <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
                    Performance
                  </p>
                  <p className="text-2xl font-semibold">
                    {results.summary.lighthouseAvg.performance ?? "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs-safe uppercase tracking-wide text-muted-foreground">
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

      {/* HIGH-13-02: Check Breakdown by Category (109 checks) */}
      {findings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SEO Check Results ({findings.length} checks)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(findingsByCategory).map(([category, catFindings]) => {
              const passedCount = catFindings.filter((f) => f.passed).length;
              const failedCount = catFindings.length - passedCount;
              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category} className="border rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs-safe">
                        {passedCount} passed
                      </Badge>
                      {failedCount > 0 && (
                        <Badge variant="destructive" className="text-xs-safe">
                          {failedCount} failed
                        </Badge>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t px-3 py-2 space-y-1">
                      {catFindings.map((finding) => (
                        <div
                          key={finding.checkId}
                          className="flex items-start justify-between py-1.5 text-sm"
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {finding.passed ? (
                              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs-safe shrink-0">
                                Pass
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs-safe shrink-0">
                                {finding.severity}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">{finding.message}</span>
                          </div>
                          <span className="text-xs-safe text-muted-foreground shrink-0 ml-2">
                            Tier {finding.tier}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Pages Table with MEDIUM-13-01: Pagination */}
      {pages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Crawled Pages ({pages.length})</CardTitle>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {paginatedPages.map((page) => (
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
                    <Badge variant="destructive" className="text-xs-safe">
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
