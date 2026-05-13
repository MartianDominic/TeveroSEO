/**
 * Client Documents Page - Server Component
 * Phase 101: Document Management (D-04)
 *
 * Displays client folder view with engagement analytics.
 */
import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { logger } from "@/lib/logger";
import { getFastApi, FastApiError, getOpenSeo } from "@/lib/server-fetch";

import type { Client } from "@tevero/types";

import { ClientDocumentsView } from "./client-documents-view";

export const dynamic = "force-dynamic";

type AnyRoute = Parameters<typeof redirect>[0];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentResponse {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  syncMode: "two_way_sync" | "import_copy" | "link_only";
  viewCount: number;
  lastViewedAt: string | null;
  lastSyncedAt: string | null;
  externalUrl: string | null;
  createdAt: string;
}

interface HeatmapResponse {
  sectionId: string;
  sectionName: string;
  totalTimeMs: number;
  avgTimeMs: number;
  viewCount: number;
  avgScrollDepth: number | null;
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
    logger.error("[ClientDocumentsPage] Failed to fetch client", {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function getDocuments(clientId: string): Promise<DocumentResponse[]> {
  try {
    const response = await getOpenSeo<{ success: boolean; data: DocumentResponse[] }>(
      `/api/documents?clientId=${clientId}`
    );
    return response.data ?? [];
  } catch (err) {
    logger.error("[ClientDocumentsPage] Failed to fetch documents", {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function getHeatmapData(proposalId: string): Promise<HeatmapResponse[]> {
  try {
    const response = await getOpenSeo<{
      success: boolean;
      data: { heatmapData: HeatmapResponse[] };
    }>(`/api/documents/${proposalId}`);
    return response.data?.heatmapData ?? [];
  } catch (err) {
    logger.error("[ClientDocumentsPage] Failed to fetch heatmap data", {
      proposalId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
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

export default async function ClientDocumentsPage({ params }: PageProps) {
  // Verify authentication
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in" as AnyRoute);
  }

  // Await params (Next.js 15 requirement)
  const { clientId } = await params;

  // Fetch client and documents in parallel
  const [client, documents] = await Promise.all([
    getClient(clientId),
    getDocuments(clientId),
  ]);

  // Handle client not found
  if (!client) {
    notFound();
  }

  // Pass data to client component for interactivity
  return (
    <ClientDocumentsView
      client={client}
      clientId={clientId}
      initialDocuments={documents}
    />
  );
}
