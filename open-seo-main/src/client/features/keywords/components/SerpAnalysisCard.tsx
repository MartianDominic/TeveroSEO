import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { SerpResultItem } from "@/types/keywords";
import { formatNumber } from "../utils";

export function SerpAnalysisCard({
  items,
  keyword,
  loading,
  error,
  onRetry,
  page,
  pageSize,
  onPageChange,
}: {
  items: SerpResultItem[];
  keyword?: string | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(items.length / pageSize);
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);

  if (loading) return <SerpAnalysisLoadingState />;
  if (error) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-destructive space-y-2">
        <p>{error}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }
  if (items.length === 0) return <SerpAnalysisEmptyState keyword={keyword} />;

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">
        {items.length} organic results
      </div>
      <SerpAnalysisTable items={pageItems} />
      <SerpAnalysisPagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function SerpAnalysisTable({ items }: { items: SerpResultItem[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs text-muted-foreground">
            <TableHead className="w-8">#</TableHead>
            <TableHead>Page</TableHead>
            <TableHead className="text-right w-20">Traffic</TableHead>
            <TableHead className="text-right w-20">Ref. Domains</TableHead>
            <TableHead className="text-right w-20">Backlinks</TableHead>
            <TableHead className="text-center w-16">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={`${item.rank}-${item.url}`}
              className="hover:bg-muted/50"
            >
              <TableCell className="font-mono text-muted-foreground text-xs">
                {item.rank}
              </TableCell>
              <TableCell className="max-w-[280px]">
                <div className="flex flex-col gap-0.5">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline truncate flex items-center gap-1"
                    title={item.title}
                  >
                    {item.title || item.url}
                    <ExternalLink className="size-3 shrink-0 opacity-40" />
                  </a>
                  <span className="text-xs text-foreground/40 truncate">
                    {item.domain}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground/70">
                {formatNumber(item.etv)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground/70">
                {formatNumber(item.referringDomains)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground/70">
                {formatNumber(item.backlinks)}
              </TableCell>
              <TableCell className="text-center">
                <RankChangeBadge change={item.rankChange} isNew={item.isNew} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SerpAnalysisPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
      <span className="text-xs text-muted-foreground">
        Page {page + 1} of {totalPages}
      </span>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SerpAnalysisLoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-8 rounded bg-muted animate-pulse"
          style={{ animationDelay: `${index * 50}ms` }}
        />
      ))}
    </div>
  );
}

function SerpAnalysisEmptyState({ keyword }: { keyword?: string | null }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-8">
      <p>No SERP details available for this keyword yet.</p>
      {keyword ? (
        <p className="mt-1">Try clicking another keyword to load data.</p>
      ) : null}
    </div>
  );
}

function RankChangeBadge({
  change,
  isNew,
}: {
  change: number | null;
  isNew?: boolean;
}) {
  if (isNew) {
    return (
      <Badge className="bg-success/20 text-green-700 dark:text-green-400 text-[10px] px-1 py-0 border-success/30">
        new
      </Badge>
    );
  }
  if (change == null)
    return <Minus className="size-3 text-foreground/40 mx-auto" />;
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-success text-xs">
        <TrendingUp className="size-3" />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-destructive text-xs">
        <TrendingDown className="size-3" />
        {Math.abs(change)}
      </span>
    );
  }
  return <Minus className="size-3 text-foreground/40 mx-auto" />;
}
