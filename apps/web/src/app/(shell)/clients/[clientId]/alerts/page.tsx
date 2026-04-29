import { Suspense } from "react";
import {
  PageHeader,
  Card,
  CardContent,
  Skeleton,
} from "@tevero/ui";
import { AlertsTable } from "@/components/alerts/AlertsTable";
import { getClientAlerts } from "@/actions/alerts";

interface AlertsPageProps {
  params: Promise<{ clientId: string }>;
}

async function AlertsContent({ clientId }: { clientId: string }) {
  const result = await getClientAlerts(clientId);
  if (!result.success) {
    return <div className="text-destructive p-4">{result.error || "Failed to load alerts"}</div>;
  }
  return <AlertsTable alerts={result.data} clientId={clientId} />;
}

function AlertsLoading() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export default async function AlertsPage({ params }: AlertsPageProps) {
  const { clientId } = await params;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Alerts"
        subtitle="Monitor ranking drops and other important notifications"
        backHref={`/clients/${clientId}`}
      />

      <Card>
        <CardContent className="p-6">
          <Suspense fallback={<AlertsLoading />}>
            <AlertsContent clientId={clientId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
