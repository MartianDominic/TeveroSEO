"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Globe,
  TrendingUp,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useClientStore } from "@/stores/clientStore";
import {
  useIntelligenceStore,
  type OrganicKeyword,
  type KeywordIdea,
  type IntelligenceData,
} from "@/stores/intelligenceStore";
import { apiGet, apiPost } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function positionColor(pos: number): string {
  if (pos >= 1 && pos <= 3)
    return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (pos >= 4 && pos <= 10)
    return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card py-20 text-center">
      <Globe className="h-10 w-10 text-muted-foreground" />
      <div>
        <p className="text-base font-semibold text-foreground">
          Intelligence Not Gathered
        </p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
          Run a website intelligence scrape to discover keywords, brand voice,
          competitors, and more.
        </p>
      </div>
      <Button onClick={onRun}>Run Intelligence</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Overview
// ---------------------------------------------------------------------------

function OverviewTab({
  intelligence,
}: {
  intelligence: IntelligenceData;
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const hasIssues =
    Array.isArray(intelligence.technical_issues) &&
    intelligence.technical_issues.length > 0;
  const kwCount = Array.isArray(intelligence.organic_keywords)
    ? intelligence.organic_keywords.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Domain metrics row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <BarChart2 className="h-3.5 w-3.5" /> Domain Rating
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {intelligence.domain_rating != null
              ? intelligence.domain_rating
              : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Traffic Estimate
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatNumber(intelligence.traffic_estimate)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Search className="h-3.5 w-3.5" /> Keywords Tracked
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {kwCount}
          </p>
        </div>
      </div>

      {/* Top competitors */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-3">
          Top Competitors
        </p>
        {Array.isArray(intelligence.top_competitors) &&
        intelligence.top_competitors.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {intelligence.top_competitors.map((domain) => (
              <a
                key={domain}
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-accent transition-colors"
              >
                {domain}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No competitor data yet.
          </p>
        )}
      </div>

      {/* Technical issues */}
      <div className="rounded-lg border border-border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 rounded-lg transition-colors"
          onClick={() => setIssuesOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            {hasIssues ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            Technical Issues{" "}
            {hasIssues ? `(${intelligence.technical_issues!.length})` : ""}
          </span>
          {issuesOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {issuesOpen && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            {hasIssues ? (
              <div className="flex flex-wrap gap-2">
                {intelligence.technical_issues!.map((issue) => (
                  <span
                    key={issue}
                    className="inline-flex items-center rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
                  >
                    {issue}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                No issues detected
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Keywords
// ---------------------------------------------------------------------------

type SortKey = "keyword" | "position" | "search_volume";
type SortDir = "asc" | "desc";

function KeywordsTab({
  keywords,
  clientId,
}: {
  keywords: OrganicKeyword[];
  clientId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("search_volume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return keywords.filter((kw) => kw.keyword.toLowerCase().includes(q));
  }, [keywords, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const aNum = (aVal as number) ?? 0;
      const bNum = (bVal as number) ?? 0;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [filtered, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3 ml-0.5" />
    ) : (
      <ChevronDown className="inline h-3 w-3 ml-0.5" />
    );
  };

  if (keywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Search className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No keyword data yet. Run intelligence to discover keywords.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Filter keywords..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("keyword")}
              >
                Keyword <SortIcon col="keyword" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-28"
                onClick={() => handleSort("position")}
              >
                Position <SortIcon col="position" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-36"
                onClick={() => handleSort("search_volume")}
              >
                Search Volume <SortIcon col="search_volume" />
              </TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((kw) => (
              <TableRow key={kw.keyword}>
                <TableCell className="font-medium text-foreground">
                  {kw.keyword}
                </TableCell>
                <TableCell>
                  <span className={positionColor(kw.position)}>
                    {kw.position}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {kw.search_volume.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/clients/${clientId}/articles/new?keyword=${encodeURIComponent(
                          kw.keyword
                        )}`
                      )
                    }
                  >
                    Create Article
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — Brand Voice & ICP
// ---------------------------------------------------------------------------

function BrandVoiceTab({
  intelligence,
}: {
  intelligence: IntelligenceData;
}) {
  const bv = intelligence.brand_voice;
  const icp = intelligence.icp_psychology;

  const field = (val: string | null | undefined) => (
    <dd className="text-sm text-foreground mt-0.5">{val ?? "—"}</dd>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Brand Voice card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-4">
          Brand Voice
        </p>
        <dl className="space-y-3">
          <div>
            <dt className="text-xs text-muted-foreground">Tone</dt>
            {field(bv?.writing_style?.tone)}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Voice</dt>
            {field(bv?.writing_style?.voice)}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Brand Voice Statement
            </dt>
            {field(bv?.brand_analysis?.brand_voice)}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Target Expertise Level
            </dt>
            {field(bv?.target_audience?.expertise_level)}
          </div>
        </dl>
      </div>

      {/* ICP Psychology card */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-4">
          ICP Psychology
        </p>

        {/* Awareness Stage */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">Awareness Stage</p>
          {icp?.awareness_stage ? (
            <span className="inline-flex rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
              {icp.awareness_stage}
            </span>
          ) : (
            <span className="text-sm text-foreground">—</span>
          )}
        </div>

        {/* Core Fears */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">Core Fears</p>
          {Array.isArray(icp?.core_fears) && icp!.core_fears.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {icp!.core_fears.map((f) => (
                <span
                  key={f}
                  className="inline-flex rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-foreground">—</span>
          )}
        </div>

        {/* Identity Aspirations */}
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1">
            Identity Aspirations
          </p>
          {Array.isArray(icp?.identity_aspirations) &&
          icp!.identity_aspirations.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {icp!.identity_aspirations.map((a) => (
                <span
                  key={a}
                  className="inline-flex rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-foreground">—</span>
          )}
        </div>

        {/* Content Implications */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">
            Content Implications
          </p>
          {Array.isArray(icp?.content_implications) &&
          icp!.content_implications.length > 0 ? (
            <ul className="space-y-1 text-sm text-foreground list-disc list-inside">
              {icp!.content_implications.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-foreground">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4 — Content Gaps
// ---------------------------------------------------------------------------

function ContentGapsTab({
  intelligence,
  clientId,
}: {
  intelligence: IntelligenceData;
  clientId: string;
}) {
  const router = useRouter();
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [keywordIdeas, setKeywordIdeas] = useState<KeywordIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);

  const organicKws = useMemo(
    () =>
      Array.isArray(intelligence.organic_keywords)
        ? [...intelligence.organic_keywords]
            .sort((a, b) => b.search_volume - a.search_volume)
            .slice(0, 30)
        : [],
    [intelligence.organic_keywords]
  );

  const toggleSeed = (kw: string) => {
    setSelectedSeeds((prev) => {
      if (prev.includes(kw)) return prev.filter((s) => s !== kw);
      if (prev.length >= 5) return prev;
      return [...prev, kw];
    });
  };

  const handleExplore = async () => {
    if (selectedSeeds.length === 0) return;
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const params = new URLSearchParams({ seeds: selectedSeeds.join(",") });
      const data = await apiGet<KeywordIdea[]>(
        `/api/client-intelligence/${clientId}/keyword-ideas?${params}`
      );
      setKeywordIdeas(Array.isArray(data) ? data : []);
    } catch {
      setIdeasError(
        "Failed to load keyword ideas. Check DataForSEO configuration."
      );
      setKeywordIdeas([]);
    } finally {
      setIdeasLoading(false);
    }
  };

  const hasGaps =
    Array.isArray(intelligence.content_gaps) &&
    intelligence.content_gaps.length > 0;
  const hasTopics =
    Array.isArray(intelligence.recommended_topics) &&
    intelligence.recommended_topics.length > 0;

  return (
    <div className="space-y-6">
      {/* Content Gaps */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-3">
          Content Gaps
        </p>
        {hasGaps ? (
          <ul className="space-y-1.5 text-sm text-foreground list-disc list-inside">
            {(intelligence.content_gaps as string[]).map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
            Content gap analysis will appear here after running intelligence.
            Currently being populated.
          </div>
        )}
      </div>

      {/* Recommended Topics */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-3">
          Recommended Topics
        </p>
        {hasTopics ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(intelligence.recommended_topics as string[]).map((topic) => (
              <div
                key={topic}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <span className="text-sm text-foreground truncate pr-2">
                  {topic}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() =>
                    router.push(
                      `/clients/${clientId}/articles/new?keyword=${encodeURIComponent(
                        topic
                      )}`
                    )
                  }
                >
                  Create Article
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recommended topics yet. Run intelligence to generate suggestions.
          </p>
        )}
      </div>

      {/* Keyword Ideas Explorer */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-sm font-semibold text-foreground mb-1">
          Keyword Ideas Explorer
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Select up to 5 seed keywords, then explore related ideas via
          DataForSEO.
        </p>

        {organicKws.length > 0 ? (
          <>
            <div className="mb-4">
              <p className="text-xs font-medium text-foreground mb-2">
                Seed keywords{" "}
                {selectedSeeds.length > 0
                  ? `(${selectedSeeds.length}/5 selected)`
                  : ""}
              </p>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {organicKws.map((kw) => {
                  const selected = selectedSeeds.includes(kw.keyword);
                  return (
                    <button
                      key={kw.keyword}
                      type="button"
                      onClick={() => toggleSeed(kw.keyword)}
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-foreground hover:bg-accent"
                      } ${
                        !selected && selectedSeeds.length >= 5
                          ? "opacity-40 cursor-not-allowed"
                          : ""
                      }`}
                      disabled={!selected && selectedSeeds.length >= 5}
                    >
                      {kw.keyword}
                      <span className="ml-1.5 text-muted-foreground">
                        {kw.search_volume.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              onClick={handleExplore}
              disabled={selectedSeeds.length === 0 || ideasLoading}
              size="sm"
            >
              {ideasLoading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Exploring...
                </>
              ) : (
                "Explore Keyword Ideas"
              )}
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Run intelligence first to populate seed keywords.
          </p>
        )}

        {ideasError && (
          <p className="mt-3 text-xs text-destructive">{ideasError}</p>
        )}

        {keywordIdeas.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-medium text-foreground mb-2">
              Results ({keywordIdeas.length})
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead className="w-36">Search Volume</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywordIdeas.map((idea) => (
                    <TableRow key={idea.keyword}>
                      <TableCell className="font-medium text-foreground">
                        {idea.keyword}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {idea.search_volume.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/clients/${clientId}/articles/new?keyword=${encodeURIComponent(
                                idea.keyword
                              )}`
                            )
                          }
                        >
                          Create Article
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ClientIntelligencePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { activeClient, clients, setActiveClient } = useClientStore();
  const { intelligence, loading, error, fetchIntelligence } =
    useIntelligenceStore();

  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const client = activeClient ?? clients.find((c) => c.id === clientId) ?? null;

  // Sync active client from URL param
  useEffect(() => {
    if (clientId && activeClient?.id !== clientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClient?.id, setActiveClient]);

  // Fetch intelligence on mount
  useEffect(() => {
    if (clientId) {
      fetchIntelligence(clientId);
    }
  }, [clientId, fetchIntelligence]);

  // Clear intelligence data on unmount so stale data isn't shown on next client
  useEffect(() => {
    return () => {
      useIntelligenceStore.getState().clearIntelligence();
    };
  }, []);

  const handleRunIntelligence = async () => {
    if (!clientId) return;
    setRerunning(true);
    setRerunError(null);
    try {
      await apiPost(`/api/client-intelligence/${clientId}/scrape`, {});
      // Re-fetch to show updated scrape_status
      await fetchIntelligence(clientId);
    } catch {
      setRerunError("Failed to start intelligence scrape.");
    } finally {
      setRerunning(false);
    }
  };

  const isEmpty =
    !intelligence || intelligence.scrape_status === "not_started";

  return (
    <div className="min-h-screen p-8 md:p-10">
      {/* Header */}
      <div className="mb-6">
        <PageHeader
          title="Website Intelligence"
          subtitle={client?.website_url ?? undefined}
          backHref={clientId ? `/clients/${clientId}` : "/clients"}
          actions={
            <div className="flex items-center gap-3">
              {intelligence &&
                intelligence.scrape_status !== "not_started" && (
                  <StatusChip status={intelligence.scrape_status} />
                )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunIntelligence}
                disabled={rerunning || loading}
              >
                {rerunning ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Re-run Intelligence
                  </>
                )}
              </Button>
            </div>
          }
        />
      </div>

      {/* Last scraped + rerun error */}
      {intelligence?.last_scraped_at && (
        <p className="mb-4 text-xs text-muted-foreground">
          Last scraped:{" "}
          {new Date(intelligence.last_scraped_at).toLocaleString()}
        </p>
      )}
      {rerunError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {rerunError}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading intelligence data...
          </span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty / not started state */}
      {!loading && !error && isEmpty && (
        <EmptyState onRun={handleRunIntelligence} />
      )}

      {/* Main content — tabs */}
      {!loading && !error && !isEmpty && intelligence && (
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="brandvoice">
              Brand Voice &amp; ICP
            </TabsTrigger>
            <TabsTrigger value="gaps">Content Gaps</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab intelligence={intelligence} />
          </TabsContent>

          <TabsContent value="keywords">
            <KeywordsTab
              keywords={
                Array.isArray(intelligence.organic_keywords)
                  ? intelligence.organic_keywords
                  : []
              }
              clientId={clientId!}
            />
          </TabsContent>

          <TabsContent value="brandvoice">
            <BrandVoiceTab intelligence={intelligence} />
          </TabsContent>

          <TabsContent value="gaps">
            <ContentGapsTab intelligence={intelligence} clientId={clientId!} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
