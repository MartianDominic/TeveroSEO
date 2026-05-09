"use client";

/**
 * ActivityFeed Component
 * Phase 62-07: Smart Alert Detection & Real-time Activity Feed
 *
 * Real-time activity stream showing:
 * - Entity lifecycle events (prospects, proposals, contracts, invoices)
 * - Alert events
 * - Follow-up events
 * - Workflow events
 *
 * Features:
 * - Socket.IO real-time updates
 * - Connection status indicator
 * - Auto-scroll for new events
 * - Time formatting with date-fns
 */

import { formatDistanceToNow } from "date-fns";
import {
  Wifi,
  WifiOff,
  User,
  FileText,
  FileSignature,
  Receipt,
  AlertTriangle,
  Clock,
  GitBranch,
  CreditCard,
  MessageSquare,
  Activity,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useActivityFeed,
  type ActivityEvent,
} from "@/hooks/command-center/useActivityFeed";
import { cn } from "@/lib/utils";

/**
 * Entity type to icon mapping.
 */
const ENTITY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  prospect: User,
  proposal: FileText,
  contract: FileSignature,
  invoice: Receipt,
  alert: AlertTriangle,
  follow_up: Clock,
  workflow: GitBranch,
  payment: CreditCard,
  note: MessageSquare,
  default: Activity,
};

/**
 * Activity type to color mapping.
 */
const ACTIVITY_COLORS: Record<string, string> = {
  // Positive events
  prospect_converted: "text-green-600 dark:text-green-400",
  proposal_accepted: "text-green-600 dark:text-green-400",
  contract_signed: "text-green-600 dark:text-green-400",
  contract_executed: "text-green-600 dark:text-green-400",
  invoice_paid: "text-green-600 dark:text-green-400",
  payment_received: "text-green-600 dark:text-green-400",
  alert_resolved: "text-green-600 dark:text-green-400",
  workflow_completed: "text-green-600 dark:text-green-400",

  // Negative events
  proposal_declined: "text-red-600 dark:text-red-400",
  invoice_overdue: "text-red-600 dark:text-red-400",
  payment_failed: "text-red-600 dark:text-red-400",

  // Warning events
  alert_created: "text-orange-600 dark:text-orange-400",

  // Neutral events
  default: "text-muted-foreground",
};

interface ActivityFeedProps {
  workspaceId: string;
}

/**
 * Single activity item.
 */
function ActivityItem({ activity }: { activity: ActivityEvent }) {
  const entityType = (activity.data?.entityType as string) || "default";
  const Icon = ENTITY_ICONS[entityType] || ENTITY_ICONS.default;
  const colorClass = ACTIVITY_COLORS[activity.type] || ACTIVITY_COLORS.default;
  const title = (activity.data?.title as string) || activity.type;
  const description = activity.data?.description as string | undefined;

  return (
    <div className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/50 transition-colors">
      <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", colorClass)} />
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">{title}</p>
        {description && (
          <p className="text-xs-safe text-muted-foreground truncate">{description}</p>
        )}
        {activity.clientName && (
          <p className="text-xs-safe text-muted-foreground">
            {activity.clientName}
          </p>
        )}
      </div>
      <span className="text-xs-safe text-muted-foreground whitespace-nowrap flex-shrink-0">
        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
      </span>
    </div>
  );
}

/**
 * Loading skeleton for activity feed.
 */
function ActivitySkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-4" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Empty state when no activities.
 */
function NoActivities() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Activity className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground">No recent activity</p>
      <p className="text-xs-safe text-muted-foreground/70 mt-1">
        Activity will appear here in real-time
      </p>
    </div>
  );
}

/**
 * Connection status indicator.
 */
function ConnectionStatus({
  isConnected,
  isConnecting,
  error,
}: {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}) {
  if (isConnecting) {
    return (
      <div className="flex items-center gap-1.5" title="Connecting...">
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-xs-safe text-muted-foreground">Connecting</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5" title={error}>
        <WifiOff className="h-4 w-4 text-red-500" />
        <span className="text-xs-safe text-red-500">Error</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5" title="Connected">
        <Wifi className="h-4 w-4 text-green-500" />
        <span className="text-xs-safe text-green-600 dark:text-green-400">Live</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5" title="Disconnected">
      <WifiOff className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs-safe text-muted-foreground">Offline</span>
    </div>
  );
}

/**
 * ActivityFeed component shows real-time activity for the workspace.
 *
 * @param workspaceId - The workspace to display activity for
 */
export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const { activities, isConnected, isConnecting, error } =
    useActivityFeed(workspaceId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Activity Feed</CardTitle>
        <ConnectionStatus
          isConnected={isConnected}
          isConnecting={isConnecting}
          error={error}
        />
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="px-4 pb-4">
            {activities.length === 0 ? (
              <NoActivities />
            ) : (
              <div className="space-y-1">
                {activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
