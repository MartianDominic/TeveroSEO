'use client';

/**
 * ChatErrorBoundary Component
 * Phase 98: Error boundary for chat UI resilience
 *
 * Catches rendering errors in chat components (especially tool results)
 * and displays a user-friendly fallback with retry option.
 */

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Optional error callback for logging/telemetry */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ChatErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Default Error State Component
// ---------------------------------------------------------------------------

interface ChatErrorStateProps {
  error: Error | null;
  onRetry: () => void;
}

function ChatErrorState({ error, onRetry }: ChatErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium mb-2">Something went wrong</h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-xs">
        {error?.message || 'An error occurred while rendering the chat. Please try again.'}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="gap-2"
        aria-label="Retry loading chat content"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Boundary Component
// ---------------------------------------------------------------------------

/**
 * Chat Error Boundary - Catches rendering errors in chat components.
 *
 * Usage:
 * ```tsx
 * <ChatErrorBoundary onError={(e) => logError(e)}>
 *   <ChatMessageList />
 * </ChatErrorBoundary>
 * ```
 *
 * This prevents the entire chat panel from crashing when tool result
 * rendering fails or message content causes rendering issues.
 */
export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  private contentRef = React.createRef<HTMLDivElement>();

  constructor(props: ChatErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChatErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Call optional error callback for logging/telemetry
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null }, () => {
      // Restore focus to content after error recovery for accessibility
      this.contentRef.current?.focus();
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default ChatErrorState
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <ChatErrorState error={this.state.error} onRetry={this.handleRetry} />;
    }

    return (
      <div ref={this.contentRef} tabIndex={-1}>
        {this.props.children}
      </div>
    );
  }
}
