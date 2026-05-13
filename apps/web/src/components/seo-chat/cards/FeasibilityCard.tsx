'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import type { FeasibilityResult } from '@/lib/seo-chat/types';

interface FeasibilityCardProps {
  result: FeasibilityResult;
}

export function FeasibilityCard({ result }: FeasibilityCardProps) {
  const VerdictIcon = getVerdictIcon(result.verdict);
  const verdictColor = getVerdictColor(result.verdict);

  return (
    <Card className="w-full max-w-md animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Feasibility Check
          </span>
          <Badge variant="outline" className={verdictColor}>
            <VerdictIcon className="h-3 w-3 mr-1" />
            {result.verdict}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-medium">{result.keyword}</p>

        {/* Score progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Feasibility Score</span>
            <span className={verdictColor}>{result.score}%</span>
          </div>
          <Progress value={result.score} className="h-2" />
        </div>

        {/* Confidence indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Confidence:</span>
          <Badge variant="secondary" className="capitalize">
            {result.confidence}
          </Badge>
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <span className="font-medium">
              {result.timeline.minMonths}-{result.timeline.maxMonths} months
            </span>
            <span className="text-muted-foreground ml-1">estimated</span>
          </div>
        </div>

        {/* Caveats if any */}
        {result.timeline.caveats.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{result.timeline.caveats[0]}</span>
          </div>
        )}

        {/* Requirements summary */}
        <div className="border-t pt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Backlinks needed:</span>
            <p className="font-medium">{result.requirements.backlinksNeeded}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Content length:</span>
            <p className="font-medium">{result.requirements.contentWordCount.toLocaleString()} words</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case 'feasible': return CheckCircle;
    case 'challenging': return AlertTriangle;
    case 'difficult': return AlertTriangle;
    case 'unlikely': return XCircle;
    default: return Target;
  }
}

function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'feasible': return 'border-green-500 text-green-600';
    case 'challenging': return 'border-amber-500 text-amber-600';
    case 'difficult': return 'border-orange-500 text-orange-600';
    case 'unlikely': return 'border-red-500 text-red-600';
    default: return '';
  }
}
