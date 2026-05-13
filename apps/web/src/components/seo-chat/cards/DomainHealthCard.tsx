'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, TrendingUp, Search, BarChart } from 'lucide-react';
import type { DomainHealthResult } from '@/lib/seo-chat/types';

interface DomainHealthCardProps {
  result: DomainHealthResult;
}

export function DomainHealthCard({ result }: DomainHealthCardProps) {
  const healthScore = Math.round((result.da + result.dr) / 2);
  const healthLabel = healthScore >= 40 ? 'Strong' : healthScore >= 20 ? 'Moderate' : 'Weak';
  const healthColor = healthScore >= 40 ? 'text-green-600' : healthScore >= 20 ? 'text-amber-600' : 'text-red-600';

  return (
    <Card className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Domain Health
          </span>
          <Badge variant="outline" className={healthColor}>
            {healthLabel}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium text-base">{result.domain}</p>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricItem icon={BarChart} label="DA" value={result.da} />
          <MetricItem icon={BarChart} label="DR" value={result.dr} />
          <MetricItem icon={TrendingUp} label="Traffic" value={formatNumber(result.traffic)} />
          <MetricItem icon={Search} label="Rankings" value={formatNumber(result.rankedKeywords)} />
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground border-t pt-3">
          {result.summary}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricItem({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
