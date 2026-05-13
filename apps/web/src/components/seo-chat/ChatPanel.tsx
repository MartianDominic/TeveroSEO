'use client';

/**
 * ChatPanel Component
 * Phase 98-04: Three-column v7 layout for SEO Chat
 * Phase 98-10: Claude Code patterns integration
 *
 * Implements the main chat interface with:
 * - Fluid main chat area with message list
 * - Right Rail (320-380px) for prospect context
 * - Virtualized message list for performance (100+ messages)
 * - Auto-scroll to new messages
 * - ChatInput at bottom with /commands
 * - EmptyState when no messages
 * - ToolExecutionLog for tool transparency
 * - Keyboard shortcuts
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSEOChat } from '@/hooks/useSEOChat';
import { useToolProgress } from '@/hooks/useToolProgress';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ChatErrorBoundary } from './ChatErrorBoundary';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { ProspectContext } from './ProspectContext';
import { EmptyState } from './EmptyState';
import { ToolExecutionLog } from './ToolExecutionLog';
import { StepProgress } from './StepProgress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseCommand } from '@/lib/seo-chat/commands';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatPanelProps {
  /** Session ID */
  sessionId: string;
  /** Workspace ID for tenant isolation */
  workspaceId: string;
  /** Optional prospect domain */
  prospectDomain?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Chat Panel - Three-column v7 layout with Claude Code patterns.
 *
 * Layout structure:
 * - Main content: Fluid width with messages + input
 * - Right Rail: Fixed 340px with prospect context
 *
 * Claude Code patterns:
 * - /commands for quick actions
 * - Tool execution transparency
 * - Keyboard shortcuts
 * - Empty state with command help
 */
export function ChatPanel({ sessionId, workspaceId, prospectDomain }: ChatPanelProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    context,
    analyzing,
    stop,
    reload,
  } = useSEOChat({
    sessionId,
    workspaceId,
    prospectDomain,
  });

  // Track tool execution progress for real-time UI feedback
  const toolProgress = useToolProgress(messages);

  // Track currently running tool for StepProgress
  const runningTool = useMemo(() => {
    return toolProgress.find((t) => t.state === 'pending' || t.state === 'streaming');
  }, [toolProgress]);

  // Track tool start time for progress display
  const toolStartTimeRef = useRef<number>(Date.now());
  useEffect(() => {
    if (runningTool) {
      toolStartTimeRef.current = Date.now();
    }
  }, [runningTool?.toolName]);

  // Refs for keyboard shortcuts
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<string>(input);
  inputRef.current = input;

  // Custom input setter for command insertion
  const setInput = useCallback((value: string) => {
    // Create a synthetic event to update input
    const syntheticEvent = {
      target: { value },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    handleInputChange(syntheticEvent);
  }, [handleInputChange]);

  // Handle form submit with command parsing
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = inputRef.current.trim();
    if (!trimmedInput) return;

    // Check for /commands
    const parsed = parseCommand(trimmedInput);
    if (parsed) {
      if (parsed.command.isLocal) {
        // Handle local commands
        if (parsed.command.name === 'clear') {
          // Clear would need to be wired to session reset
          // For now, just clear input
          setInput('');
        } else if (parsed.command.name === 'help') {
          // Help could show a modal or inline help
          // For now, just clear input (EmptyState shows commands)
          setInput('');
        }
        return;
      }
      // Transform command to natural language and submit
      if (parsed.text) {
        setInput(parsed.text);
        // Use setTimeout to allow state update before submit
        setTimeout(() => {
          const form = e.currentTarget;
          if (form) form.requestSubmit();
        }, 0);
        return;
      }
    }

    // Regular submit
    originalHandleSubmit(e);
  }, [originalHandleSubmit, setInput]);

  // Handle prompt selection from EmptyState
  const handleSelectPrompt = useCallback((text: string) => {
    setInput(text);
    // Focus the textarea
    textareaRef.current?.focus();
  }, [setInput]);

  // Handle retry for failed tools
  const handleRetry = useCallback((_toolName: string) => {
    // Reload the last message to retry
    reload();
  }, [reload]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    stop: isLoading ? stop : undefined,
    focusInput: () => textareaRef.current?.focus(),
    clear: () => {
      // Would need session reset API
    },
    startCommand: () => {
      setInput('/');
      textareaRef.current?.focus();
    },
  });

  // Virtualization for performance with 100+ messages
  const parentRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef(0);

  // Dynamic size estimation based on message content (PERF-M01)
  const estimateSize = useCallback((index: number) => {
    const message = messages[index];
    const baseHeight = 80;
    const toolHeight = message.toolInvocations?.length ? message.toolInvocations.length * 200 : 0;
    return baseHeight + toolHeight;
  }, [messages]);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5, // Render 5 extra items above/below viewport
  });

  // Memoized container style to avoid inline object recreation (PERF-M02)
  const containerStyle = useMemo(() => ({
    height: `${virtualizer.getTotalSize()}px`,
    width: '100%',
    position: 'relative' as const,
  }), [virtualizer.getTotalSize()]);

  // Auto-scroll to new messages with requestAnimationFrame (PERF-C01, PERF-M03)
  // Uses ref to track message count, removes virtualizer from deps
  useEffect(() => {
    if (messages.length > 0 && messages.length !== lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      // Use requestAnimationFrame to batch with render
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { behavior: 'smooth' });
      });
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show empty state when no messages
  const showEmptyState = messages.length === 0 && !isLoading;

  return (
    <div className="flex h-full">
      {/* Main chat area - fluid width */}
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1 p-4">
          <ChatErrorBoundary>
            {showEmptyState ? (
              <EmptyState onSelectPrompt={handleSelectPrompt} />
            ) : (
              <div
                ref={parentRef}
                className="max-w-3xl mx-auto h-full overflow-auto"
                role="log"
                aria-label="Chat messages"
                aria-live="polite"
              >
                <div style={containerStyle}>
                  {virtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                      key={messages[virtualRow.index].id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <div className="py-2">
                        <ChatMessage message={messages[virtualRow.index]} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tool execution progress during streaming */}
                {runningTool && (
                  <div className="mt-4 max-w-3xl mx-auto">
                    <StepProgress
                      toolName={runningTool.toolName}
                      toolArgs={runningTool.partialResult}
                      startTime={toolStartTimeRef.current}
                      isComplete={false}
                    />
                  </div>
                )}

                {/* Tool execution log */}
                {toolProgress.length > 0 && !runningTool && (
                  <div className="mt-4 max-w-3xl mx-auto">
                    <ToolExecutionLog toolProgress={toolProgress} />
                  </div>
                )}
              </div>
            )}
          </ChatErrorBoundary>
        </ScrollArea>

        <div className="border-t p-4">
          <ChatInput
            input={input}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            context={context}
            onStop={stop}
            setInput={setInput}
          />
        </div>
      </div>

      {/* Right Rail - 320-380px per v7 spec */}
      <div className="w-[340px] border-l bg-muted/30 flex-shrink-0">
        <ProspectContext
          context={context}
          analyzing={analyzing}
          toolProgress={toolProgress}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
