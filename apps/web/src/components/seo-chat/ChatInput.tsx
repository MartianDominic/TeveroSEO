'use client';

/**
 * ChatInput Component
 * Phase 98-04: Multi-modal chat input with context chips
 *
 * Features:
 * - Textarea with auto-resize
 * - Cmd+Enter / Ctrl+Enter to submit
 * - Context chips showing session state
 * - Send button with loading state
 */

import { FormEvent, KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2 } from 'lucide-react';
import type { SessionContext } from '@/lib/seo-chat/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatInputProps {
  /** Current input value */
  input: string;
  /** Input change handler */
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Form submit handler */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Loading state */
  isLoading: boolean;
  /** Session context for chips */
  context: SessionContext | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Chat Input - Multi-modal input with context chips.
 *
 * Keyboard shortcuts:
 * - Cmd+Enter (Mac) / Ctrl+Enter (Windows): Submit
 * - Shift+Enter: New line
 *
 * Context chips show:
 * - Prospect domain
 * - Business niche
 * - Keywords analyzed count
 */
export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  context,
}: ChatInputProps) {
  /**
   * Handle keyboard shortcuts.
   * Cmd+Enter or Ctrl+Enter to submit.
   */
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd+Enter or Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      {/* Context chips showing current session state */}
      {context && (
        <div className="flex flex-wrap gap-1.5">
          {context.prospectDomain && (
            <Badge variant="secondary" className="text-xs">
              {context.prospectDomain}
            </Badge>
          )}
          {context.niche && (
            <Badge variant="outline" className="text-xs">
              {context.niche}
            </Badge>
          )}
          {context.keywordsAnalyzed > 0 && (
            <Badge variant="outline" className="text-xs">
              {context.keywordsAnalyzed} keywords
            </Badge>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask about SEO analysis, keywords, or generate a proposal..."
          className="min-h-[60px] resize-none"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Press{' '}
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">⌘</kbd>
        +
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>{' '}
        to send
      </p>
    </form>
  );
}
