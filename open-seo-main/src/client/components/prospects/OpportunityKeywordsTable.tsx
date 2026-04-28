/**
 * OpportunityKeywordsTable component
 * Phase 29: AI Opportunity Discovery - Task 29-04
 *
 * Displays AI-generated keyword opportunities in a sortable table with:
 * - Columns: Keyword, Category, Volume, CPC, Difficulty, Opportunity Score
 * - Category filters (product/brand/service/commercial/informational)
 * - DifficultyBadge for visual difficulty indicator
 * - "Add to proposal" placeholder action
 */
import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/client/components/ui/table";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/client/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { DifficultyBadge } from "./DifficultyBadge";
import { ChevronUp, ChevronDown, Plus, Sparkles } from "lucide-react";
import type { OpportunityKeyword, OpportunityKeywordCategory } from "@/db/prospect-schema";

/**
 * Props for SortableHeader component
 */
interface SortableHeaderProps {
  column: OpportunitySortColumn;
  sortColumn: OpportunitySortColumn;
  sortDirection: SortDirection;
  onSort: (column: OpportunitySortColumn) => void;
  children: React.ReactNode;
}

/**
 * Sortable table header cell component.
 * Extracted to module level to avoid recreation on every render.
 */
function SortableHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
  children,
}: SortableHeaderProps) {
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-muted/50"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column &&
          (sortDirection === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </div>
    </TableHead>
  );
}

// Sortable columns
export type OpportunitySortColumn =
  | "keyword"
  | "category"
  | "searchVolume"
  | "cpc"
  | "difficulty"
  | "opportunityScore";

export type SortDirection = "asc" | "desc";

/**
 * Summary statistics for opportunity keywords
 */
export interface OpportunitySummary {
  totalKeywords: number;
  totalVolume: number;
  avgOpportunity: number;
  byCategory: Record<OpportunityKeywordCategory, number>;
}

/**
 * Category badge colors
 */
const CATEGORY_COLORS: Record<OpportunityKeywordCategory, string> = {
  product: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  brand: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  service: "bg-green-500/20 text-green-400 border-green-500/30",
  commercial: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  informational: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

/**
 * Sorts opportunity keywords by specified column and direction.
 * Returns a new array (immutable).
 */
export function sortOpportunityKeywords(
  keywords: OpportunityKeyword[],
  column: OpportunitySortColumn,
  direction: SortDirection,
): OpportunityKeyword[] {
  if (keywords.length === 0) return [];

  const sorted = [...keywords];

  sorted.sort((a, b) => {
    let comparison = 0;

    switch (column) {
      case "keyword":
      case "category":
        comparison = a[column].localeCompare(b[column]);
        break;
      case "searchVolume":
      case "cpc":
      case "difficulty":
      case "opportunityScore":
        comparison = a[column] - b[column];
        break;
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

/**
 * Filters keywords by category.
 */
export function filterByCategory(
  keywords: OpportunityKeyword[],
  category: OpportunityKeywordCategory | null,
): OpportunityKeyword[] {
  if (category === null) return keywords;
  return keywords.filter((k) => k.category === category);
}

/**
 * Calculates summary statistics for opportunity keywords.
 */
export function calculateOpportunitySummary(
  keywords: OpportunityKeyword[],
): OpportunitySummary {
  if (keywords.length === 0) {
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

  for (const keyword of keywords) {
    byCategory[keyword.category]++;
  }

  return {
    totalKeywords: keywords.length,
    totalVolume,
    avgOpportunity: Math.round(totalScore / keywords.length),
    byCategory,
  };
}

interface OpportunityKeywordsTableProps {
  keywords: OpportunityKeyword[];
  onAddToProposal?: (keyword: string) => void;
}

/**
 * Renders a sortable, filterable table of AI-generated keyword opportunities.
 */
export function OpportunityKeywordsTable({
  keywords,
  onAddToProposal,
}: OpportunityKeywordsTableProps) {
  const [sortColumn, setSortColumn] = useState<OpportunitySortColumn>("opportunityScore");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [categoryFilter, setCategoryFilter] = useState<OpportunityKeywordCategory | null>(null);

  const filteredKeywords = useMemo(
    () => filterByCategory(keywords, categoryFilter),
    [keywords, categoryFilter],
  );

  const sortedKeywords = useMemo(
    () => sortOpportunityKeywords(filteredKeywords, sortColumn, sortDirection),
    [filteredKeywords, sortColumn, sortDirection],
  );

  const handleSort = (column: OpportunitySortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value === "all" ? null : (value as OpportunityKeywordCategory));
  };

  if (keywords.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No keyword opportunities found.</p>
        <p className="text-sm mt-1">
          Run an analysis to generate AI-powered keyword suggestions.
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Category filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by category:</span>
        <Select
          value={categoryFilter ?? "all"}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="brand">Brand</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="informational">Informational</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          Showing {sortedKeywords.length} of {keywords.length} keywords
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader column="keyword" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Keyword</SortableHeader>
              <SortableHeader column="category" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Category</SortableHeader>
              <SortableHeader column="searchVolume" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Volume</SortableHeader>
              <SortableHeader column="cpc" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>CPC</SortableHeader>
              <SortableHeader column="difficulty" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>Difficulty</SortableHeader>
              <SortableHeader column="opportunityScore" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort}>
                Opportunity
              </SortableHeader>
              <TableHead className="w-[60px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedKeywords.map((keyword, index) => (
              <TableRow key={`${keyword.keyword}-${index}`}>
                <TableCell className="font-medium">{keyword.keyword}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={CATEGORY_COLORS[keyword.category]}
                  >
                    {keyword.category}
                  </Badge>
                </TableCell>
                <TableCell>{keyword.searchVolume.toLocaleString()}</TableCell>
                <TableCell>${keyword.cpc.toFixed(2)}</TableCell>
                <TableCell>
                  <DifficultyBadge difficulty={keyword.difficulty} />
                </TableCell>
                <TableCell className="font-semibold text-primary">
                  {keyword.opportunityScore.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled
                        onClick={() => onAddToProposal?.(keyword.keyword)}
                        aria-label="Add to proposal"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Coming soon</p>
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      </div>
    </TooltipProvider>
  );
}
