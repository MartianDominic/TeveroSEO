"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { AlertTriangle, AlertCircle, Info, Check, X, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@tevero/ui";
import type { Alert } from "@/actions/alerts";
import { updateAlertStatus } from "@/actions/alerts";

interface AlertsTableProps {
  alerts: Alert[];
  clientId: string;
}

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

const severityColors = {
  critical: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

const statusBadgeVariant = {
  pending: "destructive" as const,
  acknowledged: "outline" as const,
  resolved: "secondary" as const,
  dismissed: "secondary" as const,
};

export function AlertsTable({ alerts: initialAlerts, clientId }: AlertsTableProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initialAlerts);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== "all" && alert.status !== statusFilter) return false;
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    return true;
  });

  const handleAction = async (
    alertId: string,
    action: "acknowledge" | "resolve" | "dismiss",
  ) => {
    startTransition(async () => {
      await updateAlertStatus(clientId, alertId, action);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                status: action === "acknowledge" ? "acknowledged" : action === "resolve" ? "resolved" : "dismissed",
              }
            : a,
        ),
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Severity</TableHead>
              <TableHead>Alert</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[150px]">Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No alerts found
                </TableCell>
              </TableRow>
            ) : (
              filteredAlerts.map((alert) => {
                const Icon = severityIcons[alert.severity];
                return (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className={cn("h-4 w-4", severityColors[alert.severity])} />
                        <span className="capitalize text-sm">{alert.severity}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {alert.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant[alert.status]}>
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-sm"
                        title={format(new Date(alert.createdAt), "PPpp")}
                      >
                        {formatDistanceToNow(new Date(alert.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {alert.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleAction(alert.id, "acknowledge")}
                              disabled={isPending}
                              title="Acknowledge"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleAction(alert.id, "resolve")}
                              disabled={isPending}
                              title="Resolve"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleAction(alert.id, "dismiss")}
                              disabled={isPending}
                              title="Dismiss"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {alert.status === "acknowledged" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleAction(alert.id, "resolve")}
                            disabled={isPending}
                            title="Resolve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
