"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@tevero/ui";
import { AlertTriangle, Eye, Clock, RefreshCcw, X, ChevronDown, ChevronUp } from "lucide-react";
import type { AttentionItem } from "@/lib/dashboard/types";
import { dismissAttentionItem } from "@/app/(shell)/dashboard/actions";

interface NeedsAttentionSectionProps {
  items: AttentionItem[];
}

export function NeedsAttentionSection({ items }: NeedsAttentionSectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);

  const getSeverityColor = (severity: AttentionItem["severity"]) => {
    switch (severity) {
      case "critical": return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400";
      case "warning": return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400";
      case "info": return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400";
    }
  };

  const getTypeIcon = (type: AttentionItem["type"]) => {
    switch (type) {
      case "alert": return <AlertTriangle className="h-4 w-4" />;
      case "health": return <AlertTriangle className="h-4 w-4" />;
      case "connection": return <RefreshCcw className="h-4 w-4" />;
    }
  };

  const handleView = (item: AttentionItem) => {
    if (item.type === "connection") {
      router.push(`/clients/${item.clientId}/connections` as Parameters<typeof router.push>[0]);
    } else {
      router.push(`/clients/${item.clientId}/alerts` as Parameters<typeof router.push>[0]);
    }
  };

  const handleSnooze = async (item: AttentionItem) => {
    setDismissing(item.id);
    try {
      await dismissAttentionItem(item.id, "snooze");
      router.refresh();
    } finally {
      setDismissing(null);
    }
  };

  const handleDismiss = async (item: AttentionItem) => {
    setDismissing(item.id);
    try {
      await dismissAttentionItem(item.id, "dismiss");
      router.refresh();
    } finally {
      setDismissing(null);
    }
  };

  if (items.length === 0) {
    return null;
  }

  const criticalCount = items.filter(i => i.severity === "critical").length;

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Needs Attention</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {items.length}
            </Badge>
            {criticalCount > 0 && (
              <Badge className="bg-red-500 text-white">{criticalCount} critical</Badge>
            )}
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
          {items.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(item.severity)}`}
            >
              <div className="mt-0.5">{getTypeIcon(item.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{item.clientName}</span>
                  <Badge variant="outline" className="text-xs">
                    {item.type}
                  </Badge>
                </div>
                <p className="text-sm mt-1">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {item.message}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleView(item)}
                  className="h-8 px-2"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {item.type === "connection" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(item)}
                    className="h-8 px-2"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSnooze(item)}
                      disabled={dismissing === item.id}
                      className="h-8 px-2"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismiss(item)}
                      disabled={dismissing === item.id}
                      className="h-8 px-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length > 5 && (
            <Button variant="link" className="w-full" onClick={() => router.push("/alerts" as Parameters<typeof router.push>[0])}>
              View all {items.length} items
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
