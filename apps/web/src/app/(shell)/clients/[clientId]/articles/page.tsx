"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  PlusCircle,
  FileText,
  Hash,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useArticleLibraryStore } from "@/stores";
import type { Article, SortField, SortDir } from "@/stores";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// RankSnapshot type
// ---------------------------------------------------------------------------

interface RankSnapshot {
  id: string;
  article_id: string;
  keyword: string;
  position: number | null;
  search_volume: number | null;
  url: string | null;
  checked_at: string;
}

// ---------------------------------------------------------------------------
// Status options for filter dropdown
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "generating", label: "Generating" },
  { value: "generated", label: "Generated" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "publishing", label: "Publishing" },
  { value: "published", label: "Published" },
  { value: "failed", label: "Failed" },
];

function articleStatusToChip(status: string): string {
  if (status === "generated") return "scheduled";
  return status;
}

function articleStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    generating: "Generating",
    generated: "Generated",
    pending_review: "Pending Review",
    approved: "Approved",
    publishing: "Publishing",
    published: "Published",
    failed: "Failed",
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function sortArticles(articles: Article[], field: SortField, dir: SortDir): Article[] {
  return [...articles].sort((a, b) => {
    let aVal: string | null;
    let bVal: string | null;

    if (field === "title") {
      aVal = a.title;
      bVal = b.title;
    } else if (field === "status") {
      aVal = a.status;
      bVal = b.status;
    } else if (field === "publish_date") {
      aVal = a.publish_date ?? null;
      bVal = b.publish_date ?? null;
    } else {
      aVal = a.created_at;
      bVal = b.created_at;
    }

    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return dir === "asc" ? cmp : -cmp;
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// SortHeader component
// ---------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}

const SortHeader: React.FC<SortHeaderProps> = ({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}) => {
  const isActive = currentField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
    >
      {label}
      <span className="flex flex-col h-3">
        {isActive ? (
          currentDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-foreground" />
          )
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// RankBadge — colored position badge with tier styling
// ---------------------------------------------------------------------------

interface RankBadgeProps {
  position: number | null | undefined;
}

const RankBadge: React.FC<RankBadgeProps> = ({ position }) => {
  if (position === null || position === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  let badgeClass: string;
  if (position <= 3) {
    badgeClass = "bg-emerald-100 text-emerald-700";
  } else if (position <= 10) {
    badgeClass = "bg-amber-100 text-amber-700";
  } else if (position <= 20) {
    badgeClass = "bg-blue-100 text-blue-700";
  } else {
    badgeClass = "bg-muted text-muted-foreground";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        badgeClass
      )}
    >
      <Hash className="h-3 w-3" />
      #{position}
    </span>
  );
};

// ---------------------------------------------------------------------------
// RankSparklineRow — inline expanded row with position-over-time chart
// ---------------------------------------------------------------------------

interface RankSparklineRowProps {
  colSpan: number;
  snapshots: RankSnapshot[];
  loading: boolean;
}

const SPARKLINE_CONFIG = {
  position: { label: "Position", color: "hsl(var(--primary))" },
};

const RankSparklineRow: React.FC<RankSparklineRowProps> = ({
  colSpan,
  snapshots,
  loading,
}) => {
  const chartData = useMemo(
    () =>
      snapshots
        .filter((s) => s.position !== null)
        .map((s) => ({
          date: formatShortDate(s.checked_at),
          position: s.position as number,
        })),
    [snapshots]
  );

  const validSnapshotCount = snapshots.filter((s) => s.position !== null).length;

  const positions = chartData.map((d) => d.position);
  const minPos = positions.length > 0 ? Math.min(...positions) : 1;
  const maxPos = positions.length > 0 ? Math.max(...positions) : 10;
  const yDomain: [number, number] = [
    Math.max(1, maxPos + 2),
    Math.max(1, minPos - 2),
  ];

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={colSpan} className="py-3 px-6">
        {loading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading rank history...</span>
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No ranking data yet.</p>
        ) : validSnapshotCount < 2 ? (
          <p className="text-sm text-muted-foreground py-2">Only one check recorded — check back later for trend data.</p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground font-medium">
              Rank position over time — lower is better
            </p>
            <ChartContainer config={SPARKLINE_CONFIG} className="h-[200px]">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={yDomain}
                  reversed={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tickFormatter={(v: number) => `#${v}`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                />
                <Line
                  type="monotone"
                  dataKey="position"
                  name="Position"
                  stroke="var(--color-position)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-position)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};

// ---------------------------------------------------------------------------
// ArticleLibraryPage
// ---------------------------------------------------------------------------

const TOTAL_COLUMNS = 9;

export default function ArticleLibraryPage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;
  const router = useRouter();

  const {
    articles,
    loading,
    error,
    statusFilter,
    sortField,
    sortDir,
    selectedIds,
    fetchArticles,
    setStatusFilter,
    setSort,
    toggleSelect,
    selectAll,
    clearSelection,
  } = useArticleLibraryStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [rankHistory, setRankHistory] = useState<Record<string, RankSnapshot[]>>({});
  const [expandedRankId, setExpandedRankId] = useState<string | null>(null);
  const [rankLoading, setRankLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (clientId) {
      fetchArticles(clientId, statusFilter || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, statusFilter]);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    clearSelection();
    if (clientId) {
      fetchArticles(clientId, value || undefined);
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = articles;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.keyword ?? "").toLowerCase().includes(q)
      );
    }
    return sortArticles(result, sortField, sortDir);
  }, [articles, searchQuery, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSort(field, sortDir === "asc" ? "desc" : "asc");
    } else {
      setSort(field, "asc");
    }
  };

  const allVisibleIds = filteredAndSorted.map((a) => a.id);
  const allSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.has(id));

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(allVisibleIds);
    }
  };

  // ---------------------------------------------------------------------------
  // Rank history expand/collapse
  // ---------------------------------------------------------------------------

  const handleToggleRank = async (article: Article) => {
    if (article.status !== "published") return;

    if (expandedRankId === article.id) {
      setExpandedRankId(null);
      return;
    }

    setExpandedRankId(article.id);

    if (rankHistory[article.id] !== undefined) return;
    if (!clientId) return;

    setRankLoading((prev) => ({ ...prev, [article.id]: true }));
    try {
      const snapshots = await apiGet<RankSnapshot[]>(
        `/api/clients/${clientId}/articles/${article.id}/rank-history`
      );
      const sorted = Array.isArray(snapshots)
        ? [...snapshots].sort(
            (a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime()
          )
        : [];
      setRankHistory((prev) => ({ ...prev, [article.id]: sorted }));
    } catch {
      setRankHistory((prev) => ({ ...prev, [article.id]: [] }));
    } finally {
      setRankLoading((prev) => ({ ...prev, [article.id]: false }));
    }
  };

  const getLatestPosition = (articleId: string): number | null => {
    const snapshots = rankHistory[articleId];
    if (!snapshots || snapshots.length === 0) return null;
    const withPosition = snapshots.filter((s) => s.position !== null);
    if (withPosition.length === 0) return null;
    return withPosition[withPosition.length - 1].position;
  };

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const selectedArticles = filteredAndSorted.filter((a) => selectedIds.has(a.id));
  const generateCandidates = selectedArticles.filter(
    (a) => a.status === "draft" || a.status === "failed"
  );
  const approveCandidates = selectedArticles.filter(
    (a) => a.status === "pending_review"
  );

  const handleBulkGenerate = async () => {
    if (!clientId || generateCandidates.length === 0) return;
    setBulkLoading(true);
    try {
      for (const article of generateCandidates) {
        await apiPost(
          `/api/articles/${article.id}/generate?client_id=${clientId}`,
          {}
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      setBulkLoading(false);
      clearSelection();
      if (clientId) {
        fetchArticles(clientId, statusFilter || undefined);
      }
    }
  };

  const handleBulkApprove = async () => {
    if (!clientId || approveCandidates.length === 0) return;
    setBulkLoading(true);
    try {
      for (const article of approveCandidates) {
        await apiPost(`/api/articles/${article.id}/approve`, {});
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } finally {
      setBulkLoading(false);
      clearSelection();
      if (clientId) {
        fetchArticles(clientId, statusFilter || undefined);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (!clientId || selectedArticles.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedArticles.length} article${selectedArticles.length === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!confirmed) return;
    setBulkLoading(true);
    try {
      for (const article of selectedArticles) {
        await apiDelete(
          `/api/articles/${article.id}?client_id=${clientId}`
        );
      }
    } finally {
      setBulkLoading(false);
      clearSelection();
      if (clientId) {
        fetchArticles(clientId, statusFilter || undefined);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasFilter = statusFilter !== "" || searchQuery.trim() !== "";

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Articles"
        subtitle="All articles for this client"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="text"
          placeholder="Search by title or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1",
            "text-sm shadow-sm placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          )}
        />

        <div className="flex-1" />

        <Button
          size="sm"
          onClick={() => router.push(`/clients/${clientId}/articles/new` as Parameters<typeof router.push>[0])}
        >
          <PlusCircle className="h-4 w-4" />
          New Article
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
          <span className="font-medium text-foreground">
            {selectedIds.size} article{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <span className="text-border">|</span>

          {generateCandidates.length > 0 && (
            <button
              type="button"
              disabled={bulkLoading}
              onClick={handleBulkGenerate}
              className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Generate ({generateCandidates.length})
            </button>
          )}

          {approveCandidates.length > 0 && (
            <button
              type="button"
              disabled={bulkLoading}
              onClick={handleBulkApprove}
              className="text-primary hover:underline disabled:opacity-50 disabled:no-underline"
            >
              Approve ({approveCandidates.length})
            </button>
          )}

          <button
            type="button"
            disabled={bulkLoading}
            onClick={handleBulkDelete}
            className="text-destructive hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Delete ({selectedArticles.length})
          </button>

          <button
            type="button"
            disabled={bulkLoading}
            onClick={clearSelection}
            className="text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear
          </button>

          {bulkLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  aria-label="Select all"
                />
              </TableHead>

              <TableHead>
                <SortHeader
                  label="Title"
                  field="title"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>

              <TableHead>Keyword</TableHead>

              <TableHead>
                <SortHeader
                  label="Status"
                  field="status"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>

              <TableHead>
                <SortHeader
                  label="Publish Date"
                  field="publish_date"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>

              <TableHead>CMS URL</TableHead>

              <TableHead className="whitespace-nowrap">Rank</TableHead>

              <TableHead>
                <SortHeader
                  label="Created"
                  field="created_at"
                  currentField={sortField}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>

              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-7 w-12 rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={TOTAL_COLUMNS}>
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      {hasFilter ? "No articles match this filter" : "No articles yet"}
                    </p>
                    {!hasFilter && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/clients/${clientId}/articles/new` as Parameters<typeof router.push>[0])}
                      >
                        <PlusCircle className="h-4 w-4" />
                        Create your first article
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((article) => {
                const isPublished = article.status === "published";
                const isExpanded = expandedRankId === article.id;
                const isRankFetching = rankLoading[article.id] === true;
                const latestPosition = isPublished
                  ? getLatestPosition(article.id)
                  : null;

                return (
                  <React.Fragment key={article.id}>
                    <TableRow
                      data-state={selectedIds.has(article.id) ? "selected" : undefined}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(article.id)}
                          onChange={() => toggleSelect(article.id)}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          aria-label={`Select ${article.title}`}
                        />
                      </TableCell>

                      <TableCell className="max-w-xs">
                        <Link
                          href={`/clients/${clientId}/articles/${article.id}` as Parameters<typeof Link>[0]["href"]}
                          className="font-medium text-foreground hover:text-primary hover:underline truncate block"
                          title={article.title}
                        >
                          {article.title.length > 60
                            ? article.title.slice(0, 60) + "…"
                            : article.title}
                        </Link>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {article.keyword ?? "—"}
                      </TableCell>

                      <TableCell>
                        <StatusChip
                          status={articleStatusToChip(article.status)}
                          label={articleStatusLabel(article.status)}
                        />
                      </TableCell>

                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(article.publish_date)}
                      </TableCell>

                      <TableCell>
                        {article.cms_post_url ? (
                          <a
                            href={article.cms_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-primary hover:text-primary/80"
                            title={article.cms_post_url}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        {isPublished ? (
                          <button
                            type="button"
                            onClick={() => handleToggleRank(article)}
                            className="inline-flex items-center gap-1 focus:outline-none"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} rank history for ${article.title}`}
                            aria-expanded={isExpanded}
                          >
                            {isRankFetching && !rankHistory[article.id] ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <RankBadge position={latestPosition} />
                            )}
                            <ChevronRight
                              className={cn(
                                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                                isExpanded && "rotate-90"
                              )}
                            />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(article.created_at)}
                      </TableCell>

                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/clients/${clientId}/articles/${article.id}` as Parameters<typeof router.push>[0])
                          }
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <RankSparklineRow
                        colSpan={TOTAL_COLUMNS}
                        snapshots={rankHistory[article.id] ?? []}
                        loading={isRankFetching}
                      />
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
