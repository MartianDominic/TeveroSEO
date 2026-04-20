"use client";

/**
 * OpportunitiesPanel - displays prioritized opportunities for a client.
 * Phase 25: Team & Intelligence - Opportunity Identification
 */

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
} from "@tevero/ui";
import { Lightbulb, TrendingUp, Target, Zap, ArrowRight, FileText } from "lucide-react";
import Link from "next/link";
import { getClientOpportunities } from "@/actions/analytics/get-opportunities";
import type { Opportunity, OpportunityType } from "@/types/opportunities";
import { cn } from "@/lib/utils";

interface OpportunitiesPanelProps {
  clientId: string;
}

const opportunityIcons: Record<OpportunityType, React.ReactNode> = {
  ctr_improvement: <TrendingUp className="h-4 w-4" />,
  ranking_gap: <Target className="h-4 w-4" />,
  quick_win: <Zap className="h-4 w-4" />,
  content_opportunity: <FileText className="h-4 w-4" />,
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

export function OpportunitiesPanel({ clientId }: OpportunitiesPanelProps) {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ["opportunities", clientId],
    queryFn: () => getClientOpportunities(clientId),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading) {
    return <OpportunitiesSkeleton />;
  }

  if (!opportunities?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No opportunities identified yet.</p>
          <p className="text-sm mt-1">Check back after more data is collected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Opportunities
          <Badge variant="secondary">{opportunities.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {opportunities.slice(0, 5).map((opportunity) => (
          <OpportunityItem key={opportunity.id} opportunity={opportunity} />
        ))}

        {opportunities.length > 5 && (
          <Button variant="outline" className="w-full" asChild>
            <Link href={`/clients/${clientId}/opportunities` as Parameters<typeof Link>[0]["href"]}>
              View All {opportunities.length} Opportunities
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface OpportunityItemProps {
  opportunity: Opportunity;
}

function OpportunityItem({ opportunity }: OpportunityItemProps) {
  return (
    <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">
          {opportunityIcons[opportunity.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{opportunity.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {opportunity.description}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge className={cn("text-xs", impactColors[opportunity.impact])}>
              {opportunity.impact} impact
            </Badge>
            <Badge className={cn("text-xs", effortColors[opportunity.effort])}>
              {opportunity.effort} effort
            </Badge>
            {opportunity.metrics.estimatedGain != null &&
              opportunity.metrics.estimatedGain > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  +{opportunity.metrics.estimatedGain.toLocaleString()} potential
                </span>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunitiesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Opportunities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-3 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 bg-muted rounded mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-muted rounded" />
                  <div className="h-5 w-16 bg-muted rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
