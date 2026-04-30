"use client";

import { useState, useMemo } from "react";
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tevero/ui";
import { Download, Eye, Search, Calendar, Filter } from "lucide-react";
import { ReportStatusBadge } from "./ReportStatusBadge";
import type { ReportMetadata, ReportStatus } from "@tevero/types";

interface ReportHistoryTableProps {
  reports: ReportMetadata[];
  clientId: string;
}

type FilterStatus = "all" | ReportStatus;
type SortField = "date" | "type" | "status";
type SortOrder = "asc" | "desc";

/**
 * Report history table with search, filtering, and sorting.
 * Shows all generated reports for a client with status, date range, and download actions.
 */
export function ReportHistoryTable({ reports, clientId }: ReportHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const filteredReports = useMemo(() => {
    let result = [...reports];

    // Apply search filter (report type and date range)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.reportType.toLowerCase().includes(query) ||
          getReportTypeLabel(r.reportType).toLowerCase().includes(query) ||
          r.dateRange.start.includes(query) ||
          r.dateRange.end.includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "date":
          comparison =
            new Date(a.generatedAt || a.dateRange.end).getTime() -
            new Date(b.generatedAt || b.dateRange.end).getTime();
          break;
        case "type":
          comparison = a.reportType.localeCompare(b.reportType);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }, [reports, searchQuery, statusFilter, sortField, sortOrder]);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as FilterStatus)}
        >
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="generating">Generating</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={`${sortField}-${sortOrder}`}
          onValueChange={(v) => {
            const [field, order] = v.split("-") as [SortField, SortOrder];
            setSortField(field);
            setSortOrder(order);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="type-asc">Type A-Z</SelectItem>
            <SelectItem value="status-asc">Status A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-hairline rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-2">
              <TableHead className="text-text-2">Report Type</TableHead>
              <TableHead className="text-text-2">Date Range</TableHead>
              <TableHead className="text-text-2">Generated</TableHead>
              <TableHead className="text-text-2">Status</TableHead>
              <TableHead className="text-text-2 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-text-3">
                  No reports found
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => (
                <TableRow
                  key={report.id}
                  className="hover:bg-surface-2 transition-colors"
                >
                  <TableCell className="font-medium text-text-1">
                    {getReportTypeLabel(report.reportType)}
                  </TableCell>
                  <TableCell className="text-text-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-text-3" />
                      {formatDateRange(report.dateRange.start, report.dateRange.end)}
                    </div>
                  </TableCell>
                  <TableCell className="text-text-3">
                    {report.generatedAt
                      ? formatDistanceToNow(new Date(report.generatedAt), {
                          addSuffix: true,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <ReportStatusBadge status={report.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={
                          `/clients/${clientId}/reports/${report.id}` as Parameters<
                            typeof Link
                          >[0]["href"]
                        }
                      >
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="text-sm text-text-3">
        Showing {filteredReports.length} of {reports.length} reports
      </div>
    </div>
  );
}

/**
 * Maps report type identifier to human-readable label.
 */
function getReportTypeLabel(type: string): string {
  switch (type) {
    case "monthly-seo":
      return "Monthly SEO Report";
    case "weekly-summary":
      return "Weekly Summary";
    default:
      return type;
  }
}
