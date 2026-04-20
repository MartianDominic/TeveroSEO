"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { ArrowUpDown, Search, ChevronRight, Loader2 } from "lucide-react";
import { FilterBar } from "./FilterBar";
import { usePaginatedClients } from "@/hooks/usePaginatedClients";
import type { FilterParams } from "@/types/pagination";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { GoalAttainmentBadge } from "./GoalAttainmentBadge";
import { PositionDistributionBar } from "./PositionDistributionBar";
import {
  HealthHoverPopover,
  TrafficHoverPopover,
  KeywordsHoverPopover,
} from "./ClientTableHoverPopover";
import { VirtualizedTable, type VirtualizedColumnDef } from "./VirtualizedTable";
import { LazySparkline } from "./LazySparkline";
import type {
  ClientMetrics,
  ClientSortKey,
  ClientTableFilters
} from "@/lib/dashboard/types";

interface ClientPortfolioTableProps {
  clients?: ClientMetrics[];
  onClientClick?: (clientId: string) => void;
  /** Enable row virtualization for large datasets (500+ clients) */
  useVirtualization?: boolean;
  /** Show lazy-loaded sparklines in the trend column */
  showSparklines?: boolean;
  /** Enable server-side pagination mode (ignores clients prop) */
  usePagination?: boolean;
  /** Workspace ID for paginated mode */
  workspaceId?: string;
}

const DEFAULT_FILTERS: ClientTableFilters = {
  search: "",
  healthRange: [0, 100],
  connectionStatus: [],
  tags: [],
  hasAlerts: null,
};

export function ClientPortfolioTable({
  clients = [],
  onClientClick,
  useVirtualization = false,
  showSparklines = false,
  usePagination = false,
  workspaceId,
}: ClientPortfolioTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<ClientSortKey>("healthScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc"); // Default descending for priority
  const [filters, setFilters] = useState<ClientTableFilters>(DEFAULT_FILTERS);
  const [paginationFilters, setPaginationFilters] = useState<FilterParams>({});

  // Pagination mode hook
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPaginationLoading,
  } = usePaginatedClients({
    workspaceId,
    sortBy: sortKey,
    sortDir,
    limit: 50,
    ...paginationFilters,
    enabled: usePagination,
  });

  // Get clients from pagination or props
  const paginatedClients = useMemo(() => {
    if (!usePagination) return [];
    return paginatedData?.pages.flatMap((page) => page.data) ?? [];
  }, [usePagination, paginatedData]);

  const totalCount = paginatedData?.pages[0]?.totalCount ?? 0;
  const activeFilterCount = Object.values(paginationFilters).filter(Boolean).length;

  // Source clients: use paginated data in pagination mode, props otherwise
  const sourceClients = usePagination ? paginatedClients : clients;

  // Filter clients (only applies in non-pagination mode)
  const filtered = useMemo(() => {
    if (usePagination) return sourceClients; // Server handles filtering
    return sourceClients.filter((client) => {
      // Search filter
      if (filters.search) {
        const query = filters.search.toLowerCase();
        if (!client.clientName.toLowerCase().includes(query)) return false;
      }

      // Health range filter
      if (client.healthScore < filters.healthRange[0] ||
          client.healthScore > filters.healthRange[1]) {
        return false;
      }

      // Connection status filter
      if (filters.connectionStatus.length > 0 &&
          !filters.connectionStatus.includes(client.connectionStatus)) {
        return false;
      }

      // Has alerts filter
      if (filters.hasAlerts === true && client.alertsOpen === 0) return false;
      if (filters.hasAlerts === false && client.alertsOpen > 0) return false;

      return true;
    });
  }, [sourceClients, filters, usePagination]);

  // Sort clients (only applies in non-pagination mode)
  const sorted = useMemo(() => {
    if (usePagination) return filtered; // Server handles sorting
    return [...filtered].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      // Handle optional fields that may not exist on ClientMetrics
      if (sortKey === "addedAt") {
        aVal = 0;
        bVal = 0;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [filtered, sortKey, sortDir, usePagination]);

  const toggleSort = (key: ClientSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default descending for numeric, ascending for text
      setSortDir(key === "clientName" ? "asc" : "desc");
    }
  };

  const handleRowClick = (clientId: string) => {
    if (onClientClick) {
      onClientClick(clientId);
    } else {
      router.push(`/clients/${clientId}/analytics` as Parameters<typeof router.push>[0]);
    }
  };

  const formatTrend = (pct: number) => {
    const formatted = `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
    if (pct > 0.05) return <span className="text-emerald-600">{formatted}</span>;
    if (pct < -0.05) return <span className="text-red-600">{formatted}</span>;
    return <span className="text-muted-foreground">{formatted}</span>;
  };

  const SortButton = ({ column, children }: { column: ClientSortKey; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(column)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === column ? "text-foreground" : "text-muted-foreground"}`} />
    </button>
  );

  // Column definitions for VirtualizedTable
  const virtualizedColumns: VirtualizedColumnDef<ClientMetrics>[] = useMemo(() => [
    {
      id: "clientName",
      header: <SortButton column="clientName">Client</SortButton>,
      width: 200,
      cell: (client) => (
        <div className="flex items-center gap-2 font-medium">
          <span className="truncate">{client.clientName}</span>
          {client.connectionStatus === "stale" && (
            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
              Stale
            </Badge>
          )}
          {client.connectionStatus === "disconnected" && (
            <Badge variant="outline" className="text-xs bg-red-100 text-red-800">
              No GSC
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "health",
      header: <SortButton column="healthScore">Health</SortButton>,
      width: 100,
      cell: (client) => client.goalsTotalCount > 0 ? (
        <div className="flex flex-col gap-0.5">
          <GoalAttainmentBadge
            attainmentPct={client.goalAttainmentPct}
            goalsMet={client.goalsMetCount}
            goalsTotal={client.goalsTotalCount}
            trend={client.primaryGoalTrend}
            size="sm"
          />
          {client.primaryGoalName && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              {client.primaryGoalName}
            </span>
          )}
        </div>
      ) : (
        <HealthHoverPopover data={{
          score: client.healthScore,
          breakdown: client.healthBreakdown,
        }}>
          <HealthScoreBadge score={client.healthScore} showLabel={false} size="sm" />
        </HealthHoverPopover>
      ),
    },
    {
      id: "traffic",
      header: <SortButton column="trafficCurrent">Traffic (30d)</SortButton>,
      cell: (client) => (
        <TrafficHoverPopover data={{
          current: client.trafficCurrent,
          previous: client.trafficPrevious,
          trendPct: client.trafficTrendPct,
          dailyData: [],
        }}>
          {client.trafficCurrent.toLocaleString()}
        </TrafficHoverPopover>
      ),
      className: "text-right tabular-nums",
    },
    {
      id: "trend",
      header: <SortButton column="trafficTrendPct">Trend</SortButton>,
      width: showSparklines ? 120 : undefined,
      cell: (client) => showSparklines ? (
        <div className="flex items-center justify-end gap-2">
          <LazySparkline clientId={client.clientId} metric="traffic" width={60} height={20} />
          {formatTrend(client.trafficTrendPct)}
        </div>
      ) : formatTrend(client.trafficTrendPct),
      className: "text-right tabular-nums",
    },
    {
      id: "keywords",
      header: <SortButton column="keywordsTotal">Keywords</SortButton>,
      cell: (client) => (
        <KeywordsHoverPopover data={{
          total: client.keywordsTotal,
          top10: client.keywordsTop10,
          top3: client.keywordsTop3,
          position1: client.keywordsPosition1,
        }}>
          {client.keywordsTotal.toLocaleString()}
        </KeywordsHoverPopover>
      ),
      className: "text-right tabular-nums",
    },
    {
      id: "positions",
      header: "Positions",
      width: 150,
      cell: (client) => (
        <PositionDistributionBar
          top10={client.keywordsTop10}
          top3={client.keywordsTop3}
          position1={client.keywordsPosition1}
          total={client.keywordsTotal}
          showLabels={false}
        />
      ),
    },
    {
      id: "alerts",
      header: <SortButton column="alertsOpen">Alerts</SortButton>,
      cell: (client) => client.alertsOpen > 0 ? (
        <Badge
          variant="secondary"
          className={client.alertsCritical > 0 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}
        >
          {client.alertsOpen}
        </Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
      className: "text-right",
    },
    {
      id: "arrow",
      header: "",
      width: 50,
      cell: () => <ChevronRight className="h-4 w-4 text-muted-foreground" />,
    },
  ], [showSparklines, sortKey]);

  const handleVirtualizedRowClick = useCallback((row: ClientMetrics) => {
    handleRowClick(row.clientId);
  }, []);

  const getRowKey = useCallback((row: ClientMetrics) => row.id, []);

  // Handle infinite scroll load more
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading state for pagination mode
  if (usePagination && isPaginationLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pagination mode: FilterBar */}
      {usePagination && (
        <>
          <FilterBar
            filters={paginationFilters}
            onFiltersChange={setPaginationFilters}
            activeFilterCount={activeFilterCount}
          />
          <div className="text-sm text-muted-foreground">
            Showing {sorted.length} of {totalCount} clients
          </div>
        </>
      )}

      {/* Non-pagination mode: Search and Filters */}
      {!usePagination && (
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.hasAlerts === null ? "all" : filters.hasAlerts ? "with-alerts" : "no-alerts"}
          onValueChange={(v) => setFilters({
            ...filters,
            hasAlerts: v === "all" ? null : v === "with-alerts",
          })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Alert status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            <SelectItem value="with-alerts">With alerts</SelectItem>
            <SelectItem value="no-alerts">No alerts</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.healthRange[1] <= 60 ? "at-risk" :
                 filters.healthRange[0] >= 80 ? "healthy" : "all"}
          onValueChange={(v) => {
            if (v === "at-risk") setFilters({ ...filters, healthRange: [0, 60] });
            else if (v === "healthy") setFilters({ ...filters, healthRange: [80, 100] });
            else setFilters({ ...filters, healthRange: [0, 100] });
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Health filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            <SelectItem value="at-risk">At risk (&lt;60)</SelectItem>
            <SelectItem value="healthy">Healthy (80+)</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-sm text-muted-foreground">
          {filtered.length} of {clients.length} clients
        </div>
      </div>
      )}

      {/* Table - Virtualized or Standard based on prop */}
      {useVirtualization ? (
        <VirtualizedTable
          data={sorted}
          columns={virtualizedColumns}
          getRowKey={getRowKey}
          onRowClick={handleVirtualizedRowClick}
          rowHeight={64}
          overscan={10}
          emptyContent="No clients match your filters"
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <SortButton column="clientName">Client</SortButton>
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortButton column="healthScore">Health</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton column="trafficCurrent">Traffic (30d)</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton column="trafficTrendPct">Trend</SortButton>
                </TableHead>
                <TableHead className="text-right">
                  <SortButton column="keywordsTotal">Keywords</SortButton>
                </TableHead>
                <TableHead className="w-[150px]">Positions</TableHead>
                <TableHead className="text-right">
                  <SortButton column="alertsOpen">Alerts</SortButton>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No clients match your filters
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((client) => (
                  <TableRow
                    key={client.id}
                    onClick={() => handleRowClick(client.clientId)}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{client.clientName}</span>
                        {client.connectionStatus === "stale" && (
                          <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                            Stale
                          </Badge>
                        )}
                        {client.connectionStatus === "disconnected" && (
                          <Badge variant="outline" className="text-xs bg-red-100 text-red-800">
                            No GSC
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.goalsTotalCount > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <GoalAttainmentBadge
                            attainmentPct={client.goalAttainmentPct}
                            goalsMet={client.goalsMetCount}
                            goalsTotal={client.goalsTotalCount}
                            trend={client.primaryGoalTrend}
                            size="sm"
                          />
                          {client.primaryGoalName && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                              {client.primaryGoalName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <HealthHoverPopover data={{
                          score: client.healthScore,
                          breakdown: client.healthBreakdown,
                        }}>
                          <HealthScoreBadge score={client.healthScore} showLabel={false} size="sm" />
                        </HealthHoverPopover>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <TrafficHoverPopover data={{
                        current: client.trafficCurrent,
                        previous: client.trafficPrevious,
                        trendPct: client.trafficTrendPct,
                        dailyData: [], // Would be populated from extended data
                      }}>
                        {client.trafficCurrent.toLocaleString()}
                      </TrafficHoverPopover>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {showSparklines ? (
                        <div className="flex items-center justify-end gap-2">
                          <LazySparkline clientId={client.clientId} metric="traffic" width={60} height={20} />
                          {formatTrend(client.trafficTrendPct)}
                        </div>
                      ) : formatTrend(client.trafficTrendPct)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <KeywordsHoverPopover data={{
                        total: client.keywordsTotal,
                        top10: client.keywordsTop10,
                        top3: client.keywordsTop3,
                        position1: client.keywordsPosition1,
                      }}>
                        {client.keywordsTotal.toLocaleString()}
                      </KeywordsHoverPopover>
                    </TableCell>
                    <TableCell>
                      <PositionDistributionBar
                        top10={client.keywordsTop10}
                        top3={client.keywordsTop3}
                        position1={client.keywordsPosition1}
                        total={client.keywordsTotal}
                        showLabels={false}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {client.alertsOpen > 0 ? (
                        <Badge
                          variant="secondary"
                          className={client.alertsCritical > 0 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {client.alertsOpen}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load More button for pagination mode */}
      {usePagination && hasNextPage && (
        <div className="text-center py-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
