'use client';

/**
 * ChatMessage Component
 * Phase 98-04: Message rendering with tool result cards
 *
 * Renders:
 * - User/assistant message bubbles with role-based styling
 * - Avatar icons (User/Bot)
 * - Tool result cards embedded in assistant messages
 * - Safe text rendering (whitespace-pre-wrap, no innerHTML)
 */

import type { Message } from '@/hooks/useSEOChat';
import type { ToolProgress } from '@/hooks/useToolProgress';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessageProps {
  /** Message to render */
  message: Message;
  /** Tool progress for rendering tool result cards */
  toolProgress: ToolProgress[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Chat Message - Renders user and assistant messages.
 *
 * Design:
 * - User messages: Right-aligned, primary background
 * - Assistant messages: Left-aligned, muted background
 * - Tool invocations: Rendered as inline cards (stub for now)
 * - Text content: whitespace-pre-wrap for safe rendering (no innerHTML)
 *
 * Security: Per T-98-04, NEVER use innerHTML with LLM-generated content.
 * Use whitespace-pre-wrap to preserve formatting safely.
 */
export function ChatMessage({ message, toolProgress }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 space-y-2', isUser && 'text-right')}>
        {/* Text content - use whitespace-pre-wrap for safe rendering */}
        {message.content && (
          <div
            className={cn(
              'inline-block px-4 py-2 rounded-2xl max-w-[85%]',
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}
          >
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          </div>
        )}

        {/* Tool results - render cards for completed tools */}
        {isAssistant && message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="space-y-2">
            {message.toolInvocations.map((invocation, idx) => (
              <div
                key={`${invocation.toolName}-${idx}`}
                className="inline-block px-3 py-2 bg-accent/50 rounded-lg text-xs"
              >
                <p className="font-medium">{invocation.toolName}</p>
                <p className="text-muted-foreground">
                  {invocation.state === 'result'
                    ? '✓ Complete'
                    : invocation.state === 'partial-call'
                    ? '⋯ Streaming'
                    : '⏳ Pending'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
