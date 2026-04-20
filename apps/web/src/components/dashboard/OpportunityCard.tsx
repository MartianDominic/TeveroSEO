"use client";

/**
 * OpportunityCard - detailed view of a single opportunity.
 * Phase 25: Team & Intelligence - Opportunity Identification
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
} from "@tevero/ui";
import {
  Lightbulb,
  TrendingUp,
  Target,
  Zap,
  FileText,
  Check,
  X,
  ExternalLink,
  ArrowUp,
  ArrowRight,
} from "lucide-react";
import type { Opportunity, OpportunityType } from "@/types/opportunities";
import { cn } from "@/lib/utils";
import { OPPORTUNITY_TYPE_LABELS } from "@/types/opportunities";

interface OpportunityCardProps {
  opportunity: Opportunity;
  onDismiss?: (id: string) => void;
  onImplement?: (id: string) => void;
}

const opportunityIcons: Record<OpportunityType, React.ReactNode> = {
  ctr_improvement: <TrendingUp className="h-5 w-5" />,
  ranking_gap: <Target className="h-5 w-5" />,
  quick_win: <Zap className="h-5 w-5" />,
  content_opportunity: <FileText className="h-5 w-5" />,
};

const typeColors: Record<OpportunityType, string> = {
  ctr_improvement: "text-blue-600 dark:text-blue-400",
  ranking_gap: "text-purple-600 dark:text-purple-400",
  quick_win: "text-yellow-600 dark:text-yellow-400",
  content_opportunity: "text-green-600 dark:text-green-400",
};

const impactColors: Record<string, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const effortColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function OpportunityCard({
  opportunity,
  onDismiss,
  onImplement,
}: OpportunityCardProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [isImplementing, setIsImplementing] = useState(false);

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setIsDismissing(true);
    try {
      await onDismiss(opportunity.id);
    } finally {
      setIsDismissing(false);
    }
  };

  const handleImplement = async () => {
    if (!onImplement) return;
    setIsImplementing(true);
    try {
      await onImplement(opportunity.id);
    } finally {
      setIsImplementing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className={typeColors[opportunity.type]}>
              {opportunityIcons[opportunity.type]}
            </span>
            <div>
              <CardTitle className="text-lg">{opportunity.title}</CardTitle>
              <CardDescription>
                {OPPORTUNITY_TYPE_LABELS[opportunity.type]}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", impactColors[opportunity.impact])}>
              {opportunity.impact} impact
            </Badge>
            <Badge className={cn("text-xs", effortColors[opportunity.effort])}>
              {opportunity.effort} effort
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{opportunity.description}</p>

        {/* Metrics Visualization */}
        {opportunity.metrics && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Impact Visualization</h4>
            <div className="flex items-center gap-4">
              {opportunity.metrics.currentValue != null && (
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {formatMetricValue(opportunity.metrics.currentValue, opportunity.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">Current</p>
                </div>
              )}
              {opportunity.metrics.potentialValue != null && (
                <>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatMetricValue(opportunity.metrics.potentialValue, opportunity.type)}
                    </p>
                    <p className="text-xs text-muted-foreground">Potential</p>
                  </div>
                </>
              )}
              {opportunity.metrics.estimatedGain != null &&
                opportunity.metrics.estimatedGain > 0 && (
                  <div className="ml-auto text-right">
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <ArrowUp className="h-4 w-4" />
                      <span className="text-lg font-bold">
                        +{opportunity.metrics.estimatedGain.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Est. gain</p>
                  </div>
                )}
            </div>
          </div>
        )}

        {/* Keywords */}
        {opportunity.keywords && opportunity.keywords.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Keywords</h4>
            <div className="flex flex-wrap gap-1">
              {opportunity.keywords.map((keyword) => (
                <code
                  key={keyword}
                  className="text-xs bg-muted px-2 py-1 rounded font-mono"
                >
                  {keyword}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Pages */}
        {opportunity.pages && opportunity.pages.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Affected Pages</h4>
            <div className="space-y-1">
              {opportunity.pages.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {truncateUrl(url)}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {(onDismiss || onImplement) && (
          <div className="flex items-center gap-2 pt-2 border-t">
            {onImplement && (
              <Button
                onClick={handleImplement}
                disabled={isImplementing}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                {isImplementing ? "Marking..." : "Mark as Done"}
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="outline"
                onClick={handleDismiss}
                disabled={isDismissing}
              >
                <X className="h-4 w-4 mr-2" />
                {isDismissing ? "Dismissing..." : "Dismiss"}
              </Button>
            )}
          </div>
        )}

        {/* Priority indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Priority score: {opportunity.priority}/9</span>
          <span>
            Created: {opportunity.createdAt.toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format metric value based on opportunity type.
 */
function formatMetricValue(value: number, type: OpportunityType): string {
  switch (type) {
    case "ctr_improvement":
      return `${value.toFixed(1)}%`;
    case "ranking_gap":
    case "quick_win":
      return `#${Math.round(value)}`;
    default:
      return value.toLocaleString();
  }
}

/**
 * Truncate URL for display.
 */
function truncateUrl(url: string, maxLength = 60): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    if (path.length <= maxLength) return path;
    return path.slice(0, maxLength - 3) + "...";
  } catch {
    if (url.length <= maxLength) return url;
    return url.slice(0, maxLength - 3) + "...";
  }
}
