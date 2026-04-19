import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PageHeader,
  Card,
  CardContent,
  Button,
} from "@tevero/ui";
import { ArrowLeft, Download } from "lucide-react";
import { ReportPreview, ReportStatusBadge } from "@/components/reports";
import { getReportStatus } from "@/lib/reports/actions";

interface ReportDetailPageProps {
  params: Promise<{ clientId: string; reportId: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { clientId, reportId } = await params;

  let report;
  try {
    report = await getReportStatus(reportId);
  } catch {
    notFound();
  }

  // Verify client ownership
  if (report.clientId !== clientId) {
    notFound();
  }

  const dateRangeText = `${report.dateRange.start} to ${report.dateRange.end}`;
  const reportTypeLabel = report.reportType === "monthly-seo"
    ? "Monthly SEO Report"
    : report.reportType;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/clients/${clientId}/reports` as Parameters<typeof Link>[0]["href"]}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <PageHeader
              title={reportTypeLabel}
              subtitle={dateRangeText}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ReportStatusBadge status={report.status} />
          {report.status === "complete" && (
            <a href={`/api/reports/${reportId}/download`} download>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </a>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <ReportPreview reportId={reportId} initialStatus={report} />
        </CardContent>
      </Card>
    </div>
  );
}
