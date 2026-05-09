"use client";

/**
 * ClientDashboardView - Client Component
 *
 * HIGH-03 FIX: Extracted from page.tsx to handle client-side interactivity.
 * Receives pre-fetched data from RSC parent.
 *
 * Responsibilities:
 * - Intelligence status polling
 * - Client store synchronization
 * - Navigation handlers
 * - Scrape trigger
 */

import React, { useEffect, useState, useCallback } from "react";

import { useRouter } from "next/navigation";

import {
  FileText,
  Calendar,
  Brain,
  Settings,
  PlusCircle,
} from "lucide-react";

import { WithErrorBoundary } from "@/components/with-error-boundary";
import { apiGet, apiPost } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import { useClientStore } from "@/stores/clientStore";

import type { Client } from "@tevero/types";
import {
  Button,
  CmsHealthBadge,
  ErrorBanner,
  PageHeader,
  Skeleton,
} from "@tevero/ui";


// Extracted components
import {
  StatCard,
  IntelligenceStatusBanner,
  ClientSetupChecklist,
  RecentActivitySection,
  type IntelligenceStatus,
  type PublishingLog,
} from "./components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientAnalytics {
  articles_published_this_month: number;
  total_word_count_this_month: number;
  failed_count_this_month: number;
  last_published_at: string | null;
}

interface ClientDashboardViewProps {
  client: Client;
  clientId: string;
  initialAnalytics: ClientAnalytics | null;
  initialPublishingLogs: PublishingLog[];
  initialIntelligenceStatus: IntelligenceStatus;
}

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
 */
function sanitizeError(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes("500") || lowerError.includes("internal")) {
    return "An unexpected error occurred. Please try again.";
  }
  if (lowerError.includes("401") || lowerError.includes("unauthorized")) {
    return "Please sign in to view this data.";
  }
  if (lowerError.includes("403") || lowerError.includes("forbidden")) {
    return "You don't have permission to view this data.";
  }
  if (lowerError.includes("404") || lowerError.includes("not found")) {
    return "The requested data could not be found.";
  }
  if (lowerError.includes("timeout") || lowerError.includes("timed out")) {
    return "Request timed out. Please try again.";
  }
  if (lowerError.includes("network") || lowerError.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  if (lowerError.includes("429") || lowerError.includes("rate limit")) {
    return "Too many requests. Please wait a moment and try again.";
  }

  return "Failed to load data. Please try again.";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClientDashboardView({
  client,
  clientId,
  initialAnalytics,
  initialPublishingLogs,
  initialIntelligenceStatus,
}: ClientDashboardViewProps) {
  const router = useRouter();
  const { setActiveClient } = useClientStore();

  // Local state initialized from server-fetched data
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [publishingLogs, setPublishingLogs] = useState(initialPublishingLogs);
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceStatus>(
    initialIntelligenceStatus
  );
  const [error, setError] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);

  // Sync active client in store
  useEffect(() => {
    setActiveClient(clientId);
  }, [clientId, setActiveClient]);

  // Poll intelligence status while in_progress
  useEffect(() => {
    if (intelligenceStatus !== "in_progress") return;

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
    setIntelligenceStatus("in_progress");
    apiPost(`/api/client-intelligence/${clientId}/scrape`, {}).catch(() =>
      setIntelligenceStatus("failed")
    );
  }, [clientId]);

  const handleRetry = useCallback(() => {
    setError(null);
    // Refresh analytics
    apiGet<ClientAnalytics>(`/api/analytics/clients/${clientId}`)
      .then(setAnalytics)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      });
    // Refresh logs
    setLogsLoading(true);
    apiGet<PublishingLog[]>(`/api/analytics/clients/${clientId}/publishing-logs`)
      .then(setPublishingLogs)
      .catch((err) => {
        logger.error("Failed to refresh publishing logs", err instanceof Error ? err : { error: String(err) });
      })
      .finally(() => setLogsLoading(false));
  }, [clientId]);

  // Determine if per-client checklist should be shown
  const hasPublishedArticles =
    analytics !== null && analytics.articles_published_this_month > 0;
  const showChecklist =
    intelligenceStatus !== "completed" || !hasPublishedArticles;

  return (
    <div className="p-8 md:p-10 space-y-8">
      {/* Header */}
      <PageHeader
        title={client.name}
        subtitle={client.website_url ?? undefined}
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
      {error && (
        <ErrorBanner
          message={sanitizeError(error)}
          onRetry={handleRetry}
        />
      )}

      {/* Stat cards */}
      <WithErrorBoundary name="ClientStatCards">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {!analytics ? (
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
          ) : (
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
          )}
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
