import { HeaderHelpLabel } from "@/client/features/keywords/components";
import { ArrowLeft, Download, Loader2, SlidersHorizontal } from "lucide-react";
import {
  BacklinksNewLostChart,
  BacklinksTrendChart,
} from "./BacklinksPageCharts";
import { BacklinksFilterPanel } from "./BacklinksFilterPanel";
import { BacklinksTable } from "./BacklinksTable";
import { ReferringDomainsTable } from "./ReferringDomainsTable";
import { TopPagesTable } from "./TopPagesTable";
import type {
  BacklinksOverviewData,
  BacklinksSearchState,
} from "./backlinksPageTypes";
import {
  TAB_DESCRIPTIONS,
  formatRelativeTimestamp,
} from "./backlinksPageUtils";
import { exportBacklinksTabCsv } from "./export";
import type { BacklinksFiltersState } from "./useBacklinksFilters";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";

export function BacklinksOverviewPanels({
  data,
  onShowHistory,
  summaryStats,
}: {
  data: BacklinksOverviewData;
  onShowHistory: () => void;
  summaryStats: Array<{ label: string; value: string; description: string }>;
}) {
  return (
    <>
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 px-0 text-foreground/70 hover:bg-transparent"
          onClick={onShowHistory}
        >
          <ArrowLeft className="size-4" />
          Recent searches
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/65">
        <Badge variant="outline">{data.scope}</Badge>
        <span>Target: {data.displayTarget}</span>
        <span>-</span>
        <span>Updated {formatRelativeTimestamp(data.fetchedAt)}</span>
      </div>
      <OverviewGrid data={data} summaryStats={summaryStats} />
      {data.scope === "page" ? (
        <div className="alert alert-info">
          <span>
            Showing backlinks for this exact page. Enter a bare domain for
            site-wide results. Trend charts are only shown for domain-level
            lookups.
          </span>
        </div>
      ) : null}
    </>
  );
}

export function BacklinksResultsCard({
  activeTab,
  filteredData,
  filters,
  isTabLoading,
  tabErrorMessage,
  onSetActiveTab,
  exportTarget,
}: {
  activeTab: BacklinksSearchState["tab"];
  filteredData: {
    backlinks: BacklinksOverviewData["backlinks"];
    referringDomains: BacklinksOverviewData["referringDomains"];
    topPages: BacklinksOverviewData["topPages"];
  };
  filters: BacklinksFiltersState;
  isTabLoading: boolean;
  tabErrorMessage: string | null;
  onSetActiveTab: (tab: BacklinksSearchState["tab"]) => void;
  exportTarget: string;
}) {
  const currentFilterCount = filters[activeTab].activeFilterCount;

  return (
    <div className="border border-border rounded-xl bg-background overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="space-y-2">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground w-fit">
            <TabButton
              activeTab={activeTab}
              tab="backlinks"
              onClick={onSetActiveTab}
            >
              Backlinks
            </TabButton>
            <TabButton
              activeTab={activeTab}
              tab="domains"
              onClick={onSetActiveTab}
            >
              Referring Domains
            </TabButton>
            <TabButton
              activeTab={activeTab}
              tab="pages"
              onClick={onSetActiveTab}
            >
              Top Pages
            </TabButton>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">
            {TAB_DESCRIPTIONS[activeTab]}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="justify-start lg:justify-center"
          onClick={() =>
            exportBacklinksTabCsv({
              tab: activeTab,
              target: exportTarget,
              rows: filteredData,
            })
          }
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className={`gap-1.5 ${filters.showFilters ? "bg-accent" : ""}`}
          onClick={() => filters.setShowFilters((current) => !current)}
          title="Toggle table filters"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {currentFilterCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-primary px-1.5 py-0 text-[10px] font-medium text-primary-foreground border-0">
              {currentFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      {filters.showFilters ? (
        <BacklinksFilterPanel activeTab={activeTab} filters={filters} />
      ) : null}

      <div className="p-4">
        {tabErrorMessage ? (
          <div className="alert alert-error mb-3">
            <span>{tabErrorMessage}</span>
          </div>
        ) : null}
        {activeTab === "backlinks" ? (
          <BacklinksTable rows={filteredData.backlinks} />
        ) : null}
        {activeTab === "domains" && isTabLoading && !tabErrorMessage ? (
          <TabLoadingState label="Loading referring domains" />
        ) : null}
        {activeTab === "domains" && !isTabLoading && !tabErrorMessage ? (
          <ReferringDomainsTable rows={filteredData.referringDomains} />
        ) : null}
        {activeTab === "pages" && isTabLoading && !tabErrorMessage ? (
          <TabLoadingState label="Loading top pages" />
        ) : null}
        {activeTab === "pages" && !isTabLoading && !tabErrorMessage ? (
          <TopPagesTable rows={filteredData.topPages} />
        ) : null}
      </div>
    </div>
  );
}

function OverviewGrid({
  data,
  summaryStats,
}: {
  data: BacklinksOverviewData;
  summaryStats: Array<{ label: string; value: string; description: string }>;
}) {
  const domainScope = data.scope === "domain";

  return (
    <div
      className={`grid grid-cols-1 gap-3 ${domainScope ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}
    >
      <SummaryStatsGrid data={data} summaryStats={summaryStats} />
      {domainScope ? <TrendPanels data={data} /> : null}
    </div>
  );
}

function SummaryStatsGrid({
  data,
  summaryStats,
}: {
  data: BacklinksOverviewData;
  summaryStats: Array<{ label: string; value: string; description: string }>;
}) {
  const cardClassName = `bg-background border border-border ${data.scope === "domain" ? "md:col-span-2 xl:col-span-1" : ""}`;

  return (
    <Card className={cardClassName}>
      <CardContent className="p-4 xl:h-full">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 xl:gap-y-6">
          {summaryStats.map((item) => (
            <div key={item.label}>
              <div className="text-xs uppercase tracking-wide text-foreground/55">
                <HeaderHelpLabel
                  label={item.label}
                  helpText={item.description}
                />
              </div>
              <p className="text-2xl font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendPanels({ data }: { data: BacklinksOverviewData }) {
  return (
    <>
      <TrendCard
        title="Backlink growth"
        description="Backlinks and referring domains over the last year"
      >
        <BacklinksTrendChart data={data.trends} />
      </TrendCard>
      <TrendCard
        title="New vs lost"
        description="Backlink acquisition and attrition"
      >
        <BacklinksNewLostChart data={data.newLostTrends} />
      </TrendCard>
    </>
  );
}

function TrendCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="bg-background border border-border">
      <CardContent className="gap-2 p-4">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-xs text-foreground/55">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function TabButton({
  activeTab,
  children,
  onClick,
  tab,
}: {
  activeTab: BacklinksSearchState["tab"];
  children: string;
  onClick: (tab: BacklinksSearchState["tab"]) => void;
  tab: BacklinksSearchState["tab"];
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${activeTab === tab ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50"}`}
    >
      {children}
    </button>
  );
}

function TabLoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">{label}...</p>
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-full" />
    </div>
  );
}
