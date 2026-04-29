"use client";

/**
 * KeywordTable Component
 * Phase 43-04: Prioritization Engine + UI
 *
 * Data table for keywords with sorting, selection, and tier badges.
 */

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
  Button,
  Badge,
} from "@tevero/ui";
import { ArrowUpDown, Zap, Target, Sparkles, ExternalLink } from "lucide-react";
import type { ProspectKeyword } from "../actions";
import { getTierBadge } from "./TierFilter";
import { safeHref, isSafeUrl } from "@/lib/utils/safe-url";

interface KeywordTableProps {
  keywords: ProspectKeyword[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
}

const QUICK_WIN_ICONS: Record<string, { icon: typeof Zap; label: string; color: string }> = {
  striking_distance: {
    icon: Target,
    label: "Striking Distance",
    color: "text-orange-500",
  },
  low_hanging: {
    icon: Sparkles,
    label: "Low Hanging Fruit",
    color: "text-green-500",
  },
  fresh_opportunity: {
    icon: Zap,
    label: "Fresh Opportunity",
    color: "text-blue-500",
  },
};

export function KeywordTable({
  keywords,
  selectedIds,
  onSelectionChange,
  sortBy,
  sortOrder,
  onSort,
}: KeywordTableProps) {
  const allSelected =
    keywords.length > 0 && keywords.every((k) => selectedIds.has(k.id));
  const someSelected = keywords.some((k) => selectedIds.has(k.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(keywords.map((k) => k.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const SortButton = ({
    column,
    children,
  }: {
    column: string;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => onSort(column)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all"
                className={someSelected && !allSelected ? "data-[state=checked]:bg-muted" : ""}
              />
            </TableHead>
            <TableHead>Keyword</TableHead>
            <TableHead className="text-right">
              <SortButton column="searchVolume">Volume</SortButton>
            </TableHead>
            <TableHead className="text-right">
              <SortButton column="keywordDifficulty">KD</SortButton>
            </TableHead>
            <TableHead className="text-right">Position</TableHead>
            <TableHead className="text-center">Tier</TableHead>
            <TableHead className="text-center">Quick Win</TableHead>
            <TableHead className="text-right">
              <SortButton column="compositeScore">Score</SortButton>
            </TableHead>
            <TableHead>Mapped URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keywords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No keywords found. Import keywords or run a discovery.
              </TableCell>
            </TableRow>
          ) : (
            keywords.map((keyword) => {
              const tierBadge = getTierBadge(keyword.tier);
              const quickWin = keyword.quickWinType
                ? QUICK_WIN_ICONS[keyword.quickWinType]
                : null;

              return (
                <TableRow
                  key={keyword.id}
                  data-state={selectedIds.has(keyword.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(keyword.id)}
                      onCheckedChange={() => toggleOne(keyword.id)}
                      aria-label={`Select ${keyword.keyword}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{keyword.keyword}</TableCell>
                  <TableCell className="text-right">
                    {keyword.searchVolume?.toLocaleString() ?? "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {keyword.keywordDifficulty != null ? (
                      <span
                        className={
                          keyword.keywordDifficulty <= 30
                            ? "text-green-600"
                            : keyword.keywordDifficulty <= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                        }
                      >
                        {keyword.keywordDifficulty.toFixed(0)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {keyword.currentPosition ?? "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {tierBadge ? (
                      <Badge className={tierBadge.className}>
                        {tierBadge.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {quickWin ? (
                      <div
                        className={`flex items-center justify-center gap-1 ${quickWin.color}`}
                        title={quickWin.label}
                      >
                        <quickWin.icon className="h-4 w-4" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {keyword.compositeScore != null ? (
                      <span
                        className={
                          keyword.compositeScore >= 0.75
                            ? "text-red-600 font-semibold"
                            : keyword.compositeScore >= 0.5
                              ? "text-orange-600"
                              : keyword.compositeScore >= 0.25
                                ? "text-blue-600"
                                : "text-gray-500"
                        }
                      >
                        {(keyword.compositeScore * 100).toFixed(0)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {keyword.mappedUrl && isSafeUrl(keyword.mappedUrl) ? (
                      <a
                        href={safeHref(keyword.mappedUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <span className="truncate">{keyword.mappedUrl}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not mapped</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
