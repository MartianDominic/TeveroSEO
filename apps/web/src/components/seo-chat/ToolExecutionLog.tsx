'use client';

/**
 * ToolExecutionLog Component
 * Phase 98-10: Claude Code-style tool execution log
 *
 * Shows a log of all tool executions with:
 * - Tool name and arguments
 * - Execution state (pending, streaming, complete, error)
 * - Status icons
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import type { ToolProgress } from '@/hooks/useToolProgress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolExecutionLogProps {
  /** Array of tool progress entries */
  toolProgress: ToolProgress[];
}

// ---------------------------------------------------------------------------
// Helper: Get Display Arg
// ---------------------------------------------------------------------------

function getDisplayArg(toolName: string, partialResult?: Record<string, unknown>): string | null {
  if (!partialResult) return null;

  switch (toolName) {
    case 'domain_health':
    case 'keyword_analysis':
      return typeof partialResult.domain === 'string' ? partialResult.domain : null;
    case 'feasibility_check':
      return typeof partialResult.keyword === 'string' ? `"${partialResult.keyword}"` : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Status Icon Component
// ---------------------------------------------------------------------------

interface StatusIconProps {
  state: ToolProgress['state'];
}

function StatusIcon({ state }: StatusIconProps) {
  switch (state) {
    case 'complete':
      return <CheckCircle2 className="h-3 w-3 text-success" />;
    case 'error':
      return <XCircle className="h-3 w-3 text-error" />;
    case 'streaming':
      return <Loader2 className="h-3 w-3 animate-spin text-accent" />;
    case 'pending':
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Tool Execution Log - Shows all tool executions like Claude Code.
 *
 * Displays a compact log of:
 * - Tool name
 * - Key argument (domain, keyword)
 * - Status indicator
 */
export const ToolExecutionLog = memo(function ToolExecutionLog({
  toolProgress,
}: ToolExecutionLogProps) {
  if (toolProgress.length === 0) return null;

  return (
    <div className="border-t pt-2 mt-2">
      <p className="text-xs text-muted-foreground font-mono mb-2">Tool executions:</p>
      <div className="space-y-1">
        {toolProgress.map((tool, i) => {
          const displayArg = getDisplayArg(tool.toolName, tool.partialResult);

          return (
            <div
              key={`${tool.toolName}-${i}`}
              className={cn(
                'flex items-center gap-2 text-xs font-mono py-0.5',
                tool.state === 'complete' && 'text-muted-foreground',
                tool.state === 'error' && 'text-error'
              )}
            >
              <StatusIcon state={tool.state} />
              <span>{tool.toolName}</span>
              {displayArg && (
                <span className="text-foreground">({displayArg})</span>
              )}
              <span className="ml-auto">
                {tool.state === 'complete' && (
                  <span className="text-success">done</span>
                )}
                {tool.state === 'error' && (
                  <span className="text-error">failed</span>
                )}
                {tool.state === 'streaming' && (
                  <span className="text-accent">running...</span>
                )}
                {tool.state === 'pending' && (
                  <span className="text-muted-foreground">pending</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
