"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClientStore } from "@/stores/clientStore";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  Button,
  CmsHealthBadge,
  ErrorBanner,
  PageHeader,
  Skeleton,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";
import {
  FileText,
  Calendar,
  Brain,
  Settings,
  PlusCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWordCount(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + "k";
  }
  return n.toString();
}

// ---------------------------------------------------------------------------
// StatCard — clean card, no icon backgrounds
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subtitle }) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1.5 text-2xl font-semibold text-foreground">{value}</p>
    {subtitle && (
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// ClientDashboardPage
// ---------------------------------------------------------------------------

type IntelligenceStatus = "not_started" | "in_progress" | "completed" | "failed";

export default function ClientDashboardPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

  const { activeClient, setActiveClient, clients } = useClientStore();
  const {
    analytics,
    publishingLogs,
    loading,
    logsLoading,
    error,
    fetchAnalytics,
    fetchPublishingLogs,
  } = useAnalyticsStore();

  const [intelligenceStatus, setIntelligenceStatus] =
    useState<IntelligenceStatus>("not_started");

  // Sync store when navigating directly to a client URL
  useEffect(() => {
    if (clientId !== undefined && activeClient?.id !== clientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClient?.id, setActiveClient]);

  // Fetch analytics and publishing logs whenever client changes
  useEffect(() => {
    if (clientId !== undefined) {
      fetchAnalytics(clientId);
      fetchPublishingLogs(clientId);
    }
  }, [clientId, fetchAnalytics, fetchPublishingLogs]);

  // Fetch intelligence status on mount / client change
  useEffect(() => {
    if (!clientId) return;
    apiGet<{ scrape_status?: string }>(
      `/api/client-intelligence/${clientId}`
    )
      .then((data) => {
        setIntelligenceStatus(
          (data.scrape_status as IntelligenceStatus) ?? "not_started"
        );
      })
      .catch(() => setIntelligenceStatus("not_started"));
  }, [clientId]);

  // Poll every 5s while in_progress
  useEffect(() => {
    if (intelligenceStatus !== "in_progress" || !clientId) return;
    const interval = setInterval(() => {
      apiGet<{ scrape_status?: string }>(
        `/api/client-intelligence/${clientId}`
      )
        .then((data) => {
          setIntelligenceStatus(
            (data.scrape_status as IntelligenceStatus) ?? "not_started"
          );
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [intelligenceStatus, clientId]);

  const triggerScrape = useCallback(() => {
    if (!clientId) return;
    setIntelligenceStatus("in_progress");
    apiPost(`/api/client-intelligence/${clientId}/scrape`, {}).catch(() =>
      setIntelligenceStatus("failed")
    );
  }, [clientId]);

  const displayClient =
    activeClient ?? clients.find((c) => c.id === clientId) ?? null;

  // Determine if per-client checklist should be shown.
  const hasPublishedArticles =
    analytics !== null && analytics.articles_published_this_month > 0;
  const showChecklist =
    intelligenceStatus !== "completed" || !hasPublishedArticles;

  return (
    <div className="p-8 md:p-10 space-y-8">
      {/* Header */}
      <PageHeader
        title={displayClient?.name ?? "Dashboard"}
        subtitle={displayClient?.website_url ?? undefined}
        backHref="/clients"
        actions={
          analytics ? (
            <CmsHealthBadge lastPublishedAt={analytics.last_published_at} />
          ) : undefined
        }
      />

      {/* Intelligence status banner */}
      {intelligenceStatus === "in_progress" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Gathering intelligence...
            </p>
            <p className="text-xs text-muted-foreground">
              Analysing website, extracting brand voice and keyword
              opportunities. Usually takes 30–90 seconds.
            </p>
          </div>
        </div>
      )}

      {intelligenceStatus === "failed" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Intelligence gathering failed
            </p>
            <p className="text-xs text-muted-foreground">
              Check that BrightData and DataForSEO are configured in Global
              Settings.
            </p>
          </div>
          <button
            onClick={triggerScrape}
            className="ml-auto shrink-0 text-xs text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {intelligenceStatus === "not_started" && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Intelligence not gathered yet
            </p>
            <p className="text-xs text-muted-foreground">
              Trigger a scan to extract brand voice, keyword opportunities, and
              competitor insights.
            </p>
          </div>
          <button
            onClick={triggerScrape}
            className="ml-auto shrink-0 text-xs text-primary hover:underline"
          >
            Run now →
          </button>
        </div>
      )}

      {/* Per-client onboarding checklist */}
      {showChecklist && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 text-sm font-semibold text-foreground">
            Client Setup
          </p>
          <div className="space-y-2.5">
            {/* Step 1 — Client added (always done on this page) */}
            <div className="flex items-center gap-2.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ✓
              </span>
              <span className="text-sm text-muted-foreground line-through opacity-60">
                Client added
              </span>
            </div>

            {/* Step 2 — Intelligence gathering */}
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

            {/* Step 3 — Configure CMS publishing */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border" />
                <span className="text-sm text-foreground">
                  Configure CMS publishing
                </span>
              </div>
              <button
                onClick={() => router.push(`/clients/${clientId}/settings` as Parameters<typeof router.push>[0])}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Configure →
              </button>
            </div>

            {/* Step 4 — Publish first article */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border" />
                <span className="text-sm text-foreground">
                  Publish first article
                </span>
              </div>
              <button
                onClick={() => router.push(`/clients/${clientId}/calendar` as Parameters<typeof router.push>[0])}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Open Calendar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {!loading && error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            if (clientId) {
              fetchAnalytics(clientId);
              fetchPublishingLogs(clientId);
            }
          }}
        />
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </>
        ) : analytics ? (
          <>
            <StatCard
              label="Articles Published"
              value={analytics.articles_published_this_month}
              subtitle="this month"
            />
            <StatCard
              label="Total Words"
              value={formatWordCount(analytics.total_word_count_this_month)}
              subtitle="this month"
            />
            <StatCard
              label="Failed Publishes"
              value={analytics.failed_count_this_month}
              subtitle="this month"
            />
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/clients/${clientId}/calendar` as Parameters<typeof router.push>[0])}
        >
          <Calendar className="h-4 w-4" /> View Calendar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/clients/${clientId}/intelligence` as Parameters<typeof router.push>[0])}
        >
          <Brain className="h-4 w-4" /> Website Intelligence
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/clients/${clientId}/settings` as Parameters<typeof router.push>[0])}
        >
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </div>

      {/* Articles section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Articles</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/articles` as Parameters<typeof router.push>[0])}
            >
              <FileText className="h-4 w-4" />
              View All Articles
            </Button>
            <Button
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/articles/new` as Parameters<typeof router.push>[0])}
            >
              <PlusCircle className="h-4 w-4" />
              New Article
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Generate SEO articles in your client&apos;s brand voice. Click
            &ldquo;New Article&rdquo; to get started.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/clients/${clientId}/articles/new` as Parameters<typeof router.push>[0])}
          >
            <PlusCircle className="h-4 w-4" />
            New Article
          </Button>
        </div>
      </div>

      {/* Recent activity */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Recent Activity
        </h2>

        {logsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : publishingLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-xs">
              No publishing activity yet. Add articles to the content calendar
              to get started.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/clients/${clientId}/calendar` as Parameters<typeof router.push>[0])}
            >
              Open Calendar
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-medium text-muted-foreground">
                    article
                  </TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">
                    date
                  </TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">
                    cms
                  </TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">
                    status
                  </TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">
                    http
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {publishingLogs.slice(0, 10).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {log.article_id.slice(0, 8)}&hellip;
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(log.attempted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.cms_type ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={log.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.http_status_code ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
