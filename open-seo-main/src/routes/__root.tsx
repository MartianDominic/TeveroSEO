/// <reference types="vite/client" />
// Initialize i18next before any React rendering
import "@/i18n";

import {
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";

// Lazy load devtools to enable tree-shaking in production builds
const TanStackRouterDevtoolsPanel = React.lazy(() =>
  import("@tanstack/react-router-devtools").then((m) => ({
    default: m.TanStackRouterDevtoolsPanel,
  }))
);
const TanStackDevtools = React.lazy(() =>
  import("@tanstack/react-devtools").then((m) => ({
    default: m.TanStackDevtools,
  }))
);
import { DefaultCatchBoundary } from "@/client/components/DefaultCatchBoundary";
import { themePreferenceInitScript } from "@/client/lib/theme";
import {
  identifyAnalyticsUser,
  initPostHog,
  resetAnalyticsUser,
} from "@/client/lib/posthog";
import { NotFound } from "@/client/components/NotFound";
import appCss from "@/client/styles/app.css?url";
import { useSession } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { Toaster } from "sonner";
import { queryClient } from "@/client/tanstack-db";
import { TooltipProvider } from "@/client/components/ui/tooltip";
import { getActiveOrganizationId } from "@/lib/auth-session";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        title: "OpenSEO",
      },
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [],
  }),
  component: AppLayout,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

function AppLayout() {
  return <Outlet />;
}

function PostHogBootstrap() {
  const isHostedMode = isHostedClientAuthMode();
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user?.id ?? null;
  const organizationId = getActiveOrganizationId(session);
  const previousUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isHostedMode || isSessionPending) {
      return;
    }

    initPostHog();

    if (userId) {
      identifyAnalyticsUser({ userId, organizationId });
      previousUserIdRef.current = userId;
    } else if (previousUserIdRef.current) {
      previousUserIdRef.current = null;
      resetAnalyticsUser();
    }
  }, [isHostedMode, isSessionPending, organizationId, userId]);

  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const showDevtools =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_DEVTOOLS !== "false";

  return (
    <html suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }}
        />
        <HeadContent />
      </head>
      <body>
        <ClientOnly>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <PostHogBootstrap />
              {children}
              <Toaster position="bottom-right" mobileOffset={{ bottom: 100 }} />
              {showDevtools ? (
                <React.Suspense fallback={null}>
                  <TanStackDevtools
                    config={{ position: "bottom-right" }}
                    eventBusConfig={{ connectToServerBus: true }}
                    plugins={[
                      {
                        name: "TanStack Router",
                        render: (
                          <React.Suspense fallback={null}>
                            <TanStackRouterDevtoolsPanel />
                          </React.Suspense>
                        ),
                        defaultOpen: true,
                      },
                    ]}
                  />
                </React.Suspense>
              ) : null}
            </TooltipProvider>
          </QueryClientProvider>
        </ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}
