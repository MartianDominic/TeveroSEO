/**
 * ClientsPage - Server Component
 *
 * HIGH-01 FIX: Converted from client component with useEffect data fetching
 * to RSC pattern. Data is fetched server-side and passed to client components.
 *
 * Architecture:
 * - This RSC fetches client data server-side (no waterfall)
 * - ClientListView handles client-side state (modal, navigation)
 * - GettingStartedCard conditionally renders based on data
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getFastApi, FastApiError, CircuitOpenError } from "@/lib/server-fetch";
import { logger } from "@/lib/logger";
import type { Client } from "@tevero/types";
import { ClientListView } from "./components/client-list-view";
import { ClientsError } from "./components/clients-error";

type AnyRoute = Parameters<typeof redirect>[0];

export const dynamic = "force-dynamic";

/**
 * Fetch clients from the backend server-side.
 * Returns empty array with error message on failure for graceful degradation.
 */
async function getClients(): Promise<{ clients: Client[]; error: string | null }> {
  try {
    const clients = await getFastApi<Client[]>("/api/clients");
    return { clients, error: null };
  } catch (err) {
    // Circuit breaker is open - service is unavailable
    if (err instanceof CircuitOpenError) {
      logger.warn("[ClientsPage] Circuit breaker open for AI-Writer service");
      return {
        clients: [],
        error: "The service is temporarily unavailable. Please try again in a moment."
      };
    }

    // Backend API error
    if (err instanceof FastApiError) {
      logger.error("[ClientsPage] Failed to fetch clients", {
        status: err.status,
        code: err.errorCode
      });

      // Don't expose internal errors
      if (err.status >= 500) {
        return { clients: [], error: "Unable to load clients. Please try again." };
      }

      return { clients: [], error: err.normalizedError.error };
    }

    // Unknown error
    logger.error(
      "[ClientsPage] Unexpected error fetching clients",
      err instanceof Error ? err : { error: String(err) }
    );
    return { clients: [], error: "An unexpected error occurred. Please try again." };
  }
}

export default async function ClientsPage() {
  // Verify authentication
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in" as AnyRoute);
  }

  // Fetch clients server-side
  const { clients, error } = await getClients();

  // If there's an error, show error state with retry
  if (error) {
    return <ClientsError message={error} />;
  }

  // Pass data to client component for interactivity
  return <ClientListView initialClients={clients} />;
}
