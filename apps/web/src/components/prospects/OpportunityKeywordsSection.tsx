"use client";

/**
 * OpportunityKeywordsSection component
 * Phase 29-05: Opportunity Discovery UI
 *
 * Displays AI-generated opportunity keywords with:
 * - Summary statistics card
 * - Classification badges (quick_win, strategic, long_tail)
 * - Sortable/filterable table
 * - Export to CSV
 */
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import {
  Sparkles,
  Download,
  ChevronUp,
  ChevronDown,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

// Types matching the backend schema
export type OpportunityKeywordCategory =
  | "product"
  | "brand"
  | "service"
  | "commercial"
  | "informational";

export type KeywordClass = "quick_win" | "strategic" | "long_tail";

export interface OpportunityKeyword {
  keyword: string;
  category: OpportunityKeywordCategory;
  searchVolume: number;
  cpc: number;
  difficulty: number;
  opportunityScore: number;
  achievability?: number;
  classification?: KeywordClass;
  source: "ai_generated";
}

interface OpportunityKeywordsSectionProps {
  keywords: OpportunityKeyword[] | null | undefined;
  domain: string;
}

type SortColumn =
  | "keyword"
  | "category"
  | "searchVolume"
  | "cpc"
  | "difficulty"
  | "opportunityScore";
type SortDirection = "asc" | "desc";

// Category badge colors
const CATEGORY_COLORS: Record<OpportunityKeywordCategory, string> = {
  product: "bg-blue-500/20 text-blue-600 border-blue-500/30",
  brand: "bg-purple-500/20 text-purple-600 border-purple-500/30",
  service: "bg-green-500/20 text-green-600 border-green-500/30",
  commercial: "bg-orange-500/20 text-orange-600 border-orange-500/30",
  informational: "bg-cyan-500/20 text-cyan-600 border-cyan-500/30",
};

// Classification badge colors
const CLASS_COLORS: Record<KeywordClass, { bg: string; label: string }> = {
  quick_win: { bg: "bg-emerald-500", label: "Quick Win" },
  strategic: { bg: "bg-amber-500", label: "Strategic" },
  long_tail: { bg: "bg-sky-500", label: "Long Tail" },
};

function DifficultyBadge({ difficulty }: { difficulty: number }) {
  const variant =
    difficulty <= 30
      ? "default"
      : difficulty <= 60
        ? "secondary"
        : "destructive";
  const label =
    difficulty <= 30 ? "Easy" : difficulty <= 60 ? "Medium" : "Hard";

  return (
    <Badge variant={variant} className="text-xs">
      {label} ({difficulty})
    </Badge>
  );
}

function exportToCsv(keywords: OpportunityKeyword[], domain: string): void {
  const headers = [
    "Keyword",
    "Category",
    "Classification",
    "Search Volume",
    "CPC",
    "Difficulty",
    "Opportunity Score",
    "Achievability",
  ];

  const rows = keywords.map((k) => [
    `"${k.keyword.replace(/"/g, '""')}"`,
    k.category,
    k.classification ?? "",
    k.searchVolume.toString(),
    k.cpc.toFixed(2),
    k.difficulty.toString(),
    k.opportunityScore.toString(),
    k.achievability?.toString() ?? "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const date = new Date().toISOString().split("T")[0];
  link.download = `${domain.replace(/\./g, "_")}_opportunities_${date}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function OpportunityKeywordsSection({
  keywords,
  domain,
}: OpportunityKeywordsSectionProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("opportunityScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [categoryFilter, setCategoryFilter] =
    useState<OpportunityKeywordCategory | null>(null);
  const [classFilter, setClassFilter] = useState<KeywordClass | null>(null);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!keywords || keywords.length === 0) {
      return {
        totalKeywords: 0,
        totalVolume: 0,
        avgOpportunity: 0,
        byCategory: {
          product: 0,
          brand: 0,
          service: 0,
          commercial: 0,
          informational: 0,
        },
        byClass: { quick_win: 0, strategic: 0, long_tail: 0 },
      };
    }

    const totalVolume = keywords.reduce((sum, k) => sum + k.searchVolume, 0);
    const totalScore = keywords.reduce((sum, k) => sum + k.opportunityScore, 0);
    const byCategory: Record<OpportunityKeywordCategory, number> = {
      product: 0,
      brand: 0,
      service: 0,
      commercial: 0,
      informational: 0,
    };
    const byClass: Record<KeywordClass, number> = {
      quick_win: 0,
      strategic: 0,
      long_tail: 0,
    };

    for (const kw of keywords) {
      byCategory[kw.category]++;
      if (kw.classification) {
        byClass[kw.classification]++;
      }
    }

    return {
      totalKeywords: keywords.length,
      totalVolume,
      avgOpportunity: Math.round(totalScore / keywords.length),
      byCategory,
      byClass,
    };
  }, [keywords]);

  // Filter and sort keywords
  const displayedKeywords = useMemo(() => {
    if (!keywords) return [];

    let filtered = [...keywords];

    if (categoryFilter) {
      filtered = filtered.filter((k) => k.category === categoryFilter);
    }
    if (classFilter) {
      filtered = filtered.filter((k) => k.classification === classFilter);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "keyword":
        case "category":
          comparison = a[sortColumn].localeCompare(b[sortColumn]);
          break;
        default:
          comparison = a[sortColumn] - b[sortColumn];
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [keywords, categoryFilter, classFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (!keywords || keywords.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-2">
            No keyword opportunities found yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Run an &quot;Opportunity Discovery&quot; analysis to generate
            AI-powered keyword suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI-Generated Opportunities</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCsv(keywords, domain)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Target className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">
              Total Keywords
            </span>
          </div>
          <div className="text-2xl font-bold">{summary.totalKeywords}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">Total Volume</span>
          </div>
          <div className="text-2xl font-bold">
            {summary.totalVolume.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium uppercase">
              Avg Opportunity
            </span>
          </div>
          <div className="text-2xl font-bold">{summary.avgOpportunity}</div>
        </Card>
      </div>

      {/* Classification breakdown */}
      {(summary.byClass.quick_win > 0 ||
        summary.byClass.strategic > 0 ||
        summary.byClass.long_tail > 0) && (
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-3">
            Keywords by Classification
          </div>
          <div className="flex flex-wrap gap-4">
            {summary.byClass.quick_win > 0 && (
              <div className="flex items-center gap-2">
                <Badge className={CLASS_COLORS.quick_win.bg}>
                  {CLASS_COLORS.quick_win.label}
                </Badge>
                <span className="font-semibold">{summary.byClass.quick_win}</span>
              </div>
            )}
            {summary.byClass.strategic > 0 && (
              <div className="flex items-center gap-2">
                <Badge className={CLASS_COLORS.strategic.bg}>
                  {CLASS_COLORS.strategic.label}
                </Badge>
                <span className="font-semibold">{summary.byClass.strategic}</span>
              </div>
            )}
            {summary.byClass.long_tail > 0 && (
              <div className="flex items-center gap-2">
                <Badge className={CLASS_COLORS.long_tail.bg}>
                  {CLASS_COLORS.long_tail.label}
                </Badge>
                <span className="font-semibold">{summary.byClass.long_tail}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Select
            value={categoryFilter ?? "all"}
            onValueChange={(v) =>
              setCategoryFilter(
                v === "all" ? null : (v as OpportunityKeywordCategory)
              )
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="brand">Brand</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Classification:</span>
          <Select
            value={classFilter ?? "all"}
            onValueChange={(v) =>
              setClassFilter(v === "all" ? null : (v as KeywordClass))
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="quick_win">Quick Win</SelectItem>
              <SelectItem value="strategic">Strategic</SelectItem>
              <SelectItem value="long_tail">Long Tail</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          Showing {displayedKeywords.length} of {keywords.length} keywords
        </span>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                column="keyword"
                current={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Keyword
              </SortableHead>
              <SortableHead
                column="category"
                current={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Category
              </SortableHead>
              <TableHead>Class</TableHead>
              <SortableHead
                column="searchVolume"
                current={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Volume
              </SortableHead>
              <SortableHead
                column="cpc"
                current={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                CPC
              </SortableHead>
              <SortableHead
                column="difficulty"
                current={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Difficulty
              </SortableHead>
              <SortableHead
                column="opportunityScore"
                current={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Opportunity
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedKeywords.slice(0, 50).map((kw, idx) => (
              <TableRow key={`${kw.keyword}-${idx}`}>
                <TableCell className="font-medium">{kw.keyword}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={CATEGORY_COLORS[kw.category]}>
                    {kw.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  {kw.classification && (
                    <Badge className={CLASS_COLORS[kw.classification].bg}>
                      {CLASS_COLORS[kw.classification].label}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{kw.searchVolume.toLocaleString()}</TableCell>
                <TableCell>${kw.cpc.toFixed(2)}</TableCell>
                <TableCell>
                  <DifficultyBadge difficulty={kw.difficulty} />
                </TableCell>
                <TableCell className="font-semibold text-primary">
                  {kw.opportunityScore.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {displayedKeywords.length > 50 && (
          <div className="p-4 text-center text-sm text-muted-foreground border-t">
            Showing top 50 of {displayedKeywords.length} keywords. Export CSV for
            full list.
          </div>
        )}
      </Card>
    </div>
  );
}

function SortableHead({
  column,
  current,
  direction,
  onSort,
  children,
}: {
  column: SortColumn;
  current: SortColumn;
  direction: SortDirection;
  onSort: (col: SortColumn) => void;
  children: React.ReactNode;
}) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {current === column &&
          (direction === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </div>
    </TableHead>
  );
}
