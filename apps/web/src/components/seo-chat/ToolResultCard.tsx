'use client';

import { DomainHealthCard } from './cards/DomainHealthCard';
import { KeywordAnalysisCard } from './cards/KeywordAnalysisCard';
import { FeasibilityCard } from './cards/FeasibilityCard';
import { ProposalGeneratedCard } from './cards/ProposalGeneratedCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';

interface ToolResultCardProps {
  toolName: string;
  state: 'pending' | 'partial-call' | 'call' | 'result';
  result?: any;
  partialArgs?: any;
}

export function ToolResultCard({ toolName, state, result, partialArgs }: ToolResultCardProps) {
  // Show skeleton during pending/streaming states per D-01
  if (state !== 'result') {
    return (
      <Card className="w-full max-w-md animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {getToolDisplayName(toolName)}...
            </span>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Route to appropriate card component
  switch (toolName) {
    case 'domain_health':
      return <DomainHealthCard result={result} />;
    case 'keyword_analysis':
      return <KeywordAnalysisCard result={result} />;
    case 'feasibility_check':
      return <FeasibilityCard result={result} />;
    case 'add_to_proposal':
      return <AddToProposalCard result={result} />;
    case 'generate_proposal':
      return <ProposalGeneratedCard result={result} />;
    default:
      return (
        <Card className="w-full max-w-md">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Unknown tool: {toolName}
            </p>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      );
  }
}

function getToolDisplayName(toolName: string): string {
  const names: Record<string, string> = {
    domain_health: 'Analyzing domain health',
    keyword_analysis: 'Analyzing keywords',
    feasibility_check: 'Checking feasibility',
    add_to_proposal: 'Adding to proposal',
    generate_proposal: 'Generating proposal',
  };
  return names[toolName] || toolName;
}

/**
 * AddToProposalCard - Internal component (not exported)
 *
 * Simple confirmation card for add_to_proposal tool results.
 * Kept inline because it's just a success message with counts.
 */
function AddToProposalCard({ result }: { result: { added: number; total: number } }) {
  return (
    <Card className="w-full max-w-md border-green-500/50 bg-green-50/50 dark:bg-green-950/20 animate-in fade-in-50 duration-300">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          Added {result.added} keywords to proposal ({result.total} total)
        </p>
      </CardContent>
    </Card>
  );
}
