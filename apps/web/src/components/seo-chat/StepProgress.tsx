'use client';

/**
 * StepProgress Component
 * Phase 98-10: Claude Code-style staged progress indicator
 *
 * Shows tool execution like Claude Code:
 * - Monospace tool name + args (like terminal output)
 * - Segmented progress bar with step labels
 * - Current step highlighted with pulse animation
 * - Time elapsed in muted text
 */

import { memo, useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Step {
  id: string;
  label: string;
  estimatedMs: number;
}

export interface StepProgressProps {
  /** Tool name being executed */
  toolName: string;
  /** Tool arguments for display */
  toolArgs?: Record<string, unknown>;
  /** Execution start time (Date.now()) */
  startTime: number;
  /** Whether execution is complete */
  isComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Tool Stage Definitions
// ---------------------------------------------------------------------------

const TOOL_STAGES: Record<string, Step[]> = {
  domain_health: [
    { id: 'connect', label: 'Connecting to DataForSEO', estimatedMs: 2000 },
    { id: 'metrics', label: 'Fetching domain metrics', estimatedMs: 8000 },
    { id: 'backlinks', label: 'Analyzing backlink profile', estimatedMs: 6000 },
    { id: 'summary', label: 'Generating insights', estimatedMs: 3000 },
  ],
  keyword_analysis: [
    { id: 'seed', label: 'Extracting seed keywords', estimatedMs: 3000 },
    { id: 'expand', label: 'Expanding keyword universe', estimatedMs: 20000 },
    { id: 'metrics', label: 'Fetching search volumes', estimatedMs: 15000 },
    { id: 'cluster', label: 'Building topical clusters', estimatedMs: 8000 },
    { id: 'feasibility', label: 'Calculating feasibility', estimatedMs: 6000 },
  ],
  feasibility_check: [
    { id: 'serp', label: 'Analyzing SERP competitors', estimatedMs: 5000 },
    { id: 'factors', label: 'Calculating ranking factors', estimatedMs: 4000 },
    { id: 'timeline', label: 'Estimating timeline', estimatedMs: 2000 },
  ],
  generate_proposal: [
    { id: 'context', label: 'Gathering session context', estimatedMs: 1000 },
    { id: 'narrative', label: 'Writing proposal narrative', estimatedMs: 8000 },
    { id: 'link', label: 'Creating magic link', estimatedMs: 2000 },
  ],
  add_to_proposal: [
    { id: 'validate', label: 'Validating keywords', estimatedMs: 500 },
    { id: 'add', label: 'Adding to proposal draft', estimatedMs: 500 },
  ],
};

// Default stages for unknown tools
const DEFAULT_STAGES: Step[] = [
  { id: 'processing', label: 'Processing request', estimatedMs: 5000 },
];

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Extract display value from tool args.
 */
function getDisplayArg(args?: Record<string, unknown>): string {
  if (!args) return '...';
  // Check common arg names
  if (typeof args.domain === 'string') return args.domain;
  if (typeof args.keyword === 'string') return `"${args.keyword}"`;
  if (typeof args.url === 'string') return args.url;
  return '...';
}

/**
 * Format elapsed time in seconds.
 */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Step Progress - Claude Code-style tool execution display.
 *
 * Features:
 * - Real-time elapsed time counter
 * - Estimated step progression based on elapsed time
 * - Pulse animation on current step
 * - Green checkmarks for completed steps
 */
export const StepProgress = memo(function StepProgress({
  toolName,
  toolArgs,
  startTime,
  isComplete = false,
}: StepProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every 100ms
  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, isComplete]);

  // Get stages for this tool
  const stages = useMemo(() => {
    return TOOL_STAGES[toolName] ?? DEFAULT_STAGES;
  }, [toolName]);

  // Calculate total estimated time
  const totalEstimated = useMemo(() => {
    return stages.reduce((sum, step) => sum + step.estimatedMs, 0);
  }, [stages]);

  // Determine current step based on elapsed time
  const { currentStepIndex, stepProgress } = useMemo(() => {
    if (isComplete) {
      return { currentStepIndex: stages.length, stepProgress: 100 };
    }

    let accumulated = 0;
    for (let i = 0; i < stages.length; i++) {
      const stepEnd = accumulated + stages[i].estimatedMs;
      if (elapsed < stepEnd) {
        const stepElapsed = elapsed - accumulated;
        const progress = Math.min(100, (stepElapsed / stages[i].estimatedMs) * 100);
        return { currentStepIndex: i, stepProgress: progress };
      }
      accumulated = stepEnd;
    }
    // If we've exceeded all estimates, stay on last step
    return { currentStepIndex: stages.length - 1, stepProgress: 100 };
  }, [elapsed, stages, isComplete]);

  // Calculate overall progress percentage
  const overallProgress = isComplete
    ? 100
    : Math.min(100, (elapsed / totalEstimated) * 100);

  return (
    <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
      {/* Tool header - monospace like Claude Code */}
      <div className="flex items-center justify-between">
        <code className="font-mono text-xs text-muted-foreground">
          {isComplete ? (
            <span className="text-success">
              <CheckCircle2 className="inline h-3 w-3 mr-1.5" />
              {toolName}({getDisplayArg(toolArgs)})
            </span>
          ) : (
            <>
              <Loader2 className="inline h-3 w-3 mr-1.5 animate-spin" />
              Running {toolName}({getDisplayArg(toolArgs)})
            </>
          )}
        </code>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatElapsed(isComplete ? elapsed : Date.now() - startTime)}
        </span>
      </div>

      {/* Segmented progress bar */}
      <div className="flex gap-1">
        {stages.map((step, idx) => {
          const isCurrentStep = idx === currentStepIndex;
          const isPastStep = idx < currentStepIndex || isComplete;
          const progress = isPastStep ? 100 : isCurrentStep ? stepProgress : 0;

          return (
            <div
              key={step.id}
              className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isPastStep
                    ? 'bg-success'
                    : isCurrentStep
                    ? 'bg-accent'
                    : 'bg-transparent'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="space-y-1">
        {stages.map((step, idx) => {
          const isCurrentStep = idx === currentStepIndex && !isComplete;
          const isPastStep = idx < currentStepIndex || isComplete;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-2 text-xs transition-colors duration-200',
                isPastStep
                  ? 'text-success'
                  : isCurrentStep
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {isPastStep ? (
                <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              ) : isCurrentStep ? (
                <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
              ) : (
                <div className="h-3 w-3 flex-shrink-0 rounded-full border border-current opacity-50" />
              )}
              <span className={cn(isCurrentStep && 'font-medium')}>{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isComplete ? 'bg-success' : 'bg-accent'
          )}
          style={{ width: `${overallProgress}%` }}
        />
      </div>
    </div>
  );
});
