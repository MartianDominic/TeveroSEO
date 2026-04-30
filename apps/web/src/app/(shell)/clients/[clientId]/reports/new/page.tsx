import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@tevero/ui";
import { ReportBuilder } from "@/components/reports/ReportBuilder";
import { getOpenSeo } from "@/lib/server-fetch";

type AnyRoute = Parameters<typeof redirect>[0];

/**
 * New Report Page
 *
 * Renders the report builder UI for creating custom reports.
 * Validates client ownership before allowing access.
 */

interface NewReportPageProps {
  params: Promise<{ clientId: string }>;
}

/** UUID v4 validation regex */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Fetch client name for display.
 * Returns null if client not found or not authorized.
 */
async function getClientName(clientId: string): Promise<string | null> {
  try {
    const client = await getOpenSeo<{ name: string }>(`/api/clients/${clientId}`);
    return client.name;
  } catch {
    return null;
  }
}

export default async function NewReportPage({ params }: NewReportPageProps) {
  const { clientId } = await params;

  // Validate UUID format (T-53-02: input validation)
  if (!UUID_REGEX.test(clientId)) {
    redirect("/clients" as AnyRoute);
  }

  // Fetch client to validate ownership
  const clientName = await getClientName(clientId);
  if (!clientName) {
    notFound();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="New Report"
        subtitle={`Create a custom report for ${clientName}`}
        backHref={`/clients/${clientId}/reports`}
      />
      <ReportBuilder clientId={clientId} clientName={clientName} />
    </div>
  );
}

/**
 * Generate metadata for the page.
 */
export async function generateMetadata({ params }: NewReportPageProps) {
  const { clientId } = await params;
  const clientName = await getClientName(clientId);

  return {
    title: clientName ? `New Report - ${clientName}` : "New Report",
    description: "Create a custom SEO performance report",
  };
}
