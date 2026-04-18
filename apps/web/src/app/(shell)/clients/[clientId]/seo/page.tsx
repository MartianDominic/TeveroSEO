/**
 * /clients/[clientId]/seo — SEO landing page.
 *
 * Server component that fetches the default project for this client
 * and redirects to the audit page. If no project exists, shows
 * a setup prompt.
 *
 * Phase 10: Replaces the iframe stub from Phase 7.
 */

import { redirect } from "next/navigation";
import { getOpenSeo } from "@/lib/server-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@tevero/ui";
import { Search } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function SeoLandingPage({ params }: PageProps) {
  const { clientId } = await params;

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
    // Log error but show fallback UI
    console.error("[seo/page] Failed to fetch default project:", error);
  }

  // Fallback: show setup prompt if no project found or API failed
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            SEO Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            No SEO project found for this client. SEO projects are created
            automatically when you run your first site audit.
          </p>
          <p className="text-sm text-muted-foreground">
            Contact support if you need help setting up SEO tools for this
            client.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
