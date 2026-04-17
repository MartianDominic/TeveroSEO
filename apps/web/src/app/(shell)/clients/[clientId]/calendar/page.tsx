"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "@/styles/calendar.css";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Upload, X, Loader2, ChevronRight, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { StatusChip } from "@/components/ui/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { useContentCalendarStore, Article } from "@/stores/contentCalendarStore";
import { useClientStore } from "@/stores/clientStore";
import { apiPost } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// date-fns localizer — enUS named export from file path (date-fns v4 pattern)
// ---------------------------------------------------------------------------
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: enUS }),
  getDay,
  locales,
});

// ---------------------------------------------------------------------------
// Status types and display maps
// ---------------------------------------------------------------------------
export type ArticleStatus = Article["status"];

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "Draft",
  generating: "Generating",
  generated: "Generated",
  pending_review: "Pending Review",
  approved: "Approved",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};

// react-big-calendar requires inline style colors — not className
const STATUS_HEX: Record<ArticleStatus, string> = {
  draft: "#71717a", // zinc-500
  generating: "#0ea5e9", // sky-500
  generated: "#6366f1", // indigo-500
  pending_review: "#f59e0b", // amber-500
  approved: "#10b981", // emerald-500
  publishing: "#3b82f6", // blue-500
  published: "#16a34a", // green-600
  failed: "#dc2626", // red-600
};

// All statuses in display order for the legend
const ARTICLE_STATUSES: ArticleStatus[] = [
  "draft",
  "generating",
  "generated",
  "pending_review",
  "approved",
  "publishing",
  "published",
  "failed",
];

// ---------------------------------------------------------------------------
// CalendarEvent type for react-big-calendar
// ---------------------------------------------------------------------------
interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Article;
}

// ---------------------------------------------------------------------------
// ArticleDetailSheet — right-side panel using Radix Dialog primitives
// ---------------------------------------------------------------------------
interface ArticleDetailSheetProps {
  article: Article | null;
  onClose: () => void;
  actionLoading: Record<string, boolean>;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onSubmitReview: (id: string) => Promise<void>;
  onGenerate: (id: string) => Promise<void>;
}

function ArticleDetailSheet({
  article,
  onClose,
  actionLoading,
  onApprove,
  onReject,
  onSubmitReview,
  onGenerate,
}: ArticleDetailSheetProps) {
  const isLoading = article ? (actionLoading[article.id] ?? false) : false;

  return (
    <DialogPrimitive.Root
      open={!!article}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed right-0 top-0 z-50 h-full w-[380px] bg-card border-l border-border p-6 shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "duration-300 overflow-y-auto focus:outline-none"
          )}
        >
          {/* Accessible title (visually hidden) */}
          <DialogPrimitive.Title className="sr-only">
            Article Detail
          </DialogPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
            <h2 className="text-base font-semibold text-foreground">
              Article Detail
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors rounded p-0.5"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {article && (
            <div className="space-y-4">
              {/* Title */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Title
                </p>
                <p className="text-sm text-foreground leading-snug">
                  {article.title}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Status
                </p>
                <StatusChip
                  status={article.status}
                  label={STATUS_LABEL[article.status]}
                />
              </div>

              {/* Keyword */}
              {article.keyword && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Keyword
                  </p>
                  <p className="text-sm text-foreground">{article.keyword}</p>
                </div>
              )}

              {/* Publish Date */}
              {article.publish_date && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Scheduled Publish Date
                  </p>
                  <p className="text-sm text-foreground">
                    {new Date(article.publish_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Published At */}
              {article.published_at && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Published At
                  </p>
                  <p className="text-sm text-foreground">
                    {new Date(article.published_at).toLocaleString()}
                  </p>
                </div>
              )}

              {/* CMS Post URL */}
              {article.cms_post_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Published URL
                  </p>
                  <a
                    href={article.cms_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View post <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Error Detail */}
              {article.error_detail && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Error
                  </p>
                  <p className="text-sm text-muted-foreground break-words">
                    {article.error_detail}
                  </p>
                </div>
              )}

              {/* Retry Count */}
              {article.retry_count > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Retry Count
                  </p>
                  <p className="text-sm text-foreground">
                    {article.retry_count}
                  </p>
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Context-sensitive action buttons */}
              <div className="space-y-2">
                {article.status === "draft" && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isLoading}
                    onClick={() => onGenerate(article.id)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Generate Article
                  </Button>
                )}
                {article.status === "generated" && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={isLoading}
                    onClick={() => onSubmitReview(article.id)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Submit for Review
                  </Button>
                )}
                {article.status === "pending_review" && (
                  <>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={isLoading}
                      onClick={() => onApprove(article.id)}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={isLoading}
                      onClick={() => onReject(article.id)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {article.status === "failed" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={isLoading}
                    onClick={() => onGenerate(article.id)}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    Retry Generation
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// CsvImportDialog — uses shadcn Dialog primitive
// ---------------------------------------------------------------------------
interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onSuccess: () => void;
}

function CsvImportDialog({
  open,
  onClose,
  clientId,
  onSuccess,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setFile(null);
    setDryRun(false);
    setResult(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dry_run", String(dryRun));

      // Multipart form data — use fetch directly (apiPost sends JSON)
      const res = await fetch(`/api/clients/${clientId}/import-csv`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Import failed: ${res.status}`);
      }

      const data = (await res.json()) as {
        imported?: number;
        skipped?: number;
        message?: string;
      };
      const msg =
        data.message ??
        `Imported: ${data.imported ?? 0}, Skipped: ${data.skipped ?? 0}`;
      setResult(msg);

      if (!dryRun) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Import failed. Please check your CSV format.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md bg-card border border-border rounded-lg p-6">
        {/* DialogTitle for accessibility */}
        <DialogPrimitive.Title className="text-base font-semibold text-foreground mb-1">
          Import Articles from CSV
        </DialogPrimitive.Title>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file with article data. Enable dry run to preview without
          importing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              CSV File
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
              <Upload className="h-4 w-4" />
              <span>{file ? file.name : "Choose file…"}</span>
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {/* Dry run checkbox */}
          <div className="flex items-center gap-2">
            <input
              id="dry-run"
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <label
              htmlFor="dry-run"
              className="text-sm text-foreground cursor-pointer"
            >
              Dry run (preview only — no changes saved)
            </label>
          </div>

          {/* Result feedback */}
          {result && (
            <div className="flex items-center gap-2">
              <StatusChip status="success" label="Import complete" />
              <span className="text-xs text-muted-foreground">{result}</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2">
              <StatusChip status="error" label="Import failed" />
              <span className="text-xs text-muted-foreground">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!file || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : dryRun ? (
                "Preview"
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// ContentCalendarPage — main component
// ---------------------------------------------------------------------------
export default function ContentCalendarPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { activeClientId } = useClientStore();
  const {
    articles,
    loading,
    error,
    fetchArticles,
    fetchPendingReview,
    approveArticle,
    rejectArticle,
    submitForReview,
    generateArticle,
  } = useContentCalendarStore();

  const effectiveClientId = clientId ?? activeClientId;

  const [tab, setTab] = useState<0 | 1>(0);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [pendingReview, setPendingReview] = useState<Article[]>([]);
  const [csvOpen, setCsvOpen] = useState(false);

  // Fetch articles when clientId changes
  useEffect(() => {
    if (effectiveClientId) {
      fetchArticles(effectiveClientId);
    }
  }, [effectiveClientId, fetchArticles]);

  // Fetch pending review articles when pipeline tab is active
  useEffect(() => {
    if (tab === 1) {
      fetchPendingReview().then((arts) => setPendingReview(arts));
    }
  }, [tab, fetchPendingReview]);

  // Build calendar events from articles with publish_date
  const calendarEvents: CalendarEvent[] = articles
    .filter((a) => a.publish_date)
    .map((a) => {
      const date = new Date(a.publish_date as string);
      return { title: a.title, start: date, end: date, resource: a };
    });

  // makeAction wraps async store actions with per-article loading state
  const makeAction = useCallback(
    (action: (id: string) => Promise<void>, refreshPipeline = false) =>
      async (id: string) => {
        setActionLoading((prev) => ({ ...prev, [id]: true }));
        try {
          await action(id);
          setSelectedArticle(null);
          if (refreshPipeline && effectiveClientId) {
            const arts = await fetchPendingReview();
            setPendingReview(arts);
          }
        } finally {
          setActionLoading((prev) => ({ ...prev, [id]: false }));
        }
      },
    [effectiveClientId, fetchPendingReview]
  );

  const handleApprove = makeAction(approveArticle, true);
  const handleReject = makeAction(rejectArticle, true);
  const handleSubmitReview = makeAction(submitForReview);
  const handleGenerate = makeAction(generateArticle);

  // eventPropGetter — react-big-calendar requires inline style for colors
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const article = event.resource;
    const bg = STATUS_HEX[article.status] ?? "#71717a";
    return {
      style: {
        backgroundColor: bg,
        borderColor: bg,
        color: "#ffffff",
        borderRadius: "4px",
        border: "none",
        fontSize: "11px",
        padding: "2px 5px",
        opacity: article.status === "publishing" ? 0.85 : 1,
      },
    };
  }, []);

  // No-client state
  if (!effectiveClientId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-lg font-semibold text-foreground">
          Content Calendar
        </p>
        <p className="text-sm text-muted-foreground">
          Select a client to view the content calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Page header */}
      <PageHeader
        title="Content Calendar"
        subtitle="Schedule, review, and publish articles for this client."
        actions={
          <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        <button
          onClick={() => setTab(0)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
            tab === 0
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Calendar View
        </button>
        <button
          onClick={() => setTab(1)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
            tab === 1
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Approval Pipeline
        </button>
      </div>

      {/* Calendar tab */}
      {tab === 0 && (
        <div className="space-y-4">
          {/* Status legend */}
          <div className="flex flex-wrap gap-2">
            {ARTICLE_STATUSES.map((s) => (
              <StatusChip key={s} status={s} label={STATUS_LABEL[s]} />
            ))}
          </div>

          {/* Error banner */}
          {!loading && error && (
            <ErrorBanner
              message={error}
              onRetry={() =>
                effectiveClientId && fetchArticles(effectiveClientId)
              }
            />
          )}

          {/* Calendar */}
          <div className="rounded-lg border border-border bg-card p-4">
            {loading ? (
              <Skeleton className="h-96 w-full rounded-lg" />
            ) : !error && calendarEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
                <CalendarOff className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  No articles scheduled
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Add articles to the calendar by importing a CSV or creating
                  new articles.
                </p>
              </div>
            ) : !error ? (
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                style={{ height: 600 }}
                eventPropGetter={eventPropGetter}
                onSelectEvent={(event: CalendarEvent) =>
                  setSelectedArticle(event.resource)
                }
                views={["month", "week", "agenda"]}
                defaultView="month"
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Pipeline tab */}
      {tab === 1 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {pendingReview.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No articles pending review
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">
                    Keyword
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground hidden md:table-cell">
                    Scheduled
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingReview.map((article) => {
                  const isLoadingRow = actionLoading[article.id] ?? false;
                  return (
                    <tr
                      key={article.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedArticle(article)}
                    >
                      <td className="px-4 py-3 text-sm text-foreground line-clamp-1 max-w-[240px]">
                        {article.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                        {article.keyword ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                        {article.publish_date
                          ? new Date(article.publish_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={isLoadingRow}
                            onClick={() => handleApprove(article.id)}
                          >
                            {isLoadingRow ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Approve"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoadingRow}
                            onClick={() => handleReject(article.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Article Detail Sheet */}
      <ArticleDetailSheet
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        actionLoading={actionLoading}
        onApprove={handleApprove}
        onReject={handleReject}
        onSubmitReview={handleSubmitReview}
        onGenerate={handleGenerate}
      />

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        clientId={effectiveClientId}
        onSuccess={() => {
          setCsvOpen(false);
          fetchArticles(effectiveClientId);
        }}
      />
    </div>
  );
}
