/**
 * OAuth Contextual Prompt Components
 * Phase 66-09: Platform Integration Facade
 *
 * Inline prompt components for contextual OAuth enhancement.
 * Non-pushy, value-focused copy per DESIGN.md Section 9.
 *
 * Usage:
 * ```tsx
 * {!hasGscConnected && <GscPrompt onConnect={handleConnect} onDismiss={handleDismiss} />}
 * ```
 */
"use client";

import * as React from "react";
import { Button } from "@tevero/ui";
import { Card, CardContent } from "@tevero/ui";
import { X, TrendingUp, BarChart3, Building2, FileText } from "lucide-react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PromptProps {
  /** Handler for OAuth connect */
  onConnect: () => void;
  /** Handler for dismissing (hides until next session) */
  onDismiss: () => void;
  /** Whether the prompt is currently connecting */
  isConnecting?: boolean;
  /** Custom class name */
  className?: string;
}

export interface CmsPublishPromptProps extends PromptProps {
  /** The CMS platform name (e.g., "WordPress", "Shopify") */
  platformName: string;
}

// -----------------------------------------------------------------------------
// Dismissal state management
// -----------------------------------------------------------------------------

const DISMISSAL_KEY_PREFIX = "tevero_oauth_prompt_dismissed_";
const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check if a prompt was dismissed (localStorage based).
 */
export function isPromptDismissed(promptType: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const dismissed = localStorage.getItem(DISMISSAL_KEY_PREFIX + promptType);
    if (!dismissed) return false;

    const dismissedAt = parseInt(dismissed, 10);
    if (isNaN(dismissedAt)) return false;

    // Check if dismissal has expired
    return Date.now() - dismissedAt < DISMISSAL_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Mark a prompt as dismissed (stores timestamp in localStorage).
 */
export function dismissPrompt(promptType: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(DISMISSAL_KEY_PREFIX + promptType, Date.now().toString());
  } catch {
    // localStorage not available
  }
}

// -----------------------------------------------------------------------------
// Base Prompt Component
// -----------------------------------------------------------------------------

interface BasePromptProps extends PromptProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaText: string;
  promptType: string;
}

function BasePrompt({
  icon,
  title,
  description,
  ctaText,
  promptType,
  onConnect,
  onDismiss,
  isConnecting,
  className,
}: BasePromptProps) {
  const [isDismissed, setIsDismissed] = React.useState(() =>
    isPromptDismissed(promptType)
  );

  const handleDismiss = () => {
    dismissPrompt(promptType);
    setIsDismissed(true);
    onDismiss();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className ?? ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium text-foreground text-sm">{title}</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={handleDismiss}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* CTA */}
            <Button
              size="sm"
              className="mt-3"
              onClick={onConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Connecting...
                </>
              ) : (
                ctaText
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// GSC Prompt
// -----------------------------------------------------------------------------

/**
 * GscPrompt - Contextual prompt to connect Google Search Console.
 * Shows when user tries to view rankings without GSC connected.
 */
export function GscPrompt(props: PromptProps) {
  return (
    <BasePrompt
      {...props}
      icon={<TrendingUp className="h-5 w-5 text-primary" />}
      title="See your ranking positions"
      description="Connect Google Search Console to track where you rank for your keywords."
      ctaText="Connect Search Console"
      promptType="gsc"
    />
  );
}

// -----------------------------------------------------------------------------
// GA Prompt
// -----------------------------------------------------------------------------

/**
 * GaPrompt - Contextual prompt to connect Google Analytics.
 * Shows when viewing traffic data that could be enhanced with GA.
 */
export function GaPrompt(props: PromptProps) {
  return (
    <BasePrompt
      {...props}
      icon={<BarChart3 className="h-5 w-5 text-primary" />}
      title="Get historical traffic data"
      description="Connect Google Analytics to see your traffic trends and conversions over time."
      ctaText="Connect Analytics"
      promptType="ga"
    />
  );
}

// -----------------------------------------------------------------------------
// GBP Prompt
// -----------------------------------------------------------------------------

/**
 * GbpPrompt - Contextual prompt to connect Google Business Profile.
 * Shows for local businesses in the reviews/local SEO context.
 */
export function GbpPrompt(props: PromptProps) {
  return (
    <BasePrompt
      {...props}
      icon={<Building2 className="h-5 w-5 text-primary" />}
      title="Manage your local presence"
      description="Connect Google Business Profile to respond to reviews and post updates."
      ctaText="Connect Business Profile"
      promptType="gbp"
    />
  );
}

// -----------------------------------------------------------------------------
// CMS Publish Prompt
// -----------------------------------------------------------------------------

/**
 * CmsPublishPrompt - Contextual prompt to connect CMS for publishing.
 * Shows when user tries to publish content without CMS OAuth connected.
 */
export function CmsPublishPrompt({
  platformName,
  ...props
}: CmsPublishPromptProps) {
  return (
    <BasePrompt
      {...props}
      icon={<FileText className="h-5 w-5 text-primary" />}
      title={`Publish directly to ${platformName}`}
      description={`Connect your ${platformName} account to publish content with one click.`}
      ctaText={`Connect ${platformName}`}
      promptType={`cms_${platformName.toLowerCase().replace(/\s+/g, "_")}`}
    />
  );
}

// -----------------------------------------------------------------------------
// Hook for managing multiple prompts
// -----------------------------------------------------------------------------

export interface UseOAuthPromptsOptions {
  /** Called when user clicks connect on any prompt */
  onConnect: (platform: string) => void;
  /** Called when user dismisses any prompt */
  onDismiss?: (platform: string) => void;
}

export interface UseOAuthPromptsResult {
  /** Whether GSC prompt should be shown */
  showGscPrompt: boolean;
  /** Whether GA prompt should be shown */
  showGaPrompt: boolean;
  /** Whether GBP prompt should be shown */
  showGbpPrompt: boolean;
  /** Check if CMS prompt should be shown for a platform */
  shouldShowCmsPrompt: (platform: string) => boolean;
  /** Handler for GSC prompt */
  gscPromptProps: PromptProps;
  /** Handler for GA prompt */
  gaPromptProps: PromptProps;
  /** Handler for GBP prompt */
  gbpPromptProps: PromptProps;
  /** Get props for CMS prompt */
  getCmsPromptProps: (platform: string) => CmsPublishPromptProps;
  /** Currently connecting platform (if any) */
  connectingPlatform: string | null;
}

/**
 * useOAuthPrompts - Hook for managing OAuth prompt state.
 *
 * @example
 * ```tsx
 * const { showGscPrompt, gscPromptProps } = useOAuthPrompts({
 *   onConnect: (platform) => initiateOAuth(platform),
 * });
 *
 * return (
 *   <>
 *     {showGscPrompt && <GscPrompt {...gscPromptProps} />}
 *   </>
 * );
 * ```
 */
export function useOAuthPrompts({
  onConnect,
  onDismiss,
}: UseOAuthPromptsOptions): UseOAuthPromptsResult {
  const [dismissedPrompts, setDismissedPrompts] = React.useState<Set<string>>(
    new Set()
  );
  const [connectingPlatform, setConnectingPlatform] = React.useState<
    string | null
  >(null);

  // Initialize dismissed state from localStorage
  React.useEffect(() => {
    const dismissed = new Set<string>();
    const promptTypes = ["gsc", "ga", "gbp"];
    for (const type of promptTypes) {
      if (isPromptDismissed(type)) {
        dismissed.add(type);
      }
    }
    setDismissedPrompts(dismissed);
  }, []);

  const handleConnect = React.useCallback(
    (platform: string) => {
      setConnectingPlatform(platform);
      onConnect(platform);
    },
    [onConnect]
  );

  const handleDismiss = React.useCallback(
    (platform: string) => {
      setDismissedPrompts((prev) => new Set([...prev, platform]));
      onDismiss?.(platform);
    },
    [onDismiss]
  );

  const createPromptProps = React.useCallback(
    (platform: string): PromptProps => ({
      onConnect: () => handleConnect(platform),
      onDismiss: () => handleDismiss(platform),
      isConnecting: connectingPlatform === platform,
    }),
    [handleConnect, handleDismiss, connectingPlatform]
  );

  const shouldShowCmsPrompt = React.useCallback(
    (platform: string) => {
      const key = `cms_${platform.toLowerCase().replace(/\s+/g, "_")}`;
      return !dismissedPrompts.has(key) && !isPromptDismissed(key);
    },
    [dismissedPrompts]
  );

  const getCmsPromptProps = React.useCallback(
    (platformName: string): CmsPublishPromptProps => ({
      platformName,
      ...createPromptProps(`cms_${platformName.toLowerCase()}`),
    }),
    [createPromptProps]
  );

  return {
    showGscPrompt: !dismissedPrompts.has("gsc"),
    showGaPrompt: !dismissedPrompts.has("ga"),
    showGbpPrompt: !dismissedPrompts.has("gbp"),
    shouldShowCmsPrompt,
    gscPromptProps: createPromptProps("gsc"),
    gaPromptProps: createPromptProps("ga"),
    gbpPromptProps: createPromptProps("gbp"),
    getCmsPromptProps,
    connectingPlatform,
  };
}

export default {
  GscPrompt,
  GaPrompt,
  GbpPrompt,
  CmsPublishPrompt,
  useOAuthPrompts,
  isPromptDismissed,
  dismissPrompt,
};
