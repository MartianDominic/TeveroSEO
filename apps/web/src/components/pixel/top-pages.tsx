"use client";

import * as React from "react";

import { ExternalLink, ChevronDown } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Button,
} from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export interface TopPage {
  url: string;
  views: number;
  avgTimeOnPage: number;
}

export interface TopPagesProps {
  pages: TopPage[];
  loading?: boolean;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function truncateUrl(url: string, maxLength: number = 40): string {
  // Remove protocol and www
  let clean = url.replace(/^https?:\/\//, "").replace(/^www\./, "");

  if (clean.length <= maxLength) return clean;

  // Keep start and end
  const start = clean.substring(0, Math.floor(maxLength / 2) - 2);
  const end = clean.substring(clean.length - Math.floor(maxLength / 2) + 2);
  return `${start}...${end}`;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TopPagesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function TopPages({
  pages,
  loading = false,
  className,
  onLoadMore,
  hasMore = false,
}: TopPagesProps) {
  // Calculate max views for bar scaling
  const maxViews = React.useMemo(() => {
    if (!pages || pages.length === 0) return 1;
    return Math.max(...pages.map((p) => p.views));
  }, [pages]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <TopPagesSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            No page data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Top Pages</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Header row */}
        <div className="flex items-center justify-between text-xs-safe text-muted-foreground uppercase tracking-wider mb-3 px-1">
          <span>Page</span>
          <div className="flex items-center gap-6">
            <span className="w-16 text-right">Views</span>
            <span className="w-16 text-right">Avg. Time</span>
          </div>
        </div>

        {/* Page rows */}
        <div className="space-y-1">
          {pages.map((page, index) => {
            const barWidth = (page.views / maxViews) * 100;

            return (
              <div
                key={page.url}
                className={cn(
                  "relative flex items-center justify-between py-2.5 px-2 rounded-md",
                  "hover:bg-muted/50 transition-colors group"
                )}
              >
                {/* Background bar */}
                <div
                  className="absolute inset-y-0 left-0 bg-primary/5 rounded-md transition-all"
                  style={{ width: `${barWidth}%` }}
                />

                {/* Content */}
                <div className="relative flex items-center gap-3 flex-1 min-w-0">
                  {/* Rank */}
                  <span className="flex-shrink-0 w-6 h-6 rounded bg-muted text-xs-safe font-medium flex items-center justify-center">
                    {index + 1}
                  </span>

                  {/* URL */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={page.url.startsWith("http") ? page.url : `https://${page.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm truncate hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <span className="truncate">{truncateUrl(page.url)}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-md">
                        <p className="break-all">{page.url}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Stats */}
                <div className="relative flex items-center gap-6">
                  <span className="w-16 text-right text-sm font-medium tabular-nums">
                    {formatNumber(page.views)}
                  </span>
                  <span className="w-16 text-right text-sm text-muted-foreground tabular-nums">
                    {formatDuration(page.avgTimeOnPage)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more button */}
        {hasMore && onLoadMore && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4 mr-1" />
              Show more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

TopPages.displayName = "TopPages";
