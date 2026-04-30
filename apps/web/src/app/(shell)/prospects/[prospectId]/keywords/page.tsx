"use client";

/**
 * Keyword List Page
 * Phase 43-04: Prioritization Engine + UI
 *
 * Displays keywords with tier filtering, quick win highlighting,
 * bulk actions, and score weight customization.
 */

import { useState, useEffect, useCallback, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import {
  Upload,
  Download,
  RefreshCcw,
  Loader2,
  ChevronLeft,
  Search,
} from "lucide-react";

import { KeywordTable } from "./components/KeywordTable";
import { TierFilter } from "./components/TierFilter";
import { ScoreWeightEditor } from "./components/ScoreWeightEditor";
import {
  getKeywords,
  prioritizeKeywords,
  bulkUpdateTier,
  exportKeywordsCsv,
  DEFAULT_WEIGHTS,
  type ProspectKeyword,
  type ScoreWeights,
} from "./actions";

export default function KeywordListPage() {
  const params = useParams();
  const router = useRouter();
  const prospectId = params.prospectId as string;

  const [isPending, startTransition] = useTransition();
  const [keywords, setKeywords] = useState<ProspectKeyword[]>([]);
  const [total, setTotal] = useState(0);
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and sorting
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showQuickWins, setShowQuickWins] = useState(false);
  const [sortBy, setSortBy] = useState("compositeScore");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Score weights
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS);
  const [isApplyingWeights, setIsApplyingWeights] = useState(false);

  // Fetch keywords
  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getKeywords(prospectId, {
        tier: selectedTier || undefined,
        quickWin: showQuickWins || undefined,
        sortBy,
        sortOrder,
        limit: 100,
      });

      if (!result.success) {
        setError(result.error || "Failed to fetch keywords");
        return;
      }
      setKeywords(result.data.keywords);
      setTotal(result.data.total);
      setTierCounts(result.data.tierCounts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [prospectId, selectedTier, showQuickWins, sortBy, sortOrder]);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  // Handle sort
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Handle tier filter
  const handleTierFilter = (tier: string | null) => {
    setSelectedTier(tier);
    setSelectedIds(new Set()); // Clear selection when filter changes
  };

  // Handle prioritization
  const handlePrioritize = async () => {
    setIsApplyingWeights(true);
    try {
      await prioritizeKeywords(prospectId, weights);
      await fetchKeywords();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsApplyingWeights(false);
    }
  };

  // Handle bulk tier update
  const handleBulkTierUpdate = async (tier: string) => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      try {
        await bulkUpdateTier(prospectId, Array.from(selectedIds), tier);
        setSelectedIds(new Set());
        await fetchKeywords();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  // Handle CSV export
  const handleExport = async () => {
    const csv = await exportKeywordsCsv(keywords);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keywords-${prospectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/prospects/${prospectId}` as Parameters<typeof Link>[0]["href"]}>
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Keywords</h1>
            <p className="text-text-3">
              {total} keywords {selectedTier && `(filtered by ${selectedTier})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/prospects/${prospectId}/keywords/import` as Parameters<typeof Link>[0]["href"]}>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={keywords.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handlePrioritize}
            disabled={isApplyingWeights || total === 0}
          >
            {isApplyingWeights ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            Re-prioritize
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error-soft text-error px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters and Actions Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          {/* Tier Filter */}
          <TierFilter
            selected={selectedTier}
            onSelect={handleTierFilter}
            counts={tierCounts}
          />

          {/* Quick Win Toggle */}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showQuickWins}
              onCheckedChange={(checked) => setShowQuickWins(!!checked)}
            />
            Show only Quick Wins
          </label>
        </div>

        {/* Score Weight Editor */}
        <ScoreWeightEditor
          weights={weights}
          onChange={setWeights}
          onApply={handlePrioritize}
          isApplying={isApplyingWeights}
        />
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <Card className="bg-surface-2">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm">
              {selectedIds.size} keyword{selectedIds.size !== 1 && "s"} selected
            </span>
            <div className="flex items-center gap-2">
              <Select onValueChange={handleBulkTierUpdate}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Set Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="must_do">Must-Do</SelectItem>
                  <SelectItem value="should_do">Should-Do</SelectItem>
                  <SelectItem value="nice_to_have">Nice-to-Have</SelectItem>
                  <SelectItem value="ignore">Ignore</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keyword Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-text-3" />
        </div>
      ) : (
        <KeywordTable
          keywords={keywords}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
      )}

      {/* Empty State */}
      {!loading && keywords.length === 0 && !selectedTier && !showQuickWins && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-text-3 mb-4" />
            <h3 className="text-lg font-medium mb-2">No keywords yet</h3>
            <p className="text-text-3 mb-4">
              Import keywords from a CSV or run a keyword discovery.
            </p>
            <Link href={`/prospects/${prospectId}/keywords/import` as Parameters<typeof Link>[0]["href"]}>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Import Keywords
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
