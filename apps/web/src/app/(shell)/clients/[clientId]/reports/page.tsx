import { Suspense } from "react";
import {
  PageHeader,
  Card,
  CardContent,
  Skeleton,
} from "@tevero/ui";
import { ReportList } from "@/components/reports";
import { listClientReports } from "@/lib/reports/actions";

interface ReportsPageProps {
  params: Promise<{ clientId: string }>;
}

async function ReportsContent({ clientId }: { clientId: string }) {
  const result = await listClientReports(clientId);
  if (!result.success) {
    return (
      <div className="text-error p-4 bg-error-subtle rounded-lg">
        {result.error || "Failed to load reports"}
      </div>
    );
  }
  return <ReportList reports={result.data} clientId={clientId} />;
}

function ReportsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { clientId } = await params;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Generate, schedule, and download SEO performance reports"
        backHref={`/clients/${clientId}`}
      />

      <Card>
        <CardContent className="p-6">
          <Suspense fallback={<ReportsLoading />}>
            <ReportsContent clientId={clientId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
