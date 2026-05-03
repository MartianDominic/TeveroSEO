/**
 * /clients/[clientId]/seo — SEO landing page.
 *
 * Server component that fetches the default project for this client
 * and redirects to the audit page. If no project exists, shows
 * a setup prompt with self-service project creation.
 *
 * Phase 10: Replaces the iframe stub from Phase 7.
 * Phase 65: UX Dead End Fix - CRIT-15 (self-service SEO project creation)
 */

import { redirect } from "next/navigation";
import { getOpenSeo } from "@/lib/server-fetch";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@tevero/ui";
import { Search, Globe, BarChart3, Zap, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";

import { logger } from '@/lib/logger';
interface Project {
  id: string;
  name: string;
}

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function SeoLandingPage({ params }: PageProps) {
  const { clientId } = await params;

  let fetchError: string | null = null;

  try {
    // Fetch default project for this client
    const query = new URLSearchParams({ client_id: clientId });
    const project = await getOpenSeo<Project>(
      `/api/seo/projects?${query.toString()}`
    );

    if (project?.id) {
      // Redirect to the audit page for this project
      // Dynamic route - typedRoutes can't infer projectId at compile time
      const auditPath = `/clients/${clientId}/seo/${project.id}/audit`;
      redirect(auditPath as Parameters<typeof redirect>[0]);
    }
  } catch (error) {
    // Log error with context for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[seo/page] Failed to fetch default project:", {
      clientId,
      error: errorMessage,
    });
    fetchError = errorMessage;
  }

  // Fallback: show setup prompt if no project found or API failed
  return (
    <div className="p-6 max-w-3xl mx-auto">
      {fetchError ? (
        // Error state with retry guidance
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Connection Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We could not load your SEO project data. This may be a temporary
              issue.
            </p>
            <div className="flex gap-3">
              <Button asChild variant="default">
                <Link href={`/clients/${clientId}/seo` as Parameters<typeof Link>[0]["href"]}>
                  Try Again
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/clients/${clientId}/settings` as Parameters<typeof Link>[0]["href"]}>
                  Check Settings
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        // No project state with self-service creation path
        <div className="space-y-8">
          {/* Hero section */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Start Your SEO Journey
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Analyze your website&apos;s SEO performance, track rankings, and get
              actionable recommendations to improve your search visibility.
            </p>
          </div>

          {/* Features grid */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-4">
              <Globe className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Site Audit</h3>
              <p className="text-sm text-muted-foreground">
                Comprehensive technical SEO analysis with 100+ checks
              </p>
            </Card>
            <Card className="p-4">
              <BarChart3 className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Rank Tracking</h3>
              <p className="text-sm text-muted-foreground">
                Monitor keyword positions and track progress over time
              </p>
            </Card>
            <Card className="p-4">
              <Zap className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Recommendations</h3>
              <p className="text-sm text-muted-foreground">
                Prioritized fixes with estimated impact on rankings
              </p>
            </Card>
          </div>

          {/* CTA section */}
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-foreground mb-1">
                  Ready to analyze your site?
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create an SEO project and run your first audit in minutes.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link href={`/clients/${clientId}/seo/setup` as Parameters<typeof Link>[0]["href"]}>
                  Create SEO Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Help section */}
          <p className="text-center text-sm text-muted-foreground">
            Need help getting started?{" "}
            <a
              href="/help/seo-setup"
              className="text-primary hover:underline"
            >
              Read our setup guide
            </a>{" "}
            or{" "}
            <a
              href="/support"
              className="text-primary hover:underline"
            >
              contact support
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
