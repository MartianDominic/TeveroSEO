'use client';

/**
 * ProspectContext Component
 * Phase 98-04: Right Rail showing prospect info and analysis results
 * Phase 98-09: World-class tool progress with streaming states
 * Phase 98-10: Error recovery with retry buttons
 *
 * Displays:
 * - Domain health metrics (DA, DR, traffic, keywords)
 * - Keywords list with volume badges
 * - Feasibility assessments
 * - Proposal status
 * - Real-time streaming progress during tool execution
 * - Error states with retry buttons
 */

import { memo, useMemo, useCallback } from 'react';
import type { SessionContext } from '@/lib/seo-chat/types';
import type { ToolProgress } from '@/hooks/useToolProgress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Globe, BarChart3, Target, FileText, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProspectContextProps {
  /** Session context */
  context: SessionContext | null;
  /** Currently analyzing tool */
  analyzing: string | null;
  /** Tool execution progress for streaming states */
  toolProgress: ToolProgress[];
  /** Retry handler for failed tools */
  onRetry?: (toolName: string) => void;
}

// ---------------------------------------------------------------------------
// Error Configuration
// ---------------------------------------------------------------------------

interface ErrorConfig {
  title: string;
  suggestion: string;
  canRetry: boolean;
}

function getErrorConfig(error?: string): ErrorConfig {
  if (error?.includes('rate limit') || error?.includes('429')) {
    return { title: 'Rate limited', suggestion: 'Wait 30 seconds and retry', canRetry: true };
  }
  if (error?.includes('timeout') || error?.includes('ETIMEDOUT')) {
    return { title: 'Request timed out', suggestion: 'Try again', canRetry: true };
  }
  if (error?.includes('network') || error?.includes('ECONNREFUSED')) {
    return { title: 'Network error', suggestion: 'Check connection and retry', canRetry: true };
  }
  if (error?.includes('not found') || error?.includes('404')) {
    return { title: 'Not found', suggestion: 'Check the domain/keyword', canRetry: false };
  }
  return { title: 'Analysis failed', suggestion: 'Try again', canRetry: true };
}

// ---------------------------------------------------------------------------
// Helper: Extract partial result safely
// ---------------------------------------------------------------------------

function getPartialDomain(progress: ToolProgress | undefined): string | null {
  if (!progress?.partialResult) return null;
  const domain = progress.partialResult.domain;
  return typeof domain === 'string' ? domain : null;
}

function getPartialKeywordCount(progress: ToolProgress | undefined): number | null {
  if (!progress?.partialResult) return null;
  const keywords = progress.partialResult.keywords;
  if (Array.isArray(keywords)) return keywords.length;
  const count = progress.partialResult.count;
  return typeof count === 'number' ? count : null;
}

function getPartialKeyword(progress: ToolProgress | undefined): string | null {
  if (!progress?.partialResult) return null;
  const keyword = progress.partialResult.keyword;
  return typeof keyword === 'string' ? keyword : null;
}

// ---------------------------------------------------------------------------
// Error Alert Component
// ---------------------------------------------------------------------------

interface ErrorAlertProps {
  error: string;
  toolName: string;
  onRetry?: (toolName: string) => void;
}

function ErrorAlert({ error, toolName, onRetry }: ErrorAlertProps) {
  const config = getErrorConfig(error);

  return (
    <Alert variant="destructive" className="animate-in fade-in-50">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <span className="font-medium">{config.title}:</span>{' '}
          <span className="text-muted-foreground">{config.suggestion}</span>
        </div>
        {config.canRetry && onRetry && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onRetry(toolName)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
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
 * Phase 98-09: Enhanced with real-time streaming progress:
 * - Shows partial results during tool execution (e.g., "Found 47 keywords...")
 * - Displays specific context (e.g., "Analyzing groziosalon.lt...")
 * - Shows error states with retry guidance
 *
 * Phase 98-10: Error recovery with retry buttons
 * - Error classification (rate limit, timeout, network, not found)
 * - Contextual suggestions
 * - Retry button for recoverable errors
 *
 * Layout: Fixed 340px width per v7 spec, scrollable content.
 */
export const ProspectContext = memo(function ProspectContext({
  context,
  analyzing,
  toolProgress,
  onRetry,
}: ProspectContextProps) {
  // Granular selectors to prevent re-renders when unrelated draft fields change
  const keywords = useSeoChatDraftStore((s) => s.draft.keywords);
  const domainHealth = useSeoChatDraftStore((s) => s.draft.analysisResults.domainHealth);
  const feasibilityResults = useSeoChatDraftStore((s) => s.draft.analysisResults.feasibilityResults);

  // Extract tool-specific progress for streaming/error states
  const { domainProgress, keywordProgress, feasibilityProgress } = useMemo(() => ({
    domainProgress: toolProgress.find((t) => t.toolName === 'domain_health'),
    keywordProgress: toolProgress.find((t) => t.toolName === 'keyword_analysis'),
    feasibilityProgress: toolProgress.find((t) => t.toolName === 'feasibility_check'),
  }), [toolProgress]);

  // Derive states - streaming takes precedence for real-time feedback
  const isDomainStreaming = domainProgress?.state === 'streaming';
  const isDomainPending = domainProgress?.state === 'pending' || analyzing === 'domain_health';
  const isDomainError = domainProgress?.state === 'error';

  const isKeywordStreaming = keywordProgress?.state === 'streaming';
  const isKeywordPending = keywordProgress?.state === 'pending' || analyzing === 'keyword_analysis';
  const isKeywordError = keywordProgress?.state === 'error';

  const isFeasibilityStreaming = feasibilityProgress?.state === 'streaming';
  const isFeasibilityPending = feasibilityProgress?.state === 'pending' || analyzing === 'feasibility_check';
  const isFeasibilityError = feasibilityProgress?.state === 'error';

  // Extract partial results for streaming display
  const streamingDomain = getPartialDomain(domainProgress);
  const streamingKeywordCount = getPartialKeywordCount(keywordProgress);
  const streamingKeyword = getPartialKeyword(feasibilityProgress);

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
            {(isDomainStreaming || isDomainPending) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error state with retry */}
          {isDomainError && (
            <ErrorAlert
              error={domainProgress?.error ?? 'Domain analysis failed'}
              toolName="domain_health"
              onRetry={onRetry}
            />
          )}

          {/* Streaming state - show domain being analyzed */}
          {isDomainStreaming && !isDomainError && (
            <div
              className="space-y-2 animate-pulse"
              role="status"
              aria-live="polite"
              aria-label="Analyzing domain"
            >
              {streamingDomain && (
                <p className="text-sm font-medium text-primary">
                  Analyzing {streamingDomain}...
                </p>
              )}
              <Skeleton className="h-4 w-1/2 animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-8 w-full animate-shimmer" aria-hidden="true" />
              <span className="sr-only">Domain health analysis in progress</span>
            </div>
          )}

          {/* Pending state - generic skeleton */}
          {isDomainPending && !isDomainStreaming && !isDomainError && (
            <div className="space-y-2" role="status" aria-label="Analyzing domain health">
              <span className="sr-only">Loading domain health data</span>
              <Skeleton className="h-4 w-3/4 animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-4 w-1/2 animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-8 w-full animate-shimmer" aria-hidden="true" />
            </div>
          )}

          {/* Complete state - show results */}
          {!isDomainStreaming && !isDomainPending && !isDomainError && domainHealth && (
            <div className="space-y-2 animate-in fade-in-50 duration-300">
              <p className="font-medium">{domainHealth.domain}</p>
              <div className="flex gap-4 text-sm">
                <span>
                  DA: <strong>{domainHealth.da}</strong>
                </span>
                <span>
                  DR: <strong>{domainHealth.dr}</strong>
                </span>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{domainHealth.traffic.toLocaleString()} traffic</span>
                <span>{domainHealth.rankedKeywords.toLocaleString()} keywords</span>
              </div>
              <p className="text-xs text-muted-foreground">{domainHealth.summary}</p>
            </div>
          )}

          {/* Empty state */}
          {!isDomainStreaming && !isDomainPending && !isDomainError && !domainHealth && (
            <p className="text-sm text-muted-foreground">No domain analyzed yet</p>
          )}
        </CardContent>
      </Card>

      {/* Keywords Card */}
      <Card className="transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Keywords ({keywords.length})
            {(isKeywordStreaming || isKeywordPending) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error state with retry */}
          {isKeywordError && (
            <ErrorAlert
              error={keywordProgress?.error ?? 'Keyword analysis failed'}
              toolName="keyword_analysis"
              onRetry={onRetry}
            />
          )}

          {/* Streaming state - show count as keywords arrive */}
          {isKeywordStreaming && !isKeywordError && (
            <div
              className="space-y-2"
              role="status"
              aria-live="polite"
              aria-label="Analyzing keywords"
            >
              <p className="text-sm font-medium text-primary animate-pulse">
                {streamingKeywordCount !== null
                  ? `Found ${streamingKeywordCount} keywords...`
                  : 'Discovering keywords...'
                }
              </p>
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-full animate-shimmer" aria-hidden="true" />
                <Skeleton className="h-6 w-5/6 animate-shimmer" aria-hidden="true" />
                <Skeleton className="h-6 w-4/6 animate-shimmer" aria-hidden="true" />
              </div>
              <span className="sr-only">
                Keyword analysis in progress{streamingKeywordCount !== null ? `, found ${streamingKeywordCount} so far` : ''}
              </span>
            </div>
          )}

          {/* Pending state */}
          {isKeywordPending && !isKeywordStreaming && !isKeywordError && (
            <div className="space-y-2" role="status" aria-label="Analyzing keywords">
              <span className="sr-only">Loading keyword analysis data</span>
              <Skeleton className="h-6 w-full animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-6 w-5/6 animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-6 w-4/6 animate-shimmer" aria-hidden="true" />
            </div>
          )}

          {/* Complete state */}
          {!isKeywordStreaming && !isKeywordPending && !isKeywordError && keywords.length > 0 && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-300">
              {keywords.slice(0, 5).map((kw) => (
                <div key={kw.id} className="flex justify-between items-center text-sm">
                  <span className="truncate flex-1">{kw.keyword}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {kw.volume.toLocaleString()}
                  </Badge>
                </div>
              ))}
              {keywords.length > 5 && (
                <p className="text-xs text-muted-foreground">+{keywords.length - 5} more</p>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isKeywordStreaming && !isKeywordPending && !isKeywordError && keywords.length === 0 && (
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
            {(isFeasibilityStreaming || isFeasibilityPending) && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error state with retry */}
          {isFeasibilityError && (
            <ErrorAlert
              error={feasibilityProgress?.error ?? 'Feasibility check failed'}
              toolName="feasibility_check"
              onRetry={onRetry}
            />
          )}

          {/* Streaming state - show keyword being checked */}
          {isFeasibilityStreaming && !isFeasibilityError && (
            <div
              className="space-y-2"
              role="status"
              aria-live="polite"
              aria-label="Checking feasibility"
            >
              <p className="text-sm font-medium text-primary animate-pulse">
                {streamingKeyword
                  ? `Checking: "${streamingKeyword}"...`
                  : 'Analyzing feasibility...'
                }
              </p>
              <Skeleton className="h-4 w-full animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-4 w-2/3 animate-shimmer" aria-hidden="true" />
              <span className="sr-only">
                Feasibility check in progress{streamingKeyword ? ` for ${streamingKeyword}` : ''}
              </span>
            </div>
          )}

          {/* Pending state */}
          {isFeasibilityPending && !isFeasibilityStreaming && !isFeasibilityError && (
            <div className="space-y-2" role="status" aria-label="Checking feasibility">
              <span className="sr-only">Loading feasibility assessment</span>
              <Skeleton className="h-4 w-full animate-shimmer" aria-hidden="true" />
              <Skeleton className="h-4 w-2/3 animate-shimmer" aria-hidden="true" />
            </div>
          )}

          {/* Complete state */}
          {!isFeasibilityStreaming && !isFeasibilityPending && !isFeasibilityError && feasibilityResults.length > 0 && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-300">
              {feasibilityResults.slice(0, 3).map((fr) => (
                <div key={fr.keyword} className="flex justify-between items-center text-sm">
                  <span className="truncate flex-1">{fr.keyword}</span>
                  <Badge
                    variant={fr.verdict === 'feasible' ? 'default' : 'secondary'}
                    className="ml-2 text-xs"
                  >
                    {fr.verdict}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isFeasibilityStreaming && !isFeasibilityPending && !isFeasibilityError && feasibilityResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No feasibility checks</p>
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
});
