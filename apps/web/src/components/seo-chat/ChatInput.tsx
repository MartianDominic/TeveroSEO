'use client';

/**
 * ChatInput Component
 * Phase 98-04: Multi-modal chat input with context chips
 * Phase 98-10: Claude Code /command system integration
 *
 * Features:
 * - Textarea with auto-resize
 * - Cmd+Enter / Ctrl+Enter to submit
 * - Context chips showing session state
 * - /command autocomplete dropdown
 * - Escape to stop generation
 * - Stop button with Esc kbd hint
 */

import { memo, useCallback, useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionContext } from '@/lib/seo-chat/types';
import { filterCommands, isCommandInput, type Command } from '@/lib/seo-chat/commands';

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
  /** Stop generation handler */
  onStop?: () => void;
  /** Set input value directly (for command insertion) */
  setInput?: (value: string) => void;
}

// ---------------------------------------------------------------------------
// Command Autocomplete Item
// ---------------------------------------------------------------------------

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
}

function CommandItem({ command, isSelected, onClick }: CommandItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full px-3 py-2 text-left flex items-center gap-3 transition-colors',
        isSelected ? 'bg-muted' : 'hover:bg-muted/50'
      )}
    >
      <code className="text-sm font-mono text-accent">/{command.name}</code>
      <span className="text-sm text-muted-foreground">{command.description}</span>
      {command.aliases.length > 0 && (
        <span className="text-xs text-muted-foreground/60 ml-auto">
          {command.aliases.map((a) => `/${a}`).join(', ')}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Chat Input - Multi-modal input with /commands.
 *
 * Keyboard shortcuts:
 * - Cmd+Enter (Mac) / Ctrl+Enter (Windows): Submit
 * - Shift+Enter: New line
 * - Escape: Stop generation / Close command dropdown
 * - Arrow Up/Down: Navigate command suggestions
 * - Tab/Enter: Select command
 *
 * Context chips show:
 * - Prospect domain
 * - Business niche
 * - Keywords analyzed count
 *
 * Command autocomplete:
 * - Shows when input starts with /
 * - Filters as user types
 * - Keyboard navigable
 */
export const ChatInput = memo(function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  context,
  onStop,
  setInput,
}: ChatInputProps) {
  const [showCommands, setShowCommands] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Detect platform for keyboard shortcut hints.
   */
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  const modifierKey = isMac ? '⌘' : 'Ctrl';
  const submitHintId = 'chat-input-hint';

  /**
   * Update command suggestions when input changes.
   */
  useEffect(() => {
    if (isCommandInput(input)) {
      const filtered = filterCommands(input);
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [input]);

  /**
   * Select a command from the dropdown.
   */
  const selectCommand = useCallback(
    (cmd: Command) => {
      if (setInput) {
        // Insert command with trailing space if it takes args
        const hasArgs = cmd.usage.includes('<');
        setInput(`/${cmd.name}${hasArgs ? ' ' : ''}`);
      }
      setShowCommands(false);
      textareaRef.current?.focus();
    },
    [setInput]
  );

  /**
   * Handle keyboard events.
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape: stop generation or close dropdown
      if (e.key === 'Escape') {
        if (showCommands) {
          e.preventDefault();
          setShowCommands(false);
        } else if (isLoading && onStop) {
          e.preventDefault();
          onStop();
        }
        return;
      }

      // Command dropdown navigation
      if (showCommands && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          selectCommand(filteredCommands[selectedIndex]);
          return;
        }
      }

      // Cmd+Enter or Ctrl+Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = e.currentTarget.form;
        if (form) form.requestSubmit();
      }
    },
    [showCommands, filteredCommands, selectedIndex, selectCommand, isLoading, onStop]
  );

  /**
   * Global escape key handler for stopping generation.
   */
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading && onStop) {
        e.preventDefault();
        onStop();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isLoading, onStop]);

  return (
    <form onSubmit={onSubmit} className="space-y-2" role="form" aria-label="Chat message input">
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

      <div className="relative">
        {/* Command autocomplete dropdown */}
        {showCommands && filteredCommands.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 w-full mb-2 bg-background border rounded-lg shadow-lg overflow-hidden z-50"
            role="listbox"
            aria-label="Available commands"
          >
            {filteredCommands.map((cmd, idx) => (
              <CommandItem
                key={cmd.name}
                command={cmd}
                isSelected={idx === selectedIndex}
                onClick={() => selectCommand(cmd)}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about SEO analysis or type / for commands..."
            className="min-h-[60px] resize-none font-mono"
            disabled={isLoading}
            aria-label="Chat message"
            aria-describedby={submitHintId}
            aria-busy={isLoading}
            aria-expanded={showCommands}
            aria-controls={showCommands ? 'command-dropdown' : undefined}
          />

          {/* Stop button during loading, Send button otherwise */}
          {isLoading ? (
            <Button
              type="button"
              onClick={onStop}
              variant="ghost"
              className="gap-2 min-w-[80px]"
              aria-label="Stop generation"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Stop</span>
              <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-muted rounded">Esc</kbd>
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <p id={submitHintId} className="text-xs text-muted-foreground">
        Press{' '}
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">{modifierKey}</kbd>
        +
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>{' '}
        to send, or type <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">/</kbd> for commands
      </p>
    </form>
  );
});
