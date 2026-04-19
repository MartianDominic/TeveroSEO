"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@tevero/ui";
import { Trophy, TrendingUp, Award, Link2, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import type { WinItem } from "@/lib/dashboard/types";

interface WinsMilestonesSectionProps {
  wins: WinItem[];
}

export function WinsMilestonesSection({ wins }: WinsMilestonesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const getTypeIcon = (type: WinItem["type"]) => {
    switch (type) {
      case "position_1": return <Trophy className="h-4 w-4 text-yellow-500" />;
      case "top_10_entry": return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "traffic_milestone": return <Award className="h-4 w-4 text-blue-500" />;
      case "high_da_backlink": return <Link2 className="h-4 w-4 text-purple-500" />;
    }
  };

  const getTypeLabel = (type: WinItem["type"]) => {
    switch (type) {
      case "position_1": return "#1 Position";
      case "top_10_entry": return "Top 10 Entry";
      case "traffic_milestone": return "Traffic Milestone";
      case "high_da_backlink": return "High DA Backlink";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (wins.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Wins This Week</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No wins recorded this week. Keep working!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Wins This Week</CardTitle>
            <Badge className="ml-2 bg-emerald-500 text-white">{wins.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {wins.slice(0, 5).map((win) => (
            <div
              key={win.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
            >
              <div className="mt-0.5">{getTypeIcon(win.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{win.clientName}</span>
                  <Badge variant="outline" className="text-xs bg-white dark:bg-gray-800">
                    {getTypeLabel(win.type)}
                  </Badge>
                </div>
                <p className="text-sm mt-1 font-medium text-emerald-700 dark:text-emerald-400">
                  {win.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {win.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(win.achievedAt)}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {wins.length > 5 && (
            <Button variant="link" className="w-full">
              View all {wins.length} wins
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
