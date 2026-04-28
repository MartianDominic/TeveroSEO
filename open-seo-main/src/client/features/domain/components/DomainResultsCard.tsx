import { type Dispatch, type SetStateAction } from "react";
import {
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { DomainFilterPanel } from "@/client/features/domain/components/DomainFilterPanel";
import { DomainKeywordsTable } from "@/client/features/domain/components/DomainKeywordsTable";
import { DomainPagesTable } from "@/client/features/domain/components/DomainPagesTable";
import type { useDomainFilters } from "@/client/features/domain/hooks/useDomainFilters";
import {
  downloadCsv,
  keywordsToCsv,
  pagesToCsv,
} from "@/client/features/domain/utils";
import { captureClientEvent } from "@/client/lib/posthog";
import type {
  DomainActiveTab,
  DomainOverviewData,
  DomainSortMode,
  KeywordRow,
  PageRow,
  SortOrder,
} from "@/client/features/domain/types";

type Props = {
  overview: DomainOverviewData;
  activeTab: DomainActiveTab;
  sortMode: DomainSortMode;
  currentSortOrder: SortOrder;
  pendingSearch: string;
  selectedKeywords: Set<string>;
  visibleKeywords: string[];
  filteredKeywords: KeywordRow[];
  filteredPages: PageRow[];
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  filtersForm: ReturnType<typeof useDomainFilters>["filtersForm"];
  activeFilterCount: number;
  resetFilters: () => void;
  onTabChange: (tab: DomainActiveTab) => void;
  onSearchChange: (value: string) => void;
  onSaveKeywords: () => void;
  onSortClick: (sort: DomainSortMode) => void;
  onToggleKeyword: (keyword: string) => void;
  onToggleAllVisible: () => void;
};

export function DomainResultsCard({
  overview,
  activeTab,
  sortMode,
  currentSortOrder,
  pendingSearch,
  selectedKeywords,
  visibleKeywords,
  filteredKeywords,
  filteredPages,
  showFilters,
  setShowFilters,
  filtersForm,
  activeFilterCount,
  resetFilters,
  onTabChange,
  onSearchChange,
  onSaveKeywords,
  onSortClick,
  onToggleKeyword,
  onToggleAllVisible,
}: Props) {
  const currentRows =
    activeTab === "keywords" ? filteredKeywords : filteredPages;

  const handleCopy = async () => {
    const text = JSON.stringify(currentRows, null, 2);
    await navigator.clipboard.writeText(text);
    toast.success("Copied data");
  };

  const handleDownload = (extension: "csv" | "xls") => {
    const rows =
      activeTab === "keywords"
        ? keywordsToCsv(filteredKeywords)
        : pagesToCsv(filteredPages);
    downloadCsv(rows, `${overview.domain}-${activeTab}.${extension}`);

    if (extension === "csv") {
      captureClientEvent("data:export", {
        source_feature: "domain_overview",
        result_count: currentRows.length,
      });
    }
  };

  const isKeywordsTab = activeTab === "keywords";

  return (
    <div className="border border-border rounded-xl bg-background overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-fit">
          <button
            type="button"
            onClick={() => onTabChange("keywords")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${activeTab === "keywords" ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"}`}
          >
            Top Keywords
          </button>
          <button
            type="button"
            onClick={() => onTabChange("pages")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${activeTab === "pages" ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"}`}
          >
            Top Pages
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "keywords" ? (
            <Button
              size="sm"
              onClick={onSaveKeywords}
              disabled={selectedKeywords.size === 0}
            >
              <Save className="size-4" /> Save Keywords
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Download className="size-4" />
                Export
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleCopy}>
                <Copy className="size-4" />
                Copy data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("csv")}>
                <Download className="size-4" />
                Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownload("xls")}>
                <FileSpreadsheet className="size-4" />
                Download Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isKeywordsTab ? (
        <>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <Button
              variant="ghost"
              size="sm"
              className={`gap-1.5 ${showFilters ? "bg-muted" : ""}`}
              onClick={() => setShowFilters((prev) => !prev)}
              title="Toggle filters"
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeFilterCount > 0 ? (
                <Badge className="text-[10px] px-1 py-0">
                  {activeFilterCount}
                </Badge>
              ) : null}
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredKeywords.length} keywords
            </span>
            <div className="flex-1" />
            <div className="relative w-full max-w-xs flex items-center">
              <Search className="absolute left-2.5 size-4 text-muted-foreground pointer-events-none" />
              <input
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search in results"
                value={pendingSearch}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>

          {showFilters ? (
            <DomainFilterPanel
              filtersForm={filtersForm}
              activeFilterCount={activeFilterCount}
              resetFilters={resetFilters}
            />
          ) : null}
        </>
      ) : null}

      <div className="p-4">
        {isKeywordsTab ? (
          <DomainKeywordsTable
            rows={filteredKeywords}
            selectedKeywords={selectedKeywords}
            visibleKeywords={visibleKeywords}
            sortMode={sortMode}
            currentSortOrder={currentSortOrder}
            onSortClick={onSortClick}
            onToggleKeyword={onToggleKeyword}
            onToggleAllVisible={onToggleAllVisible}
          />
        ) : (
          <DomainPagesTable
            rows={filteredPages}
            sortMode={sortMode}
            currentSortOrder={currentSortOrder}
            onSortClick={onSortClick}
          />
        )}
      </div>
    </div>
  );
}
