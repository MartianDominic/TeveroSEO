import { Suspense } from "react";
import {
  PageHeader,
  Card,
  CardContent,
  Skeleton,
} from "@tevero/ui";
import { ReportList, GenerateReportButton } from "@/components/reports";
import { listClientReports } from "@/lib/reports/actions";

interface ReportsPageProps {
  params: Promise<{ clientId: string }>;
}

async function ReportsContent({ clientId }: { clientId: string }) {
  const reports = await listClientReports(clientId);
  return <ReportList reports={reports} clientId={clientId} />;
}

function ReportsLoading() {
  return (
    <div className="space-y-4 p-6">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { clientId } = await params;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Reports"
          subtitle="Generate and download SEO performance reports"
          backHref={`/clients/${clientId}`}
        />
        <GenerateReportButton clientId={clientId} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Suspense fallback={<ReportsLoading />}>
            <ReportsContent clientId={clientId} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
