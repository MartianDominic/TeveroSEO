'use client';

/**
 * ProspectContext Component
 * Phase 98-04: Right Rail showing prospect info and analysis results
 *
 * Displays:
 * - Domain health metrics (DA, DR, traffic, keywords)
 * - Keywords list with volume badges
 * - Feasibility assessments
 * - Proposal status
 * - Skeleton cards during analysis per D-01
 */

import type { SessionContext } from '@/lib/seo-chat/types';
import type { ToolProgress } from '@/hooks/useToolProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Globe, BarChart3, Target, FileText } from 'lucide-react';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProspectContextProps {
  /** Session context */
  context: SessionContext | null;
  /** Currently analyzing tool */
  analyzing: string | null;
  /** Tool progress */
  toolProgress: ToolProgress[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Prospect Context - Right Rail panel.
 *
 * Per D-01 spec: Show skeleton cards that fill with micro-animations
 * as tools complete. Uses Tailwind animate-in classes for smooth transitions.
 *
 * Layout: Fixed 340px width per v7 spec, scrollable content.
 */
export function ProspectContext({
  context,
  analyzing,
  toolProgress,
}: ProspectContextProps) {
  const { draft } = useSeoChatDraftStore();

  // Per D-01: Show skeleton cards during analysis
  const isAnalyzingDomain = analyzing === 'domain_health';
  const isAnalyzingKeywords = analyzing === 'keyword_analysis';
  const isCheckingFeasibility = analyzing === 'feasibility_check';

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Prospect Context
      </h3>

      {/* Domain Health Card */}
      <Card className="transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Domain Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAnalyzingDomain ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : draft.analysisResults.domainHealth ? (
            <div className="space-y-2 animate-in fade-in-50 duration-300">
              <p className="font-medium">
                {draft.analysisResults.domainHealth.domain}
              </p>
              <div className="flex gap-4 text-sm">
                <span>
                  DA: <strong>{draft.analysisResults.domainHealth.da}</strong>
                </span>
                <span>
                  DR: <strong>{draft.analysisResults.domainHealth.dr}</strong>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {draft.analysisResults.domainHealth.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No domain analyzed yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Keywords Card */}
      <Card className="transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Keywords ({draft.keywords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAnalyzingKeywords ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-6 w-4/6" />
            </div>
          ) : draft.keywords.length > 0 ? (
            <div className="space-y-1.5 animate-in fade-in-50 duration-300">
              {draft.keywords.slice(0, 5).map((kw) => (
                <div
                  key={kw.id}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="truncate flex-1">{kw.keyword}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {kw.volume.toLocaleString()}
                  </Badge>
                </div>
              ))}
              {draft.keywords.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{draft.keywords.length - 5} more
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No keywords added</p>
          )}
        </CardContent>
      </Card>

      {/* Feasibility Card */}
      <Card className="transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" />
            Feasibility
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCheckingFeasibility ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : draft.analysisResults.feasibilityResults.length > 0 ? (
            <div className="space-y-1.5 animate-in fade-in-50 duration-300">
              {draft.analysisResults.feasibilityResults
                .slice(0, 3)
                .map((fr, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="truncate flex-1">{fr.keyword}</span>
                    <Badge
                      variant={
                        fr.verdict === 'feasible' ? 'default' : 'secondary'
                      }
                      className="ml-2 text-xs"
                    >
                      {fr.verdict}
                    </Badge>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No feasibility checks
            </p>
          )}
        </CardContent>
      </Card>

      {/* Proposal Status Card */}
      {context?.proposalStatus && (
        <Card className="border-primary/50 animate-in slide-in-from-bottom-2 duration-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Proposal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default">{context.proposalStatus}</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
