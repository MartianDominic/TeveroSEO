"use client";

import Link from "next/link";
import { Button } from "@tevero/ui";
import { Plus, Settings } from "lucide-react";
import { ReportHistoryTable } from "./ReportHistoryTable";
import type { ReportMetadata } from "@tevero/types";

interface ReportListProps {
  reports: ReportMetadata[];
  clientId: string;
}

/**
 * Report list component with action buttons and history table.
 * Provides navigation to create new reports and configure schedules.
 */
export function ReportList({ reports, clientId }: ReportListProps) {
  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={
              `/clients/${clientId}/reports/new` as Parameters<
                typeof Link
              >[0]["href"]
            }
          >
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </Link>
          <Link
            href={
              `/clients/${clientId}/settings/reports` as Parameters<
                typeof Link
              >[0]["href"]
            }
          >
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Schedule Settings
            </Button>
          </Link>
        </div>
        <div className="text-sm text-text-3">
          {reports.filter((r) => r.status === "complete").length} reports generated
        </div>
      </div>

      {/* Report history table */}
      {reports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-text-3 mb-4">No reports yet</p>
          <Link
            href={
              `/clients/${clientId}/reports/new` as Parameters<
                typeof Link
              >[0]["href"]
            }
          >
            <Button>Create Your First Report</Button>
          </Link>
        </div>
      ) : (
        <ReportHistoryTable reports={reports} clientId={clientId} />
      )}
    </div>
  );
}
