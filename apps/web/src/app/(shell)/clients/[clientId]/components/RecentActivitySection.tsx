"use client";

/**
 * RecentActivitySection - Recent publishing activity table.
 *
 * Extracted from client dashboard page.
 */

import React from "react";

import { useRouter } from "next/navigation";

import { Calendar } from "lucide-react";

import {
  Button,
  Skeleton,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tevero/ui";

export interface PublishingLog {
  id: string;
  article_id: string;
  attempted_at: string;
  cms_type: string | null;
  status: string;
  http_status_code: number | null;
}

export interface RecentActivitySectionProps {
  clientId: string;
  logs: PublishingLog[];
  isLoading: boolean;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  clientId,
  logs,
  isLoading,
}) => {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border py-16 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-xs">
            No publishing activity yet. Add articles to the content calendar to get
            started.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(
                `/clients/${clientId}/calendar` as Parameters<typeof router.push>[0]
              )
            }
          >
            Open Calendar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-sm font-medium text-muted-foreground">
                article
              </TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">
                date
              </TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">
                cms
              </TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">
                status
              </TableHead>
              <TableHead className="text-sm font-medium text-muted-foreground">
                http
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.slice(0, 10).map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs-safe">
                  {log.article_id.slice(0, 8)}&hellip;
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(log.attempted_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.cms_type ?? "-"}
                </TableCell>
                <TableCell>
                  <StatusChip status={log.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.http_status_code ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
