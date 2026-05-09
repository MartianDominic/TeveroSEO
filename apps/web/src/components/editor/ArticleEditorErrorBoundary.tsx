'use client';

import { Component, ReactNode } from 'react';

import * as Sentry from '@sentry/nextjs';
import { AlertTriangle, RefreshCw, Save, FileText } from 'lucide-react';

import { logError } from '@/lib/errors';
import { logger } from '@/lib/logger';

import { Button } from '@tevero/ui';
interface ArticleRecoveryData {
  title: string;
  keyword: string;
  htmlContent: string | null;
  customInstructions: string;
  quickNotes: string;
  timestamp: number;
}

interface Props {
  children: ReactNode;
  articleId?: string | null;
  clientId?: string | null;
  onRecover?: (data: ArticleRecoveryData) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  recoveryData: ArticleRecoveryData | null;
}

const STORAGE_KEY_PREFIX = 'article_recovery_';

/**
 * Specialized error boundary for the article editor with auto-save recovery.
 *
 * Features:
 * - Catches JavaScript errors in the editor component tree
 * - Attempts to recover unsaved work from localStorage
 * - Provides user-friendly error messages
 * - Allows retry or recovery of saved content
 *
 * Usage:
 * ```tsx
 * <ArticleEditorErrorBoundary
 *   articleId={articleId}
 *   clientId={clientId}
 *   onRecover={(data) => restoreArticle(data)}
 * >
 *   <ArticleEditorPage />
 * </ArticleEditorErrorBoundary>
 * ```
 */
export class ArticleEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      recoveryData: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Capture error in Sentry with article context
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        articleId: this.props.articleId || 'new',
        clientId: this.props.clientId || 'unknown',
      },
      tags: {
        errorBoundary: 'ArticleEditor',
        articleId: this.props.articleId || 'new',
      },
    });

    // Also log locally for debugging
    logError('ArticleEditorErrorBoundary', error, {
      componentStack: errorInfo.componentStack || 'unknown',
      articleId: this.props.articleId || 'new',
      clientId: this.props.clientId || 'unknown',
    });

    // Attempt to recover saved data from localStorage
    this.attemptRecovery();
  }

  private getStorageKey(): string {
    const id = this.props.articleId || 'new';
    const client = this.props.clientId || 'unknown';
    return `${STORAGE_KEY_PREFIX}${client}_${id}`;
  }

  private attemptRecovery() {
    if (typeof window === 'undefined') return;

    try {
      const key = this.getStorageKey();
      const stored = localStorage.getItem(key);

      if (stored) {
        const data = JSON.parse(stored) as ArticleRecoveryData;
        // Only recover if data is less than 24 hours old
        const hoursSinceLastSave = (Date.now() - data.timestamp) / (1000 * 60 * 60);
        if (hoursSinceLastSave < 24) {
          this.setState({ recoveryData: data });
        }
      }
    } catch (e) {
      // Recovery failed silently - localStorage might be corrupted or unavailable
      logger.warn('Failed to recover article data:', { detail: e });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, recoveryData: null });
  };

  handleRecover = () => {
    const { recoveryData } = this.state;
    const { onRecover } = this.props;

    if (recoveryData && onRecover) {
      onRecover(recoveryData);
      // Clear the error state after recovery
      this.setState({ hasError: false, error: undefined, recoveryData: null });
    } else {
      // If no recovery callback, just reset
      this.handleReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const { recoveryData, error } = this.state;
      const hasRecoverableContent = recoveryData && (
        recoveryData.htmlContent ||
        recoveryData.title ||
        recoveryData.quickNotes
      );

      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] p-8 bg-card rounded-lg border border-border">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            Editor Error
          </h2>

          <p className="text-muted-foreground mb-6 text-center max-w-md">
            {error?.message || 'The article editor encountered an unexpected error.'}
          </p>

          {hasRecoverableContent && (
            <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-md bg-green-500/10 border border-green-500/20">
              <Save className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">
                We found auto-saved content from{' '}
                {new Date(recoveryData.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>

            {hasRecoverableContent && this.props.onRecover && (
              <Button onClick={this.handleRecover}>
                <FileText className="h-4 w-4 mr-2" />
                Recover Content
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-6 text-center max-w-sm">
            If this error persists, please try refreshing the page or contact support.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Auto-save article data to localStorage for crash recovery.
 * Call this periodically or on content changes.
 */
export function saveArticleRecoveryData(
  clientId: string | null,
  articleId: string | null,
  data: Omit<ArticleRecoveryData, 'timestamp'>
): void {
  if (typeof window === 'undefined') return;

  try {
    const id = articleId || 'new';
    const client = clientId || 'unknown';
    const key = `${STORAGE_KEY_PREFIX}${client}_${id}`;

    const recoveryData: ArticleRecoveryData = {
      ...data,
      timestamp: Date.now(),
    };

    localStorage.setItem(key, JSON.stringify(recoveryData));
  } catch (e) {
    // Silently fail - localStorage might be full or unavailable
    logger.warn('Failed to save article recovery data:', { detail: e });
  }
}

/**
 * Clear recovery data after successful save.
 */
export function clearArticleRecoveryData(
  clientId: string | null,
  articleId: string | null
): void {
  if (typeof window === 'undefined') return;

  try {
    const id = articleId || 'new';
    const client = clientId || 'unknown';
    const key = `${STORAGE_KEY_PREFIX}${client}_${id}`;
    localStorage.removeItem(key);
  } catch (e) {
    // Silently fail
  }
}
