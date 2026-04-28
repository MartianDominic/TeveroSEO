import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSavedKeywords,
  removeSavedKeyword,
} from "@/serverFunctions/keywords";
import { Trash2, Download, Search, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";

export const Route = createFileRoute("/_project/p/$projectId/saved")({
  component: SavedKeywordsPage,
});

function SavedKeywordsPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: savedKeywordsData, isLoading } = useQuery({
    queryKey: ["savedKeywords", projectId],
    queryFn: () => getSavedKeywords({ data: { projectId } }),
  });
  const savedKeywords = savedKeywordsData?.rows ?? [];

  const removeMutation = useMutation({
    mutationFn: (savedKeywordId: string) =>
      removeSavedKeyword({ data: { projectId, savedKeywordId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
      captureClientEvent("saved_keywords:remove");
      toast.success("Keyword removed");
    },
    onError: (error) => {
      setRemoveError(getStandardErrorMessage(error, "Remove failed."));
    },
  });

  const handleRemoveKeyword = (savedKeywordId: string) => {
    setRemoveError(null);
    setRemovingId(savedKeywordId);
    removeMutation.mutate(savedKeywordId, {
      onSettled: () => {
        setRemovingId((current) =>
          current === savedKeywordId ? null : current,
        );
      },
    });
  };

  const exportCsv = () => {
    if (savedKeywords.length === 0) {
      toast.error("No keywords to export");
      return;
    }

    const headers = [
      "Keyword",
      "Volume",
      "CPC",
      "Competition",
      "Difficulty",
      "Intent",
      "Fetched At",
    ];
    const csvRows = savedKeywords.map((kw) => [
      kw.keyword,
      kw.searchVolume ?? "",
      kw.cpc?.toFixed(2) ?? "",
      kw.competition?.toFixed(2) ?? "",
      kw.keywordDifficulty ?? "",
      kw.intent ?? "",
      kw.fetchedAt instanceof Date ? kw.fetchedAt.toISOString() : (kw.fetchedAt ?? ""),
    ]);
    const csv = buildCsv(headers, csvRows);
    downloadCsv("saved-keywords.csv", csv);
    captureClientEvent("data:export", {
      source_feature: "saved_keywords",
      result_count: savedKeywords.length,
    });
  };

  return (
    <SavedKeywordsContent
      isLoading={isLoading}
      removeError={removeError}
      removingId={removingId}
      savedKeywords={savedKeywords}
      onExportCsv={exportCsv}
      onRemoveKeyword={handleRemoveKeyword}
    />
  );
}

function SavedKeywordsContent({
  isLoading,
  removeError,
  removingId,
  savedKeywords,
  onExportCsv,
  onRemoveKeyword,
}: {
  isLoading: boolean;
  removeError: string | null;
  removingId: string | null;
  savedKeywords: Array<{
    id: string;
    keyword: string;
    searchVolume: number | null;
    cpc: number | null;
    competition: number | null;
    keywordDifficulty: number | null;
    intent: string | null;
    fetchedAt: Date | string | null;
  }>;
  onExportCsv: () => void;
  onRemoveKeyword: (savedKeywordId: string) => void;
}) {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Saved Keywords</h1>
            <p className="text-sm text-foreground/70">
              Keywords you&apos;ve saved from keyword research.
            </p>
          </div>
          {savedKeywords.length > 0 && (
            <Button size="sm" onClick={onExportCsv}>
              <Download className="size-4" /> Export CSV
            </Button>
          )}
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="gap-3 flex flex-col pt-6" aria-busy>
              <div className="skeleton h-4 w-48" />
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-8 gap-3 items-center"
                >
                  <div className="skeleton h-4 col-span-2" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : savedKeywords.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground pt-6">
              <Search className="size-8 mx-auto mb-2 opacity-40" />
              <p>
                No saved keywords yet. Use the Keyword Research page to find and
                save keywords.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="gap-3 flex flex-col pt-6">
              {removeError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{removeError}</span>
                </div>
              ) : null}
              <p className="text-sm text-foreground/70">
                {savedKeywords.length} saved keyword
                {savedKeywords.length !== 1 ? "s" : ""}
              </p>
              <SavedKeywordsTable
                rows={savedKeywords}
                removingId={removingId}
                onRemoveKeyword={onRemoveKeyword}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SavedKeywordsTable({
  rows,
  removingId,
  onRemoveKeyword,
}: {
  rows: Array<{
    id: string;
    keyword: string;
    searchVolume: number | null;
    cpc: number | null;
    competition: number | null;
    keywordDifficulty: number | null;
    intent: string | null;
    fetchedAt: Date | string | null;
  }>;
  removingId: string | null;
  onRemoveKeyword: (savedKeywordId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Keyword</TableHead>
            <TableHead>Volume</TableHead>
            <TableHead>CPC</TableHead>
            <TableHead>Competition</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Intent</TableHead>
            <TableHead>Last Fetched</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((kw) => (
            <TableRow key={kw.id}>
              <TableCell className="font-medium">{kw.keyword}</TableCell>
              <TableCell>{formatNumber(kw.searchVolume)}</TableCell>
              <TableCell>{kw.cpc == null ? "-" : `$${kw.cpc.toFixed(2)}`}</TableCell>
              <TableCell>
                {kw.competition == null ? "-" : kw.competition.toFixed(2)}
              </TableCell>
              <TableCell>
                <DifficultyBadge value={kw.keywordDifficulty} />
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {kw.intent ?? "?"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {kw.fetchedAt
                  ? new Date(kw.fetchedAt).toLocaleDateString()
                  : "-"}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => onRemoveKeyword(kw.id)}
                  disabled={removingId === kw.id}
                  title="Remove"
                >
                  {removingId === kw.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DifficultyBadge({ value }: { value: number | null }) {
  if (value == null)
    return <Badge variant="secondary">-</Badge>;
  if (value < 30)
    return <Badge className="bg-success/20 text-green-700 dark:text-green-400 text-xs border-success/30">{value}</Badge>;
  if (value <= 60)
    return <Badge variant="outline" className="text-yellow-600 text-xs">{value}</Badge>;
  return <Badge variant="destructive" className="text-xs">{value}</Badge>;
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat().format(value);
}
