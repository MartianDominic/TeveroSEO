"use client";

import { useEffect, useState, useTransition, useCallback } from "react";

import { useParams, useRouter } from "next/navigation";

import { RefreshCw, AlertCircle, ExternalLink } from "lucide-react";

import { DateRangeSelector } from "@/components/analytics/DateRangeSelector";
import { GA4Chart } from "@/components/analytics/GA4Chart";
import { GSCChart } from "@/components/analytics/GSCChart";
import { QueriesTable } from "@/components/analytics/QueriesTable";
import { StatCard } from "@/components/analytics/StatCard";
import type { AnalyticsData } from "@/lib/analytics/types";
import { useClientStore } from "@/stores/clientStore";

import { PageHeader, Card, CardContent, Button, Skeleton } from "@tevero/ui";

import { fetchAnalyticsData } from "./actions";

export default function AnalyticsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const clients = useClientStore((s) => s.clients);
  const clientName = clients.find((c) => c.id === clientId)?.name ?? null;

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dateRange, setDateRange] = useState<"30" | "90">("30");
  const [isPending, startTransition] = useTransition();

  // HIGH-04 FIX: Use useCallback to avoid stale closure bug with dateRange
  const loadData = useCallback(async (range: "30" | "90" = dateRange) => {
    setLoading(true);
    setError(false);
    const result = await fetchAnalyticsData(clientId, parseInt(range) as 30 | 90);
    if (result) {
      setData(result);
    } else {
      setError(true);
    }
    setLoading(false);
  }, [clientId, dateRange]);

  // Initial load on mount and when clientId changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // HIGH-04 FIX: Pass the new value directly to avoid stale closure
  const handleDateRangeChange = useCallback((value: "30" | "90") => {
    setDateRange(value);
    startTransition(async () => {
      // Use the value parameter directly instead of relying on state
      const result = await fetchAnalyticsData(clientId, parseInt(value) as 30 | 90);
      if (result) {
        setData(result);
      }
    });
  }, [clientId]);

  const handleConnectGoogle = () => {
    router.push(`/clients/${clientId}/connections` as Parameters<typeof router.push>[0]);
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[280px] rounded-lg" />
        <Skeleton className="h-[280px] rounded-lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Analytics"
          subtitle={clientName ?? undefined}
          backHref={`/clients/${clientId}`}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center mt-6">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-base font-semibold text-foreground">
              Failed to load analytics
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              There was a problem loading analytics data.
            </p>
          </div>
          <Button variant="outline" onClick={() => loadData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state - no data
  const hasGSCData = data && data.gsc_daily.length > 0;
  const hasGA4Data = data && data.ga4_daily.length > 0;
  const hasNoData = !hasGSCData && !hasGA4Data;

  if (hasNoData) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <PageHeader
          title="Analytics"
          subtitle={clientName ?? undefined}
          backHref={`/clients/${clientId}`}
        />
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center mt-6">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-base font-semibold text-foreground">
              No analytics data yet
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Connect this client&apos;s Google account to start tracking Search Console
              and Analytics data.
            </p>
          </div>
          <Button onClick={handleConnectGoogle}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Google
          </Button>
        </div>
      </div>
    );
  }

  // Format helpers
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toLocaleString();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Analytics"
          subtitle={clientName ?? undefined}
          backHref={`/clients/${clientId}`}
        />
        <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
      </div>

      {/* MEDIUM-01 FIX: Non-blocking loading indicator instead of full-screen overlay */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Updating data...</span>
        </div>
      )}

      {/* Search Performance (GSC) Section */}
      {hasGSCData && data && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Search Performance
          </h2>

          {/* GSC Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Clicks"
              value={formatNumber(data.gsc_summary.clicks)}
              subtitle={`Last ${dateRange} days`}
            />
            <StatCard
              label="Impressions"
              value={formatNumber(data.gsc_summary.impressions)}
              subtitle={`Last ${dateRange} days`}
            />
            <StatCard
              label="CTR"
              value={`${(data.gsc_summary.ctr * 100).toFixed(1)}%`}
              subtitle="Average"
            />
            <StatCard
              label="Avg Position"
              value={data.gsc_summary.position.toFixed(1)}
              subtitle="Average"
            />
          </div>

          {/* GSC Chart */}
          <Card>
            <CardContent className="pt-6">
              <GSCChart data={data.gsc_daily} />
            </CardContent>
          </Card>

          {/* Top Queries */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Top Queries
              </h3>
              <QueriesTable queries={data.top_queries} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Traffic (GA4) Section */}
      {hasGA4Data && data && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Traffic
          </h2>

          {/* GA4 Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Sessions"
              value={formatNumber(data.ga4_summary.sessions)}
              subtitle={`Last ${dateRange} days`}
            />
            <StatCard
              label="Users"
              value={formatNumber(data.ga4_summary.users)}
              subtitle={`Last ${dateRange} days`}
            />
            <StatCard
              label="Conversions"
              value={formatNumber(data.ga4_summary.conversions)}
              subtitle={`Last ${dateRange} days`}
            />
            <StatCard
              label="Bounce Rate"
              value={`${data.ga4_summary.bounce_rate.toFixed(1)}%`}
              subtitle="Average"
            />
          </div>

          {/* GA4 Chart */}
          <Card>
            <CardContent className="pt-6">
              <GA4Chart data={data.ga4_daily} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* SEO Audit Link Section */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          SEO Audit
        </h2>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">
                  Run a technical SEO audit to identify issues
                </p>
                <p className="text-xs-safe text-muted-foreground mt-1">
                  Crawl pages, check Core Web Vitals, and find optimization opportunities
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(`/clients/${clientId}/seo` as Parameters<typeof router.push>[0])
                }
              >
                Go to SEO Audit
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
