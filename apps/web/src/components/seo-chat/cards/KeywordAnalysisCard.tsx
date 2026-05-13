'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Layers, TrendingUp } from 'lucide-react';
import type { KeywordAnalysisResult, Keyword } from '@/lib/seo-chat/types';

interface KeywordAnalysisCardProps {
  result: KeywordAnalysisResult;
}

export function KeywordAnalysisCard({ result }: KeywordAnalysisCardProps) {
  const topKeywords = result.keywords.slice(0, 5);

  return (
    <Card className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Keyword Analysis
          </span>
          <Badge variant="secondary">
            {result.keywords.length} keywords
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary stats */}
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {formatVolume(result.totalVolume)} monthly volume
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            {result.clusters.length} clusters
          </span>
        </div>

        {/* Top keywords list */}
        <div className="space-y-1.5">
          {topKeywords.map((kw) => (
            <KeywordRow key={kw.id} keyword={kw} />
          ))}
        </div>

        {result.keywords.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{result.keywords.length - 5} more keywords
          </p>
        )}

        {/* Clusters preview */}
        {result.clusters.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Top Clusters</p>
            <div className="flex flex-wrap gap-1.5">
              {result.clusters.slice(0, 4).map((cluster) => (
                <Badge
                  key={cluster.id}
                  variant="outline"
                  className={getFunnelColor(cluster.funnel)}
                >
                  {cluster.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KeywordRow({ keyword }: { keyword: Keyword }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 bg-muted/30 rounded text-sm">
      <span className="truncate flex-1">{keyword.keyword}</span>
      <div className="flex items-center gap-2 ml-2">
        <span className="text-muted-foreground text-xs">
          {formatVolume(keyword.volume)}
        </span>
        <Badge
          variant="outline"
          className={getFeasibilityColor(keyword.feasibility)}
        >
          {keyword.difficulty}
        </Badge>
      </div>
    </div>
  );
}

function formatVolume(vol: number): string {
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toString();
}

function getFeasibilityColor(feasibility: string): string {
  switch (feasibility) {
    case 'feasible': return 'border-green-500 text-green-600';
    case 'challenging': return 'border-amber-500 text-amber-600';
    case 'difficult': return 'border-orange-500 text-orange-600';
    case 'unlikely': return 'border-red-500 text-red-600';
    default: return '';
  }
}

function getFunnelColor(funnel: string): string {
  switch (funnel) {
    case 'bofu': return 'border-green-500 text-green-600'; // per D-04
    case 'mofu': return 'border-amber-500 text-amber-600'; // per D-04
    case 'tofu': return 'border-blue-500 text-blue-600';   // per D-04
    default: return '';
  }
}
