import { Card, CardContent, CardHeader, CardTitle, Badge } from "@tevero/ui";
import { Calendar, FileText, Search, ShieldAlert, Video } from "lucide-react";
import type { ScheduledItem } from "@/lib/dashboard/types";

interface UpcomingScheduledSectionProps {
  items: ScheduledItem[];
}

export function UpcomingScheduledSection({ items }: UpcomingScheduledSectionProps) {
  const getTypeIcon = (type: ScheduledItem["type"]) => {
    switch (type) {
      case "report": return <FileText className="h-4 w-4 text-blue-500" />;
      case "audit": return <Search className="h-4 w-4 text-purple-500" />;
      case "meeting": return <Video className="h-4 w-4 text-emerald-500" />;
      case "ssl_expiry": return <ShieldAlert className="h-4 w-4 text-orange-500" />;
    }
  };

  const getTypeLabel = (type: ScheduledItem["type"]) => {
    switch (type) {
      case "report": return "Report";
      case "audit": return "Audit";
      case "meeting": return "Meeting";
      case "ssl_expiry": return "SSL Expiry";
    }
  };

  const formatScheduledTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "< 1 hour";
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `${diffDays} days`;
    return date.toLocaleDateString();
  };

  const isUrgent = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle className="text-lg">Upcoming</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No upcoming items scheduled.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by scheduled time
  const sorted = [...items].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle className="text-lg">Upcoming</CardTitle>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-2 rounded-lg ${
              isUrgent(item.scheduledAt) ? "bg-orange-50 dark:bg-orange-900/20" : "bg-muted/50"
            }`}
          >
            <div className="mt-0.5">{getTypeIcon(item.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{item.clientName}</span>
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(item.type)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{item.title}</p>
            </div>
            <span className={`text-xs whitespace-nowrap ${
              isUrgent(item.scheduledAt) ? "text-orange-600 font-medium" : "text-muted-foreground"
            }`}>
              {formatScheduledTime(item.scheduledAt)}
            </span>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-xs text-center text-muted-foreground">
            +{items.length - 5} more items
          </p>
        )}
      </CardContent>
    </Card>
  );
}
