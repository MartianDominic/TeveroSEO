/**
 * OAuthNotConfigured Component
 * FIX-17 MED-UJ-03: Silent failures when platform secrets not configured
 *
 * Shows a clear error message when OAuth integrations are not configured,
 * rather than failing silently or showing cryptic errors.
 */
"use client";

import { AlertTriangle, Settings, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, Alert, AlertDescription } from "@tevero/ui";

export interface OAuthNotConfiguredProps {
  /** Name of the integration (e.g., "Google Search Console", "WordPress") */
  integrationName: string;
  /** Optional description of what the integration provides */
  description?: string;
  /** URL to the admin/settings page where this can be configured */
  configureUrl?: string;
  /** URL to documentation for setting up the integration */
  docsUrl?: string;
  /** Whether the user has admin permissions to configure */
  canConfigure?: boolean;
  /** Custom message for non-admin users */
  contactMessage?: string;
}

/**
 * Full card component for OAuth not configured state.
 * Use this when the entire feature depends on the integration.
 */
export function OAuthNotConfiguredCard({
  integrationName,
  description,
  configureUrl,
  docsUrl,
  canConfigure = false,
  contactMessage = "Contact your administrator to set up this integration.",
}: OAuthNotConfiguredProps) {
  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          {integrationName} Not Configured
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}

        {canConfigure ? (
          <div className="space-y-2">
            <p className="text-sm">
              To enable this feature, you need to configure {integrationName} credentials.
            </p>
            <div className="flex gap-2 flex-wrap">
              {configureUrl && (
                <a
                  href={configureUrl}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Settings className="h-4 w-4" />
                  Configure Now
                </a>
              )}
              {docsUrl && (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                  Setup Guide
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{contactMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline alert for OAuth not configured.
 * Use this when the integration is optional or secondary.
 */
export function OAuthNotConfiguredAlert({
  integrationName,
  configureUrl,
  canConfigure = false,
  contactMessage = "Contact your administrator to enable this feature.",
}: OAuthNotConfiguredProps) {
  return (
    <Alert variant="default" className="border-warning/50 bg-warning/5">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          {integrationName} integration is not configured.
          {!canConfigure && ` ${contactMessage}`}
        </span>
        {canConfigure && configureUrl && (
          <a
            href={configureUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline ml-2"
          >
            <Settings className="h-3 w-3" />
            Configure
          </a>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Common OAuth integrations with default messages.
 * Use these for consistent messaging across the app.
 */
export const OAuthIntegrations = {
  GoogleSearchConsole: {
    name: "Google Search Console",
    description:
      "Connect Google Search Console to track keyword rankings, impressions, and clicks.",
    docsUrl: "https://docs.tevero.app/integrations/google-search-console",
  },
  GoogleAnalytics: {
    name: "Google Analytics",
    description:
      "Connect Google Analytics to track website traffic and user behavior.",
    docsUrl: "https://docs.tevero.app/integrations/google-analytics",
  },
  WordPress: {
    name: "WordPress",
    description:
      "Connect your WordPress site to automatically publish articles.",
    docsUrl: "https://docs.tevero.app/integrations/wordpress",
  },
  Shopify: {
    name: "Shopify",
    description:
      "Connect your Shopify store to publish blog posts and product descriptions.",
    docsUrl: "https://docs.tevero.app/integrations/shopify",
  },
} as const;

/**
 * Hook to check if an OAuth integration is configured.
 * Returns a component if not configured, null if ready to use.
 *
 * @example
 * ```tsx
 * const gscWarning = useOAuthCheck("google_search_console", {
 *   integrationName: "Google Search Console",
 *   canConfigure: isAdmin,
 * });
 *
 * if (gscWarning) {
 *   return gscWarning;
 * }
 *
 * // Render the actual feature
 * ```
 */
export function useOAuthCheck(
  integrationKey: string,
  configuredKeys: string[],
  props: Omit<OAuthNotConfiguredProps, "integrationName"> & {
    integrationName: string;
    variant?: "card" | "alert";
  }
): React.ReactNode | null {
  const { variant = "card", ...rest } = props;

  if (configuredKeys.includes(integrationKey)) {
    return null;
  }

  return variant === "card" ? (
    <OAuthNotConfiguredCard {...rest} />
  ) : (
    <OAuthNotConfiguredAlert {...rest} />
  );
}
