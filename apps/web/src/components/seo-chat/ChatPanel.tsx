'use client';

/**
 * ChatPanel Component
 * Phase 98-04: Three-column v7 layout for SEO Chat
 *
 * Implements the main chat interface with:
 * - Fluid main chat area with message list
 * - Right Rail (320-380px) for prospect context
 * - ScrollArea for message overflow
 * - ChatInput at bottom
 */

import { useSEOChat } from '@/hooks/useSEOChat';
import { useToolProgress } from '@/hooks/useToolProgress';
import { ChatInput } from './ChatInput';
import { ChatMessage } from './ChatMessage';
import { ProspectContext } from './ProspectContext';
import { ScrollArea } from '@/components/ui/scroll-area';

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
 * Chat Panel - Three-column v7 layout.
 *
 * Layout structure:
 * - Main content: Fluid width with messages + input
 * - Right Rail: Fixed 340px with prospect context
 *
 * Per v7 design architecture, this replaces the standard Right Rail
 * with SEO Chat-specific prospect context panel.
 */
export function ChatPanel({ sessionId, workspaceId, prospectDomain }: ChatPanelProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    context,
    analyzing,
  } = useSEOChat({
    sessionId,
    workspaceId,
    prospectDomain,
  });

  const toolProgress = useToolProgress(messages);

  return (
    <div className="flex h-full">
      {/* Main chat area - fluid width */}
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                toolProgress={toolProgress}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <ChatInput
            input={input}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            context={context}
          />
        </div>
      </div>

      {/* Right Rail - 320-380px per v7 spec */}
      <div className="w-[340px] border-l bg-muted/30 flex-shrink-0">
        <ProspectContext
          context={context}
          analyzing={analyzing}
          toolProgress={toolProgress}
        />
      </div>
    </div>
  );
}
