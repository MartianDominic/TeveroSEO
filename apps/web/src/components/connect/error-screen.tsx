"use client";

/**
 * ErrorScreen Component
 * Phase 66-06: Verification UI
 *
 * Error states with helpful troubleshooting and recovery options.
 * Copy follows DESIGN.md Section 9 - never blames the user.
 *
 * Error types:
 * - timeout: Installation not detected after polling
 * - domain_mismatch: Pixel found on different domain
 * - technical: Server/API error
 */

import {
  AlertCircle,
  RefreshCw,
  Send,
  MessageCircle,
  Plus,
  XCircle,
} from "lucide-react";
import { Button, Card, CardContent } from "@tevero/ui";

// ============================================================================
// Types
// ============================================================================

export type ErrorType = "timeout" | "domain_mismatch" | "technical";

export interface ErrorScreenProps {
  /** Type of error to display */
  errorType: ErrorType;
  /** Site URL for context */
  siteUrl?: string;
  /** Detected domain (for domain_mismatch) */
  detectedDomain?: string;
  /** Expected domain (for domain_mismatch) */
  expectedDomain?: string;
  /** Called when user clicks retry */
  onRetry: () => void;
  /** Called when user wants to send to developer */
  onSendToDeveloper: () => void;
  /** Called when user needs help */
  onNeedHelp: () => void;
  /** Called when user wants to add detected domain as new site */
  onAddDifferentSite?: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Error icon with appropriate styling.
 */
function ErrorIcon({ type }: { type: ErrorType }) {
  const iconClass = "h-8 w-8";

  switch (type) {
    case "timeout":
      return (
        <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertCircle className={`${iconClass} text-amber-600 dark:text-amber-400`} />
        </div>
      );
    case "domain_mismatch":
      return (
        <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <AlertCircle className={`${iconClass} text-blue-600 dark:text-blue-400`} />
        </div>
      );
    case "technical":
      return (
        <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <XCircle className={`${iconClass} text-red-600 dark:text-red-400`} />
        </div>
      );
  }
}

/**
 * Troubleshooting checklist for timeout errors.
 */
function TroubleshootingChecklist() {
  const items = [
    "The code is in the <head> section of your site",
    "You saved the changes to your theme/template",
    "You've refreshed your website after saving",
    "Your browser cache is cleared",
  ];

  return (
    <Card className="mt-4 bg-muted/50">
      <CardContent className="pt-4">
        <p className="text-sm font-medium text-foreground mb-3">
          Quick checklist:
        </p>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="flex-shrink-0 h-5 w-5 rounded border border-muted-foreground/30 flex items-center justify-center text-xs">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Domain comparison display for mismatch errors.
 */
function DomainComparison({
  detected,
  expected,
}: {
  detected: string;
  expected: string;
}) {
  return (
    <Card className="mt-4 bg-muted/50">
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Detected on:</p>
            <p className="font-mono text-foreground">{detected}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Expected:</p>
            <p className="font-mono text-foreground">{expected}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ErrorScreen({
  errorType,
  detectedDomain,
  expectedDomain,
  onRetry,
  onSendToDeveloper,
  onNeedHelp,
  onAddDifferentSite,
}: ErrorScreenProps) {
  // Content based on error type
  const content = getErrorContent(errorType);

  return (
    <div className="max-w-md mx-auto text-center py-8 px-4">
      {/* Icon */}
      <div className="flex items-center justify-center mb-6">
        <ErrorIcon type={errorType} />
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        {content.heading}
      </h2>

      {/* Subtext */}
      <p className="text-muted-foreground">{content.subtext}</p>

      {/* Type-specific content */}
      {errorType === "timeout" && <TroubleshootingChecklist />}

      {errorType === "domain_mismatch" && detectedDomain && expectedDomain && (
        <DomainComparison detected={detectedDomain} expected={expectedDomain} />
      )}

      {/* Actions */}
      <div className="mt-8 space-y-3">
        {/* Primary action: Retry */}
        <Button onClick={onRetry} className="w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>

        {/* Secondary actions */}
        <div className="flex gap-3">
          {errorType !== "technical" && (
            <Button
              variant="outline"
              onClick={onSendToDeveloper}
              className="flex-1 gap-2"
            >
              <Send className="h-4 w-4" />
              Send to developer
            </Button>
          )}

          <Button
            variant="outline"
            onClick={onNeedHelp}
            className={errorType === "technical" ? "w-full gap-2" : "flex-1 gap-2"}
          >
            <MessageCircle className="h-4 w-4" />
            Chat with us
          </Button>
        </div>

        {/* Domain mismatch: Add as different site */}
        {errorType === "domain_mismatch" && onAddDifferentSite && (
          <Button
            variant="ghost"
            onClick={onAddDifferentSite}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            Add as different site
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Content Helpers
// ============================================================================

interface ErrorContent {
  heading: string;
  subtext: string;
}

function getErrorContent(type: ErrorType): ErrorContent {
  switch (type) {
    case "timeout":
      return {
        heading: "Hmm, we can't see the helper yet.",
        subtext: "This usually means it needs a few more minutes.",
      };
    case "domain_mismatch":
      return {
        heading: "We found the helper, but on a different website",
        subtext: "The code seems to be installed on a different domain.",
      };
    case "technical":
      return {
        heading: "Something went wrong",
        subtext: "Our team has been notified. Please try again in a moment.",
      };
  }
}
