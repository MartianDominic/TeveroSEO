/**
 * IndexCoverageChart
 * Phase 96-04: Index coverage stats visualization
 * WCAG 2.1 AA compliant: role="img", aria-label, hidden data table
 */
import { useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import type { IndexCoverageStats, IndexingQuota } from "@/server/features/analytics/types";

interface IndexCoverageChartProps {
  stats: IndexCoverageStats;
  quota?: IndexingQuota;
  onRefresh?: () => void;
  isLoading?: boolean;
}

// Color mapping for coverage states
const STATE_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  "Submitted and indexed": { bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2 },
  "Crawled - currently not indexed": { bg: "bg-yellow-100", text: "text-yellow-700", icon: AlertCircle },
  "Discovered - currently not indexed": { bg: "bg-orange-100", text: "text-orange-700", icon: Clock },
  "URL is unknown to Google": { bg: "bg-gray-100", text: "text-gray-700", icon: XCircle },
  "Blocked by robots.txt": { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  "Blocked by noindex": { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  "Not found (404)": { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  "Page with redirect": { bg: "bg-blue-100", text: "text-blue-700", icon: AlertCircle },
};

export function IndexCoverageChart({
  stats,
  quota,
  onRefresh,
  isLoading,
}: IndexCoverageChartProps) {
  const indexedPercent = useMemo(() => {
    if (stats.total === 0) return 0;
    return (stats.indexed / stats.total) * 100;
  }, [stats]);

  const sortedStates = useMemo(() => {
    return Object.entries(stats.byState)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);
  }, [stats.byState]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // Generate accessibility description
  const ariaLabel = useMemo(() => {
    const notIndexedPercent = stats.total > 0 ? ((stats.notIndexed / stats.total) * 100).toFixed(1) : 0;
    return `Index coverage chart showing ${stats.indexed.toLocaleString()} indexed pages (${indexedPercent.toFixed(1)}%) and ${stats.notIndexed.toLocaleString()} not indexed pages (${notIndexedPercent}%) out of ${stats.total.toLocaleString()} total pages.`;
  }, [stats, indexedPercent]);

  return (
    <div
      className="space-y-6"
      role="region"
      aria-label={ariaLabel}
    >
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Index Coverage
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={isLoading ? "Refreshing index coverage data" : "Refresh index coverage data"}
            className="flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        )}
      </div>

      {/* Visually hidden data table for screen readers */}
      <div className="sr-only">
        <table>
          <caption>Index Coverage Statistics</caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Count</th>
              <th scope="col">Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Indexed</td>
              <td>{stats.indexed.toLocaleString()}</td>
              <td>{indexedPercent.toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Not Indexed</td>
              <td>{stats.notIndexed.toLocaleString()}</td>
              <td>{((stats.notIndexed / stats.total) * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Total</td>
              <td>{stats.total.toLocaleString()}</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
        {sortedStates.length > 0 && (
          <table>
            <caption>Breakdown by Coverage State</caption>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Count</th>
                <th scope="col">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map(([state, count]) => (
                <tr key={state}>
                  <td>{state}</td>
                  <td>{count.toLocaleString()}</td>
                  <td>{((count / stats.total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-3 gap-4" role="list" aria-label="Index coverage summary">
        <div className="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4 dark:from-green-900/30 dark:to-green-800/20" role="listitem">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
            <span className="text-sm text-green-700 dark:text-green-400">
              Indexed
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-green-800 dark:text-green-300">
            {stats.indexed.toLocaleString()}
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            {indexedPercent.toFixed(1)}% of total
          </p>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-red-50 to-red-100 p-4 dark:from-red-900/30 dark:to-red-800/20" role="listitem">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            <span className="text-sm text-red-700 dark:text-red-400">
              Not Indexed
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-red-800 dark:text-red-300">
            {stats.notIndexed.toLocaleString()}
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            {((stats.notIndexed / stats.total) * 100).toFixed(1)}% of total
          </p>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-800/50 dark:to-gray-700/30" role="listitem">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-gray-600" aria-hidden="true" />
            <span className="text-sm text-gray-700 dark:text-gray-400">
              Total Pages
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-gray-300">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {formatDate(stats.lastUpdated)}
          </p>
        </div>
      </div>

      {/* Coverage bar */}
      <div className="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
        <div className="mb-2 flex justify-between text-sm">
          <span id="index-rate-label" className="text-gray-600 dark:text-gray-400">Index Rate</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {indexedPercent.toFixed(1)}%
          </span>
        </div>
        <div
          className="h-4 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
          role="progressbar"
          aria-valuenow={Math.round(indexedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby="index-rate-label"
          aria-valuetext={`${indexedPercent.toFixed(1)}% of pages indexed`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
            style={{ width: `${indexedPercent}%` }}
          />
        </div>
      </div>

      {/* Breakdown by state */}
      <div className="rounded-xl bg-[var(--surface)] shadow-[var(--shadow-card)] dark:bg-[var(--surface)]">
        <div className="border-b border-[var(--hairline-2)] p-4">
          <h4 className="font-medium text-gray-900 dark:text-white">
            Coverage by State
          </h4>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700" role="list" aria-label="Coverage states breakdown">
          {sortedStates.map(([state, count]) => {
            const config = STATE_COLORS[state] || {
              bg: "bg-gray-100",
              text: "text-gray-700",
              icon: AlertCircle,
            };
            const Icon = config.icon;
            const percent = ((count / stats.total) * 100).toFixed(1);

            return (
              <div
                key={state}
                className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 rounded"
                role="listitem"
                tabIndex={0}
                aria-label={`${state}: ${count.toLocaleString()} pages, ${percent}% of total`}
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-md p-1.5 ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.text}`} aria-hidden="true" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {state}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {count.toLocaleString()}
                  </span>
                  <span className="w-12 text-right text-sm text-gray-500">
                    {percent}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quota usage */}
      {quota && (
        <div className="rounded-xl bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] dark:bg-[var(--surface)]">
          <h4 className="mb-3 font-medium text-gray-900 dark:text-white">
            API Quota Usage (Today)
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Inspections
                </span>
                <span className="text-gray-900 dark:text-white">
                  {quota.inspectionsUsed} / {quota.inspectionsLimit}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    quota.inspectionsUsed / quota.inspectionsLimit > 0.9
                      ? "bg-red-500"
                      : "bg-blue-500"
                  }`}
                  style={{
                    width: `${(quota.inspectionsUsed / quota.inspectionsLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Indexing Requests
                </span>
                <span className="text-gray-900 dark:text-white">
                  {quota.indexingRequestsUsed} / {quota.indexingRequestsLimit}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    quota.indexingRequestsUsed / quota.indexingRequestsLimit > 0.9
                      ? "bg-red-500"
                      : "bg-purple-500"
                  }`}
                  style={{
                    width: `${(quota.indexingRequestsUsed / quota.indexingRequestsLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Resets at: {formatDate(quota.resetsAt)}
          </p>
        </div>
      )}
    </div>
  );
}
