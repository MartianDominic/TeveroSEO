'use client';

/**
 * useSEOChat Hook
 * Phase 98-04: Wrapper around Vercel AI SDK useChat with session context
 *
 * Integrates Vercel AI SDK streaming with:
 * - Session context management via seoChatSessionStore
 * - Proposal draft updates via seoChatDraftStore
 * - Tool progress tracking
 * - Auto-extraction of domain/keywords from tool results
 *
 * NOTE: AI SDK 6.0.180 doesn't export useChat from 'ai/react'.
 * This is a stub implementation providing the interface.
 * Real streaming integration will be added in future plans.
 */

import { useSeoChatSessionStore } from '@/stores/seoChatSessionStore';
import { useSeoChatDraftStore } from '@/stores/seoChatDraftStore';
import { useCallback, useEffect, useState } from 'react';
import type { DomainHealthResult, KeywordAnalysisResult, FeasibilityResult, SessionContext } from '@/lib/seo-chat/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: Array<{
    toolName: string;
    state: 'call' | 'partial-call' | 'result';
    args?: any;
    result?: any;
  }>;
}

export interface UseSEOChatOptions {
  /** Session ID */
  sessionId: string;
  /** Workspace ID for tenant isolation */
  workspaceId: string;
  /** Optional prospect domain to initialize */
  prospectDomain?: string;
}

export interface UseSEOChatReturn {
  /** Messages from useChat */
  messages: Message[];
  /** Input value */
  input: string;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Handle form submit */
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Is streaming */
  isLoading: boolean;
  /** Error state */
  error: Error | undefined;
  /** Session context */
  context: SessionContext | null;
  /** Currently analyzing tool */
  analyzing: string | null;
  /** Reload conversation */
  reload: () => void;
  /** Stop streaming */
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * SEO Chat hook integrating Vercel AI SDK with session/draft stores.
 *
 * Handles:
 * - Streaming chat messages via useChat
 * - Session context initialization
 * - Tool result extraction and store updates
 * - Error handling
 *
 * @param options - Hook configuration
 * @returns Chat state and controls
 */
export function useSEOChat(options: UseSEOChatOptions): UseSEOChatReturn {
  const { sessionId, workspaceId, prospectDomain } = options;

  // Store access
  const { setCurrentSession, updateContext, setAnalyzing, context } = useSeoChatSessionStore();
  const { addKeywords, setAnalysisResult } = useSeoChatDraftStore();

  // Local state (stub implementation)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  // Initialize session on mount
  useEffect(() => {
    setCurrentSession(sessionId);

    // Initialize context if not exists
    if (!context) {
      updateContext({
        sessionId,
        workspaceId,
        prospectDomain: prospectDomain ?? null,
      });
    }
  }, [sessionId, workspaceId, prospectDomain, setCurrentSession, updateContext, context]);

  // Tool result handler
  const handleToolResult = useCallback((toolName: string, result: any) => {
    switch (toolName) {
      case 'domain_health': {
        const healthResult = result as DomainHealthResult;
        setAnalysisResult('domainHealth', healthResult);
        updateContext({ prospectDomain: healthResult.domain });
        break;
      }

      case 'keyword_analysis': {
        const keywordResult = result as KeywordAnalysisResult;
        setAnalysisResult('keywordAnalysis', keywordResult);
        addKeywords(keywordResult.keywords);
        updateContext({ keywordsAnalyzed: keywordResult.keywords.length });
        break;
      }

      case 'feasibility_check': {
        const feasibilityResult = result as FeasibilityResult;
        setAnalysisResult('feasibility', feasibilityResult);
        break;
      }

      case 'add_to_proposal': {
        // Keywords already handled by keyword_analysis
        break;
      }

      case 'generate_proposal': {
        const proposalResult = result as { proposalId: string; magicLink: string };
        updateContext({
          proposalId: proposalResult.proposalId,
          proposalStatus: 'generated'
        });
        break;
      }
    }
  }, [setAnalysisResult, updateContext, addKeywords]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  // Handle form submit (stub)
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: Implement actual API call to /api/seo-chat
    console.log('Submit chat message:', input);
    setInput('');
  }, [input]);

  // Reload (stub)
  const reload = useCallback(() => {
    // TODO: Implement reload
    console.log('Reload conversation');
  }, []);

  // Stop (stub)
  const stop = useCallback(() => {
    // TODO: Implement stop
    console.log('Stop streaming');
  }, []);

  // Extract analyzing state from messages
  const lastMessage = messages[messages.length - 1];
  const toolInProgress = lastMessage?.role === 'assistant' && lastMessage.toolInvocations
    ? lastMessage.toolInvocations.find((inv) => inv.state !== 'result')
    : null;

  useEffect(() => {
    if (toolInProgress) {
      setAnalyzing(toolInProgress.toolName);
    } else if (!isLoading) {
      setAnalyzing(null);
    }
  }, [toolInProgress, isLoading, setAnalyzing]);

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    context,
    analyzing: useSeoChatSessionStore(s => s.analyzing),
    reload,
    stop,
  };
}
