"use client";

/**
 * Portal Layout
 *
 * Shell layout for client portal with navigation sidebar, header, and data source footer.
 * Wraps children with QueryClientProvider for data fetching.
 * Includes PWA manifest link and service worker registration.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Activity,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";

/**
 * Register service worker on mount
 */
function useServiceWorker() {
  React.useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Every hour
        })
        .catch((error) => {
          // Non-fatal: service worker registration failed
          // This is expected in development or when SW is not supported
        });
    }
  }, []);
}

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const clientId = params.clientId as string;

  // Register service worker for PWA support
  useServiceWorker();

  const navItems: NavItem[] = [
    {
      href: `/portal/${clientId}`,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: `/portal/${clientId}/keywords`,
      label: "Keywords",
      icon: Search,
    },
    {
      href: `/portal/${clientId}/activity`,
      label: "Activity",
      icon: Activity,
    },
  ];

  const isActive = (href: string) => {
    if (href === `/portal/${clientId}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-canvas flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "w-[clamp(200px,14vw,240px)] flex-shrink-0",
            "bg-surface border-r border-hairline",
            "flex flex-col"
          )}
        >
          {/* Logo/Brand */}
          <div className="p-5 border-b border-hairline-2">
            <h1 className="font-display text-[20px] font-medium text-text-1 tracking-[-0.02em]">
              TeveroSEO
            </h1>
            <p className="text-[12px] text-text-3 mt-0.5">Client Portal</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href as Parameters<typeof Link>[0]["href"]}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-[--radius-button]",
                        "text-[14px] font-medium transition-colors duration-150",
                        active
                          ? "bg-accent-soft text-accent-ink"
                          : "text-text-2 hover:bg-surface-2 hover:text-text-1"
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer actions */}
          <div className="p-3 border-t border-hairline-2">
            <ul className="space-y-1">
              <li>
                <Link
                  href={`/portal/${clientId}/notifications` as Parameters<typeof Link>[0]["href"]}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[--radius-button] text-[14px] text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors duration-150"
                >
                  <Bell className="h-4 w-4" />
                  Notifications
                </Link>
              </li>
              <li>
                <Link
                  href={`/portal/${clientId}/settings` as Parameters<typeof Link>[0]["href"]}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[--radius-button] text-[14px] text-text-2 hover:bg-surface-2 hover:text-text-1 transition-colors duration-150"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header
            className={cn(
              "h-14 flex items-center justify-between px-6",
              "bg-[rgba(250,250,247,0.78)] backdrop-blur-[10px] backdrop-saturate-[140%]",
              "border-b border-hairline-2",
              "sticky top-0 z-30"
            )}
          >
            {/* Breadcrumb / Client info */}
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-text-3">Client ID:</span>
              <span className="font-mono text-text-2">{clientId}</span>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2">
              <button
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5",
                  "text-[13px] text-text-2 rounded-[--radius-button]",
                  "hover:bg-surface-2 transition-colors duration-150"
                )}
              >
                <LogOut className="h-4 w-4" />
                Exit Portal
              </button>
            </div>
          </header>

          {/* Page content */}
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>

          {/* Data source footer */}
          <footer className="px-6 py-3 border-t border-hairline-2 bg-surface-2/50">
            <p className="text-[12px] text-text-3 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-success" />
              Data source: Google Search Console
              <span className="text-text-4">|</span>
              <span className="font-mono">Updated every 24 hours</span>
            </p>
          </footer>
        </main>
      </div>
    </QueryClientProvider>
  );
}
