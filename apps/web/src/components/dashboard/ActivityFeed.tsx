"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tevero/ui";
import { Activity, Pause, Play, Trash2, Wifi, WifiOff } from "lucide-react";
import { useActivityFeed } from "@/lib/websocket/socket-client";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  EVENT_CATEGORIES,
  type ActivityEventType,
  type ActivityEventCategory
} from "@/lib/websocket/socket-events";

interface ActivityFeedProps {
  workspaceId: string;
}

export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const [filterCategory, setFilterCategory] = useState<ActivityEventCategory | "all">("all");
  const [filterClient, setFilterClient] = useState<string>("all");

  const filterTypes = filterCategory === "all"
    ? undefined
    : EVENT_CATEGORIES[filterCategory];

  const {
    events,
    isConnected,
    isPaused,
    pause,
    resume,
    clearEvents
  } = useActivityFeed({
    workspaceId,
    maxEvents: 50,
    filterTypes,
    filterClientId: filterClient === "all" ? undefined : filterClient,
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getEventIcon = (type: ActivityEventType) => {
    // Simple mapping - could be expanded with specific icons per type
    return <Activity className={`h-4 w-4 ${EVENT_TYPE_COLORS[type]}`} />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <CardTitle className="text-lg">Activity Feed</CardTitle>
            {isConnected ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 gap-1">
                <Wifi className="h-3 w-3" />
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-gray-100 text-gray-600 gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {isPaused && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Paused
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filterCategory}
              onValueChange={(v) => setFilterCategory(v as ActivityEventCategory | "all")}
            >
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="alerts">Alerts</SelectItem>
                <SelectItem value="rankings">Rankings</SelectItem>
                <SelectItem value="reports">Reports</SelectItem>
                <SelectItem value="connections">Connections</SelectItem>
                <SelectItem value="sync">Sync</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={isPaused ? resume : pause}
              className="h-8 px-2"
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearEvents}
              className="h-8 px-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isPaused ? (
                <p>Feed paused. Click play to resume.</p>
              ) : (
                <p>No recent activity. Events will appear here in real-time.</p>
              )}
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="mt-0.5">
                  {getEventIcon(event.type as ActivityEventType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {EVENT_TYPE_LABELS[event.type as ActivityEventType] || event.type}
                    </span>
                    {event.clientName && (
                      <Badge variant="outline" className="text-xs">
                        {event.clientName}
                      </Badge>
                    )}
                  </div>
                  {typeof event.data.message === 'string' && event.data.message && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {event.data.message}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(event.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
