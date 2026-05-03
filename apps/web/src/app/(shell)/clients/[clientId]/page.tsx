"use client";

/**
 * ClientDashboardPage - Client-specific dashboard.
 *
 * Refactored: Sub-components extracted to ./components/:
 * - StatCard
 * - IntelligenceStatusBanner
 * - ClientSetupChecklist
 * - RecentActivitySection
 */

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useClientStore } from "@/stores/clientStore";
import { useAnalyticsStore } from "@/stores/analyticsStore";
import { apiGet, apiPost } from "@/lib/api-client";
import { WithErrorBoundary } from "@/components/with-error-boundary";
import { logger } from "@/lib/logger";
import {
  Button,
  CmsHealthBadge,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@tevero/ui";
import {
  FileText,
  Calendar,
  Brain,
  Settings,
  PlusCircle,
  AlertCircle,
} from "lucide-react";

// Extracted components
import {
  StatCard,
  IntelligenceStatusBanner,
  ClientSetupChecklist,
  RecentActivitySection,
  type IntelligenceStatus,
} from "./components";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWordCount(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + "k";
  }
  return n.toString();
}

/**
 * Sanitize error messages to avoid exposing internal details to users.
 * Returns user-friendly messages for common error scenarios.
 */
function sanitizeError(error: string): string {
  const lowerError = error.toLowerCase();

  // Server errors - don't expose internal details
  if (lowerError.includes("500") || lowerError.includes("internal")) {
    return "An unexpected error occurred. Please try again.";
  }

  // Authentication/authorization errors
  if (lowerError.includes("401") || lowerError.includes("unauthorized")) {
    return "Please sign in to view this data.";
  }
  if (lowerError.includes("403") || lowerError.includes("forbidden")) {
    return "You don't have permission to view this data.";
  }

  // Not found errors
  if (lowerError.includes("404") || lowerError.includes("not found")) {
    return "The requested data could not be found.";
  }

  // Timeout errors
  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return "Request timed out. Please try again.";
  }

  // Network errors
  if (lowerError.includes("network") || lowerError.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }

  // Rate limiting
  if (lowerError.includes("429") || lowerError.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // For any other errors, return a generic message
  return "Failed to load data. Please try again.";
}

// ---------------------------------------------------------------------------
// ClientDashboardPage
// ---------------------------------------------------------------------------

export default function ClientDashboardPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();

  const { activeClient, setActiveClient, clients } = useClientStore();
  const {
    analytics,
    publishingLogs,
    loading,
    logsLoading,
    error,
    fetchAnalytics,
    fetchPublishingLogs,
  } = useAnalyticsStore();

  const [intelligenceStatus, setIntelligenceStatus] =
    useState<IntelligenceStatus>("not_started");

  // Sync store when navigating directly to a client URL
  useEffect(() => {
    if (clientId !== undefined && activeClient?.id !== clientId) {
      setActiveClient(clientId);
    }
  }, [clientId, activeClient?.id, setActiveClient]);

  // Fetch analytics and publishing logs whenever client changes
  useEffect(() => {
    if (clientId !== undefined) {
      fetchAnalytics(clientId);
      fetchPublishingLogs(clientId);
    }
  }, [clientId, fetchAnalytics, fetchPublishingLogs]);

  // Fetch intelligence status on mount / client change
  useEffect(() => {
    if (!clientId) return;
    apiGet<{ scrape_status?: string }>(`/api/client-intelligence/${clientId}`)
      .then((data) => {
        setIntelligenceStatus(
          (data.scrape_status as IntelligenceStatus) ?? "not_started"
        );
      })
      .catch((err) => {
        logger.error(
          "Failed to fetch intelligence status",
          err instanceof Error ? err : { error: String(err) }
        );
        setIntelligenceStatus("not_started");
      });
  }, [clientId]);

  // Poll every 5s while in_progress
  useEffect(() => {
    if (intelligenceStatus !== "in_progress" || !clientId) return;
    const interval = setInterval(() => {
      apiGet<{ scrape_status?: string }>(`/api/client-intelligence/${clientId}`)
        .then((data) => {
          setIntelligenceStatus(
            (data.scrape_status as IntelligenceStatus) ?? "not_started"
          );
        })
        .catch((err) => {
          logger.error(
            "Failed to poll intelligence status",
            err instanceof Error ? err : { error: String(err) }
          );
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [intelligenceStatus, clientId]);

  const triggerScrape = useCallback(() => {
    if (!clientId) return;
    setIntelligenceStatus("in_progress");
    apiPost(`/api/client-intelligence/${clientId}/scrape`, {}).catch(() =>
      setIntelligenceStatus("failed")
    );
  }, [clientId]);

  const displayClient =
    activeClient ?? clients.find((c) => c.id === clientId) ?? null;

  // Handle case where client cannot be found
  if (!displayClient) {
    return (
      <div className="p-8 md:p-10 space-y-8">
        <PageHeader
          title="Client Not Found"
          subtitle={`No client found with ID: ${clientId}`}
          backHref="/clients"
        />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            The requested client could not be found. It may have been deleted or
            you may not have access.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push("/clients" as Parameters<typeof router.push>[0])
            }
          >
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  // Determine if per-client checklist should be shown.
  const hasPublishedArticles =
    analytics !== null && analytics.articles_published_this_month > 0;
  const showChecklist =
    intelligenceStatus !== "completed" || !hasPublishedArticles;

  return (
    <div className="p-8 md:p-10 space-y-8">
      {/* Header */}
      <PageHeader
        title={displayClient?.name ?? "Dashboard"}
        subtitle={displayClient?.website_url ?? undefined}
        backHref="/clients"
        actions={
          analytics ? (
            <CmsHealthBadge lastPublishedAt={analytics.last_published_at} />
          ) : undefined
        }
      />

      {/* Intelligence status banner */}
      <IntelligenceStatusBanner
        status={intelligenceStatus}
        onTriggerScrape={triggerScrape}
      />

      {/* Per-client onboarding checklist */}
      {showChecklist && (
        <ClientSetupChecklist
          clientId={clientId}
          intelligenceStatus={intelligenceStatus}
        />
      )}

      {/* Error banner */}
      {!loading && error && (
        <ErrorBanner
          message={sanitizeError(error)}
          onRetry={() => {
            if (clientId) {
              fetchAnalytics(clientId);
              fetchPublishingLogs(clientId);
            }
          }}
        />
      )}

      {/* Stat cards */}
      <WithErrorBoundary name="ClientStatCards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loading ? (
            <>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </>
          ) : analytics ? (
            <>
              <StatCard
                label="Articles Published"
                value={analytics.articles_published_this_month}
                subtitle="this month"
              />
              <StatCard
                label="Total Words"
                value={formatWordCount(analytics.total_word_count_this_month)}
                subtitle="this month"
              />
              <StatCard
                label="Failed Publishes"
                value={analytics.failed_count_this_month}
                subtitle="this month"
              />
            </>
          ) : null}
        </div>
      </WithErrorBoundary>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              `/clients/${clientId}/calendar` as Parameters<typeof router.push>[0]
            )
          }
        >
          <Calendar className="h-4 w-4" /> View Calendar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              `/clients/${clientId}/intelligence` as Parameters<typeof router.push>[0]
            )
          }
        >
          <Brain className="h-4 w-4" /> Website Intelligence
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            router.push(
              `/clients/${clientId}/settings` as Parameters<typeof router.push>[0]
            )
          }
        >
          <Settings className="h-4 w-4" /> Settings
        </Button>
      </div>

      {/* Articles section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Articles</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  `/clients/${clientId}/articles` as Parameters<typeof router.push>[0]
                )
              }
            >
              <FileText className="h-4 w-4" />
              View All Articles
            </Button>
            <Button
              size="sm"
              onClick={() =>
                router.push(
                  `/clients/${clientId}/articles/new` as Parameters<typeof router.push>[0]
                )
              }
            >
              <PlusCircle className="h-4 w-4" />
              New Article
            </Button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            Generate SEO articles in your client&apos;s brand voice. Click
            &ldquo;New Article&rdquo; to get started.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(
                `/clients/${clientId}/articles/new` as Parameters<typeof router.push>[0]
              )
            }
          >
            <PlusCircle className="h-4 w-4" />
            New Article
          </Button>
        </div>
      </div>

      {/* Recent activity */}
      <WithErrorBoundary name="RecentActivitySection">
        <RecentActivitySection
          clientId={clientId}
          logs={publishingLogs}
          isLoading={logsLoading}
        />
      </WithErrorBoundary>
    </div>
  );
}
