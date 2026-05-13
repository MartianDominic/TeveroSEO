'use client';

/**
 * useToolProgress Hook
 * Phase 98-04: Extract tool execution progress from AI SDK messages
 *
 * Parses toolInvocations from assistant messages to provide:
 * - Tool execution state (pending, streaming, complete, error)
 * - Partial results during streaming
 * - Completed results
 */

import type { Message } from './useSEOChat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tool execution state.
 */
export type ToolState = 'pending' | 'streaming' | 'complete' | 'error';

/**
 * Tool progress entry.
 */
export interface ToolProgress {
  /** Tool name */
  toolName: string;
  /** Execution state */
  state: ToolState;
  /** Partial result during streaming */
  partialResult?: any;
  /** Final result when complete */
  result?: any;
  /** Error message if failed */
  error?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Extract tool progress from AI SDK messages.
 *
 * Looks at the last assistant message for toolInvocations and returns
 * an array of tool progress entries with their current state.
 *
 * @param messages - Chat messages from useChat
 * @returns Array of tool progress entries
 */
export function useToolProgress(messages: Message[]): ToolProgress[] {
  // Find last assistant message
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');

  if (!lastAssistant?.toolInvocations) {
    return [];
  }

  // Map tool invocations to progress entries
  return lastAssistant.toolInvocations.map((inv): ToolProgress => {
    // Determine state from invocation
    let state: ToolState = 'pending';
    let partialResult: any;
    let result: any;
    let error: string | undefined;

    if (inv.state === 'result') {
      state = 'complete';
      result = inv.result;
    } else if (inv.state === 'partial-call') {
      state = 'streaming';
      partialResult = inv.args;
    } else if (inv.state === 'call') {
      state = 'pending';
    }

    // Check for error in result
    if (result && typeof result === 'object' && 'error' in result) {
      state = 'error';
      error = result.error;
    }

    return {
      toolName: inv.toolName,
      state,
      partialResult,
      result,
      error,
    };
  });
}
