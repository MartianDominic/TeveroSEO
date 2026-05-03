/**
 * OAuth Enhancement Page
 * Phase 66-09: Platform Integration Facade
 *
 * Page for users to enhance their pixel connection with OAuth.
 * Route: /connect/enhance?siteId=xxx
 */
"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OAuthEnhancement, type EnhancementPlatform } from "@/components/connect/oauth-enhancement";
import { Loader2 } from "lucide-react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ConnectionStatusResponse {
  siteId: string;
  domain: string;
  pixelConnected: boolean;
  oauthConnections: Array<{
    platform: string;
    status: string;
  }>;
}

// -----------------------------------------------------------------------------
// Enhancement definitions
// -----------------------------------------------------------------------------

const ENHANCEMENTS: EnhancementPlatform[] = [
  {
    platform: "google_search_console",
    name: "Google Search Console",
    icon: <GoogleIcon className="h-6 w-6" />,
    benefits: [
      "See your ranking positions",
      "Track keyword performance",
      "Submit URLs for indexing",
    ],
    ctaText: "Connect GSC",
  },
  {
    platform: "google_analytics",
    name: "Google Analytics",
    icon: <GoogleIcon className="h-6 w-6" />,
    benefits: [
      "Access historical traffic data",
      "Track conversions and goals",
      "See traffic sources",
    ],
    ctaText: "Connect Analytics",
  },
  {
    platform: "google_business_profile",
    name: "Google Business Profile",
    icon: <GoogleIcon className="h-6 w-6" />,
    benefits: [
      "Respond to reviews",
      "Post local updates",
      "Track local search performance",
    ],
    ctaText: "Connect GBP",
  },
  {
    platform: "wordpress_org",
    name: "WordPress",
    icon: <WordPressIcon className="h-6 w-6" />,
    benefits: [
      "Publish content directly",
      "Edit SEO meta fields",
      "Manage redirects",
    ],
    ctaText: "Connect WordPress",
  },
  {
    platform: "shopify",
    name: "Shopify",
    icon: <ShopifyIcon className="h-6 w-6" />,
    benefits: [
      "Optimize product SEO",
      "Edit meta tags",
      "Manage redirects",
    ],
    ctaText: "Connect Shopify",
  },
  {
    platform: "wix",
    name: "Wix",
    icon: <WixIcon className="h-6 w-6" />,
    benefits: [
      "Publish blog posts",
      "Edit page SEO settings",
    ],
    ctaText: "Connect Wix",
  },
];

// -----------------------------------------------------------------------------
// Icons (inline SVGs)
// -----------------------------------------------------------------------------

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
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
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm-4.5 15.5l-1.85-5.067L3.5 12c0 3.033 1.627 5.683 4.054 7.138l-.054-.638zM12 20.5c-.97 0-1.91-.13-2.8-.37l2.97-8.63 3.04 8.33c.02.05.04.09.07.13-.98.35-2.1.54-3.28.54zm-1.29-16.65c.44-.02.84-.06.84-.06.4-.05.35-.62-.04-.6 0 0-1.19.09-1.96.09-.72 0-1.93-.09-1.93-.09-.4-.02-.44.58-.04.6 0 0 .37.04.77.06l1.14 3.14-1.6 4.8-2.67-7.94c.44-.02.84-.06.84-.06.4-.05.35-.62-.04-.6 0 0-1.19.09-1.96.09-.14 0-.3 0-.47-.01C5.41 4.66 8.49 3.5 12 3.5c2.6 0 4.97.96 6.78 2.54-.04 0-.09-.01-.13-.01-1.37 0-2.33.96-2.33 2.15 0 .89.67 1.67 1.31 2.47.5.8 1.02 1.79 1.02 3.11 0 .94-.38 2-.81 3.43l-1.06 3.55L12 8.63l-1.29 5.22z" />
    </svg>
  );
}

function ShopifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="#95BF47">
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

// -----------------------------------------------------------------------------
// Loading State
// -----------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-muted-foreground">Loading connection status...</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Error State
// -----------------------------------------------------------------------------

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="text-destructive text-xl">!</span>
      </div>
      <h2 className="text-lg font-medium mb-2">Unable to load</h2>
      <p className="text-muted-foreground mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="text-primary hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// No Site State
// -----------------------------------------------------------------------------

function NoSiteState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <h2 className="text-lg font-medium mb-2">No site specified</h2>
      <p className="text-muted-foreground mb-4">
        Please connect a website first before adding enhancements.
      </p>
      <a
        href="/connect"
        className="text-primary hover:underline"
      >
        Connect a website
      </a>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------------

export default function EnhancePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteId = searchParams.get("siteId");

  // State
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<ConnectionStatusResponse | null>(null);
  const [connectingPlatform, setConnectingPlatform] = React.useState<string | undefined>();

  // Fetch connection status
  const fetchStatus = React.useCallback(async () => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // In real implementation, this would call the API
      // For now, simulate with mock data
      const response = await fetch(`/api/platform/status/${siteId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch connection status");
      }

      const data = await response.json();
      setConnectionStatus(data);
    } catch (err) {
      // For now, use mock data if API not available
      setConnectionStatus({
        siteId: siteId,
        domain: "example.com", // Would come from API
        pixelConnected: true,
        oauthConnections: [],
      });
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  // Load on mount
  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle OAuth connect
  const handleConnect = React.useCallback((platform: string) => {
    setConnectingPlatform(platform);

    // Build OAuth URL and redirect
    // In real implementation, this would get the auth URL from the backend
    const returnUrl = encodeURIComponent(
      `${window.location.origin}/connect/enhance?siteId=${siteId}`
    );

    // Redirect to OAuth flow
    // For now, simulate with timeout
    setTimeout(() => {
      window.location.href = `/api/oauth/${platform}/authorize?siteId=${siteId}&returnUrl=${returnUrl}`;
    }, 500);
  }, [siteId]);

  // Handle dismiss
  const handleDismiss = React.useCallback(() => {
    // Navigate to dashboard or back
    window.location.href = "/dashboard";
  }, []);

  // Handle "later" for individual platforms
  const handleLater = React.useCallback((platform: string) => {
    // Store dismissal in localStorage
    if (typeof window !== "undefined") {
      const dismissed = JSON.parse(
        localStorage.getItem("tevero_enhancement_dismissed") || "[]"
      );
      if (!dismissed.includes(platform)) {
        dismissed.push(platform);
        localStorage.setItem(
          "tevero_enhancement_dismissed",
          JSON.stringify(dismissed)
        );
      }
    }
  }, []);

  // No siteId provided
  if (!siteId) {
    return (
      <div className="min-h-screen bg-background">
        <NoSiteState />
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingState />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <ErrorState message={error} onRetry={fetchStatus} />
      </div>
    );
  }

  // Compute enhancements with connected status
  const enhancementsWithStatus: EnhancementPlatform[] = ENHANCEMENTS.map((e) => ({
    ...e,
    connected: connectionStatus?.oauthConnections.some(
      (c) => c.platform === e.platform && c.status === "active"
    ),
  }));

  // Filter out platforms that were dismissed with "later"
  const getDismissedPlatforms = (): string[] => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(
        localStorage.getItem("tevero_enhancement_dismissed") || "[]"
      );
    } catch {
      return [];
    }
  };

  const dismissedPlatforms = getDismissedPlatforms();
  const visibleEnhancements = enhancementsWithStatus.filter(
    (e) => e.connected || !dismissedPlatforms.includes(e.platform)
  );

  return (
    <div className="min-h-screen bg-background">
      <OAuthEnhancement
        siteId={siteId}
        domain={connectionStatus?.domain ?? ""}
        pixelConnected={connectionStatus?.pixelConnected ?? false}
        enhancements={visibleEnhancements}
        onConnect={handleConnect}
        onDismiss={handleDismiss}
        onLater={handleLater}
        connectingPlatform={connectingPlatform}
      />
    </div>
  );
}
