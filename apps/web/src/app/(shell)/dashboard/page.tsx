import { getFastApi } from "@/lib/server-fetch";
import { PageHeader } from "@tevero/ui";
import { DashboardTable } from "@/components/analytics/DashboardTable";
import type { DashboardClient } from "@/lib/analytics/types";

async function getDashboardData(): Promise<DashboardClient[]> {
  try {
    return await getFastApi<DashboardClient[]>("/api/analytics/dashboard");
  } catch {
    // Return empty array on error - let UI handle empty state
    return [];
  }
}

export default async function DashboardPage() {
  const clients = await getDashboardData();

  // Split into attention needed vs healthy
  const needsAttention = clients.filter(
    (c) => c.status === "drop" || c.status === "stale"
  );
  const allClients = clients;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Agency-wide organic traffic overview"
      />

      {/* Needs attention section */}
      {needsAttention.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-500">
            Needs Attention ({needsAttention.length})
          </h2>
          <DashboardTable clients={needsAttention} showAttentionHeader />
        </section>
      )}

      {/* All clients */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          All Clients ({allClients.length})
        </h2>
        <DashboardTable clients={allClients} />
      </section>
    </div>
  );
}
