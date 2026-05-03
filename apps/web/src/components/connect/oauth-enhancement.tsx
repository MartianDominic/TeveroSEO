/**
 * OAuth Enhancement Component
 * Phase 66-09: Platform Integration Facade
 *
 * Full-page view showing available OAuth enhancements for
 * users who have installed the pixel but haven't connected OAuth.
 *
 * Non-pushy, value-focused copy per DESIGN.md Section 9.
 */
"use client";

import * as React from "react";
import { Button } from "@tevero/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tevero/ui";
import { CheckCircle2, ExternalLink, X } from "lucide-react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface EnhancementPlatform {
  platform: string;
  name: string;
  icon: React.ReactNode;
  benefits: string[];
  ctaText: string;
  connected?: boolean;
}

export interface OAuthEnhancementProps {
  /** Site identifier */
  siteId: string;
  /** Domain for display */
  domain: string;
  /** Current pixel status */
  pixelConnected: boolean;
  /** Available enhancements (platforms not yet connected) */
  enhancements: EnhancementPlatform[];
  /** Handler for OAuth connect */
  onConnect: (platform: string) => void;
  /** Handler for dismissing the entire enhancement view */
  onDismiss: () => void;
  /** Handler for "I'll do this later" per platform */
  onLater?: (platform: string) => void;
  /** Loading state during OAuth redirect */
  connectingPlatform?: string;
}

// -----------------------------------------------------------------------------
// Platform Icons (inline SVGs for compact bundle)
// -----------------------------------------------------------------------------

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function WordPressIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-1.088 2.113c.555 1.226 1.077 2.467 1.573 3.72a17.77 17.77 0 0 1-4.97.001l1.573-3.72h1.824zm-5.5 1.344a8.053 8.053 0 0 1 3.295-2.107l-2.012 4.76c-.957-1.15-1.583-2.37-1.283-2.653zm-.6 6.543c0-.916.159-1.797.446-2.617l2.763 6.563A8.032 8.032 0 0 1 4.812 12zm7.188 8.002a8.015 8.015 0 0 1-3.708-.91l2.018-4.783 2.018 4.783a8.015 8.015 0 0 1-.328.91zm1.088-2.113l-1.573-3.72a17.77 17.77 0 0 1 4.97-.001l-1.573 3.72h-1.824zm5.5-1.344a8.053 8.053 0 0 1-3.295 2.107l2.012-4.76c.957 1.15 1.583 2.37 1.283 2.653zm.6-6.543c0 .916-.159 1.797-.446 2.617l-2.763-6.563a8.032 8.032 0 0 1 3.209 3.946z" />
    </svg>
  );
}

function ShopifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.337 4.462c-.032-.2-.185-.3-.313-.319-.128-.018-2.683-.192-2.683-.192s-1.792-1.749-1.978-1.935c-.186-.186-.55-.132-.693-.088l-.954.294C8.454 1.562 8.161 1 7.647 1c-.513 0-1.019.442-1.272.943l-.728-.228c-.24-.074-.37.013-.414.158-.044.145-.956 2.947-.956 2.947-.167.506.142.69.142.69L11.73 8.5c.26.08.524-.14.524-.14l-.025-.045s-.056-.088-.186-.086c-.13.002-.188.074-.188.074l-6.38-2.82-.007.004.906-2.783-.001-.003.728.228c-.073.393-.073 1.026.333 1.615.405.589 1.091.957 1.86.976.77.019 1.495-.31 1.873-.874.378-.563.408-1.27.194-1.86l2.023.625c-.034.106.074.17.074.17l2.707.834s.105.034.17-.024c.065-.058.022-.163.022-.163z" />
    </svg>
  );
}

function WixIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 7v10c0 .55-.45 1-1 1H4c-.55 0-1-.45-1-1V7c0-.55.45-1 1-1h16c.55 0 1 .45 1 1zm-3 2h-2v6h2V9zm-4 0h-2l-1 4-1-4h-2v6h1.5v-4l1 4h1l1-4v4H18V9z" />
    </svg>
  );
}

// Map platform IDs to icons
const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google_search_console: GoogleIcon,
  google_analytics: GoogleIcon,
  google_business_profile: GoogleIcon,
  wordpress_org: WordPressIcon,
  wordpress_com: WordPressIcon,
  shopify: ShopifyIcon,
  wix: WixIcon,
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * OAuthEnhancement - Full-page view for enhancing pixel connections with OAuth.
 *
 * Shows:
 * - Current connection status (pixel connected)
 * - Available enhancements by platform with benefits
 * - Connect buttons for each platform
 * - Option to dismiss/defer
 */
export function OAuthEnhancement({
  siteId,
  domain,
  pixelConnected,
  enhancements,
  onConnect,
  onDismiss,
  onLater,
  connectingPlatform,
}: OAuthEnhancementProps) {
  // Filter to show only unconnected platforms
  const availableEnhancements = enhancements.filter((e) => !e.connected);
  const connectedCount = enhancements.filter((e) => e.connected).length;
  const allConnected = availableEnhancements.length === 0;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Enhance your connection
          </h1>
          <p className="text-muted-foreground mt-1">
            Get more features for{" "}
            <span className="font-medium text-foreground">{domain}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Current status card */}
      <Card className="mb-8 border-success/30 bg-success/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {pixelConnected ? "Pixel connected" : "Basic connection active"}
              </p>
              <p className="text-sm text-muted-foreground">
                Real-time analytics and Core Web Vitals tracking enabled
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All done state */}
      {allConnected ? (
        <Card className="text-center py-12">
          <CardContent>
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2">All set!</h2>
            <p className="text-muted-foreground mb-6">
              You've connected all available platforms for {domain}
            </p>
            <Button onClick={onDismiss}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Enhancement header */}
          <div className="mb-4">
            <h2 className="text-lg font-medium">Available enhancements</h2>
            <p className="text-sm text-muted-foreground">
              Connect additional platforms to unlock more features
            </p>
          </div>

          {/* Enhancement cards */}
          <div className="space-y-4">
            {availableEnhancements.map((enhancement) => {
              const IconComponent = PLATFORM_ICONS[enhancement.platform];
              const isConnecting = connectingPlatform === enhancement.platform;

              return (
                <Card key={enhancement.platform} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {IconComponent ? (
                          <IconComponent className="h-6 w-6" />
                        ) : (
                          enhancement.icon
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground">
                          {enhancement.name}
                        </h3>

                        {/* Benefits list */}
                        <ul className="mt-2 space-y-1">
                          {enhancement.benefits.map((benefit, idx) => (
                            <li
                              key={idx}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                              {benefit}
                            </li>
                          ))}
                        </ul>

                        {/* Actions */}
                        <div className="mt-4 flex items-center gap-3">
                          <Button
                            onClick={() => onConnect(enhancement.platform)}
                            disabled={isConnecting}
                            className="gap-2"
                          >
                            {isConnecting ? (
                              <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Connecting...
                              </>
                            ) : (
                              <>
                                {enhancement.ctaText}
                                <ExternalLink className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                          {onLater && (
                            <Button
                              variant="ghost"
                              onClick={() => onLater(enhancement.platform)}
                              disabled={isConnecting}
                            >
                              Later
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Skip all link */}
          <div className="mt-8 text-center">
            <Button variant="link" onClick={onDismiss}>
              I'll enhance later - go to dashboard
            </Button>
          </div>
        </>
      )}

      {/* Connected count indicator */}
      {connectedCount > 0 && !allConnected && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {connectedCount} platform{connectedCount !== 1 ? "s" : ""} already
          connected
        </p>
      )}
    </div>
  );
}

export default OAuthEnhancement;
