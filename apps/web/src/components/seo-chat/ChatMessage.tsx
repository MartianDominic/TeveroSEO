'use client';

/**
 * ChatMessage Component
 * Phase 98-04: Message rendering with tool result cards
 * Phase 98-10: Hover-to-reveal actions (v6 calm at rest pattern)
 *
 * Renders:
 * - User/assistant message bubbles with role-based styling
 * - Avatar icons (User/Bot)
 * - Tool result cards embedded in assistant messages
 * - Safe text rendering (whitespace-pre-wrap, no innerHTML)
 * - Hover-to-reveal Copy/Share actions
 *
 * Performance:
 * - Wrapped in React.memo with custom comparison
 * - Only re-renders when message content/state changes
 */

import { memo, useCallback, useState } from 'react';
import type { Message } from '@/hooks/useSEOChat';
import { cn } from '@/lib/utils';
import { User, Bot, Copy, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessageProps {
  /** Message to render */
  message: Message;
}

// ---------------------------------------------------------------------------
// Action Button Component
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

function ActionButton({ icon: Icon, label, onClick, isActive }: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={onClick}
      aria-label={label}
    >
      <Icon className={cn('h-3.5 w-3.5', isActive && 'text-success')} />
    </Button>
  );
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
 * - Actions: Hidden until hover (v6 calm at rest pattern)
 *
 * Security: Per T-98-04, NEVER use innerHTML with LLM-generated content.
 * Use whitespace-pre-wrap to preserve formatting safely.
 *
 * Performance: Memoized with custom comparison to prevent re-renders
 * on every keystroke in the input field.
 */
export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const roleLabel = isUser ? 'Your message' : 'Assistant message';

  const [copied, setCopied] = useState(false);

  /**
   * Copy message content to clipboard.
   */
  const handleCopy = useCallback(async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail - clipboard may not be available
    }
  }, [message.content]);

  /**
   * Share message (uses Web Share API if available).
   */
  const handleShare = useCallback(async () => {
    if (!message.content) return;
    if (navigator.share) {
      try {
        await navigator.share({
          text: message.content,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback to copy
      handleCopy();
    }
  }, [message.content, handleCopy]);

  return (
    <article
      className={cn('group relative flex gap-3', isUser && 'flex-row-reverse')}
      aria-label={roleLabel}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 space-y-2', isUser && 'text-right')}>
        {/* Text content - use whitespace-pre-wrap for safe rendering */}
        {message.content && (
          <div className="relative inline-block max-w-[85%]">
            {/* Hover-to-reveal action bar */}
            <div
              className={cn(
                'absolute -top-8 flex items-center gap-1 p-1 rounded-lg bg-background shadow-sm border',
                'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                isUser ? 'left-0' : 'right-0'
              )}
            >
              <ActionButton
                icon={copied ? Check : Copy}
                label="Copy message"
                onClick={handleCopy}
                isActive={copied}
              />
              <ActionButton
                icon={Share2}
                label="Share message"
                onClick={handleShare}
              />
            </div>

            <div
              className={cn(
                'px-4 py-2 rounded-2xl',
                isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            </div>
          </div>
        )}

        {/* Tool results - render cards for completed tools */}
        {isAssistant && message.toolInvocations && message.toolInvocations.length > 0 && (
          <div className="space-y-2" aria-label="Tool results">
            {message.toolInvocations.map((invocation, idx) => (
              <div
                key={`${invocation.toolName}-${idx}`}
                className="inline-block px-3 py-2 bg-accent/50 rounded-lg text-xs"
                role="status"
                aria-label={`Tool ${invocation.toolName}: ${
                  invocation.state === 'result'
                    ? 'Complete'
                    : invocation.state === 'partial-call'
                    ? 'Streaming'
                    : 'Pending'
                }`}
              >
                <p className="font-medium font-mono">{invocation.toolName}</p>
                <p className="text-muted-foreground" aria-hidden="true">
                  {invocation.state === 'result'
                    ? 'Complete'
                    : invocation.state === 'partial-call'
                    ? 'Streaming...'
                    : 'Pending'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}, (prev, next) => {
  // Custom comparison: only re-render when message content actually changes
  // Fast path: different message ID means different message
  if (prev.message.id !== next.message.id) return false;

  // Content change check
  if (prev.message.content !== next.message.content) return false;

  // Tool invocations shallow compare (avoids expensive JSON.stringify)
  const prevTools = prev.message.toolInvocations;
  const nextTools = next.message.toolInvocations;

  // Both undefined/null
  if (!prevTools && !nextTools) return true;

  // One undefined, other not
  if (!prevTools || !nextTools) return false;

  // Different length
  if (prevTools.length !== nextTools.length) return false;

  // Shallow compare by toolCallId and state (not full result)
  return prevTools.every(
    (tool, i) =>
      tool.toolCallId === nextTools[i].toolCallId && tool.state === nextTools[i].state
  );
});
