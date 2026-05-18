/**
 * SafeComponents - Error boundary wrapped document builder components
 * Phase 102 Audit Fix: Add error boundaries to prevent crashes
 *
 * These wrapper components catch render errors in document builder components
 * and display recovery UI instead of crashing the entire application.
 */
"use client";

import { type FC, type ComponentProps } from "react";

import { ErrorBoundary, InlineErrorBoundary } from "@/components/ui/error-boundary";

import { BlockEditor } from "./BlockEditor";
import { DocumentCanvas } from "./DocumentCanvas";
import { PersuasionBlock, type PersuasionBlockProps } from "./PersuasionBlock";
import { VariantTabs } from "./VariantTabs";

/**
 * Error logging function for document builder errors.
 */
function logDocumentBuilderError(
  componentName: string,
  error: Error,
  errorInfo: { componentStack?: string | null }
): void {
  console.error(`[DocumentBuilder:${componentName}] Component error:`, {
    error: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
  });

  // TODO: Send to error tracking service (e.g., Sentry)
  // if (typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     extra: { componentName, componentStack: errorInfo.componentStack },
  //     tags: { feature: 'document-builder' },
  //   });
  // }
}

/**
 * SafeDocumentCanvas - DocumentCanvas wrapped with error boundary.
 *
 * Catches errors during canvas rendering (drag-drop, block list operations)
 * and displays a recovery UI instead of crashing.
 */
export const SafeDocumentCanvas: FC<ComponentProps<typeof DocumentCanvas>> = (props) => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) =>
        logDocumentBuilderError("DocumentCanvas", error, errorInfo)
      }
      title="Canvas Error"
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="flex flex-col items-center justify-center p-8 min-h-[400px] bg-surface rounded-lg border border-hairline">
          <div className="text-center space-y-4 max-w-md">
            <div className="p-3 mx-auto w-fit rounded-full bg-error/10">
              <svg
                className="h-6 w-6 text-error"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-text-1">
              Unable to load document canvas
            </h3>
            <p className="text-sm text-text-3">
              {error.message || "An error occurred while rendering the canvas."}
            </p>
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    >
      <DocumentCanvas {...props} />
    </ErrorBoundary>
  );
};

SafeDocumentCanvas.displayName = "SafeDocumentCanvas";

/**
 * SafeBlockEditor - BlockEditor wrapped with error boundary.
 *
 * Catches errors during TipTap editor operations (content parsing, AI generation)
 * and displays an inline recovery UI.
 */
export const SafeBlockEditor: FC<ComponentProps<typeof BlockEditor>> = (props) => {
  return (
    <InlineErrorBoundary
      onError={(error, errorInfo) =>
        logDocumentBuilderError("BlockEditor", error, errorInfo)
      }
      fallback={
        <div className="flex items-center gap-2 p-3 rounded-lg bg-error/10 text-error text-sm border border-error/20">
          <svg
            className="h-4 w-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Editor failed to load. Please refresh the page.</span>
        </div>
      }
    >
      <BlockEditor {...props} />
    </InlineErrorBoundary>
  );
};

SafeBlockEditor.displayName = "SafeBlockEditor";

/**
 * SafeVariantTabs - VariantTabs wrapped with error boundary.
 *
 * Catches errors during variant tab rendering (statistics calculation, UI rendering)
 * and displays a minimal fallback.
 */
export const SafeVariantTabs: FC<ComponentProps<typeof VariantTabs>> = (props) => {
  return (
    <InlineErrorBoundary
      onError={(error, errorInfo) =>
        logDocumentBuilderError("VariantTabs", error, errorInfo)
      }
      fallback={
        <div className="flex items-center gap-2 px-4 py-2 border-t border-hairline bg-surface text-text-3 text-xs">
          <span>Unable to display variants</span>
        </div>
      }
    >
      <VariantTabs {...props} />
    </InlineErrorBoundary>
  );
};

SafeVariantTabs.displayName = "SafeVariantTabs";

/**
 * SafePersuasionBlock - PersuasionBlock wrapped with inline error boundary.
 *
 * Catches errors during individual block rendering and displays a fallback
 * UI for that block only, preventing a single block crash from taking down
 * the entire DocumentCanvas.
 *
 * @see H-ERR-01 in 102-20-AGENT-BULLETPROOF-AUDIT.md
 */
export const SafePersuasionBlock: FC<PersuasionBlockProps> = (props) => {
  return (
    <InlineErrorBoundary
      onError={(error, errorInfo) =>
        logDocumentBuilderError(`PersuasionBlock:${props.block.id}`, error, errorInfo)
      }
      fallback={
        <div
          className="flex flex-col items-center justify-center p-4 rounded-lg bg-error/5 border border-error/20 min-h-[100px]"
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-error text-sm mb-2">
            <svg
              className="h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Block failed to render</span>
          </div>
          <p className="text-xs text-text-3 text-center">
            This block ({props.block.type}) encountered an error. Other blocks are unaffected.
          </p>
        </div>
      }
    >
      <PersuasionBlock {...props} />
    </InlineErrorBoundary>
  );
};

SafePersuasionBlock.displayName = "SafePersuasionBlock";
