"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@tevero/ui";
import { Download, Eye } from "lucide-react";
import { ReportStatusBadge } from "./ReportStatusBadge";
import type { ReportMetadata } from "@tevero/types";

interface ReportListProps {
  reports: ReportMetadata[];
  clientId: string;
}

export function ReportList({ reports, clientId }: ReportListProps) {
  if (reports.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No reports generated yet.</p>
        <p className="text-sm mt-2">
          Generate your first report to see it here.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Report Type</TableHead>
          <TableHead>Date Range</TableHead>
          <TableHead>Language</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Generated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="font-medium">
              {report.reportType === "monthly-seo" ? "Monthly SEO Report" : report.reportType}
            </TableCell>
            <TableCell>
              {report.dateRange.start} to {report.dateRange.end}
            </TableCell>
            <TableCell className="uppercase">{report.locale}</TableCell>
            <TableCell>
              <ReportStatusBadge status={report.status} />
            </TableCell>
            <TableCell>
              {report.generatedAt
                ? formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })
                : "-"}
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Link href={`/clients/${clientId}/reports/${report.id}` as Parameters<typeof Link>[0]["href"]}>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </Link>
              {report.status === "complete" && (
                <a href={`/api/reports/${report.id}/download`} download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    PDF
                  </Button>
                </a>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
