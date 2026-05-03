/**
 * ClientDashboardPage - Server Component
 *
 * HIGH-03 FIX: Converted from 403-line client component with multiple useEffects
 * to RSC pattern. Data is fetched server-side in parallel, then passed to client
 * component for interactivity (polling, navigation).
 *
 * Architecture:
 * - This RSC fetches all initial data in parallel (no waterfall)
 * - ClientDashboardView handles client-side state (polling, store sync)
 * - Sub-components extracted to ./components/
 */

import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getFastApi, FastApiError, CircuitOpenError } from "@/lib/server-fetch";
import { logger } from "@/lib/logger";
import type { Client } from "@tevero/types";
import { ClientDashboardView } from "./client-dashboard-view";
import type { IntelligenceStatus, PublishingLog } from "./components";

export const dynamic = "force-dynamic";

type AnyRoute = Parameters<typeof redirect>[0];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientAnalytics {
  articles_published_this_month: number;
  total_word_count_this_month: number;
  failed_count_this_month: number;
  last_published_at: string | null;
}

interface IntelligenceStatusResponse {
  scrape_status?: string;
}

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

async function getClient(clientId: string): Promise<Client | null> {
  try {
    const client = await getFastApi<Client>(`/api/clients/${clientId}`);
    return client;
  } catch (err) {
    if (err instanceof FastApiError && err.status === 404) {
      return null;
    }
    logger.error("[ClientDashboardPage] Failed to fetch client", {
      clientId,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

async function getAnalytics(clientId: string): Promise<ClientAnalytics | null> {
  try {
    const analytics = await getFastApi<ClientAnalytics>(`/api/analytics/clients/${clientId}`);
    return analytics;
  } catch (err) {
    logger.error("[ClientDashboardPage] Failed to fetch analytics", {
      clientId,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

async function getPublishingLogs(clientId: string): Promise<PublishingLog[]> {
  try {
    const logs = await getFastApi<PublishingLog[]>(`/api/analytics/clients/${clientId}/publishing-logs`);
    return logs;
  } catch (err) {
    logger.error("[ClientDashboardPage] Failed to fetch publishing logs", {
      clientId,
      error: err instanceof Error ? err.message : String(err)
    });
    return [];
  }
}

async function getIntelligenceStatus(clientId: string): Promise<IntelligenceStatus> {
  try {
    const data = await getFastApi<IntelligenceStatusResponse>(`/api/client-intelligence/${clientId}`);
    return (data.scrape_status as IntelligenceStatus) ?? "not_started";
  } catch (err) {
    logger.error("[ClientDashboardPage] Failed to fetch intelligence status", {
      clientId,
      error: err instanceof Error ? err.message : String(err)
    });
    return "not_started";
  }
}

// ---------------------------------------------------------------------------
// Page Props
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ clientId: string }>;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default async function ClientDashboardPage({ params }: PageProps) {
  // Verify authentication
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in" as AnyRoute);
  }

  // Await params (Next.js 15 requirement)
  const { clientId } = await params;

  // Fetch all data in parallel (no waterfall)
  const [client, analytics, publishingLogs, intelligenceStatus] = await Promise.all([
    getClient(clientId),
    getAnalytics(clientId),
    getPublishingLogs(clientId),
    getIntelligenceStatus(clientId),
  ]);

  // Handle client not found
  if (!client) {
    notFound();
  }

  // Pass data to client component for interactivity
  return (
    <ClientDashboardView
      client={client}
      clientId={clientId}
      initialAnalytics={analytics}
      initialPublishingLogs={publishingLogs}
      initialIntelligenceStatus={intelligenceStatus}
    />
  );
}
