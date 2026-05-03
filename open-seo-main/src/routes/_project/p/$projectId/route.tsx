/**
 * Project route layout wrapper.
 * HIGH-OSM-01 FIX: beforeLoad verifies project access with auth context.
 * MED-OSM-03 FIX: Added dedicated error boundary for project routes.
 */
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getErrorCode, getStandardErrorMessage } from "@/client/lib/error-messages";
import { AuthenticatedAppLayout } from "@/client/layout/AppShell";
import { getProjectAccess } from "@/serverFunctions/projects";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/client/components/ui/button";

export const Route = createFileRoute("/_project/p/$projectId")({
  beforeLoad: async ({ params }) => {
    try {
      await getProjectAccess({ data: { projectId: params.projectId } });
    } catch (error) {
      if (getErrorCode(error) === "UNAUTHENTICATED") {
        // Auth handled by Clerk - redirect to root
        throw redirect({ to: "/", replace: true });
      }

      if (getErrorCode(error) === "NOT_FOUND") {
        // Project not found or no access
        throw redirect({ to: "/", replace: true });
      }

      throw redirect({ to: "/", replace: true });
    }
  },
  pendingComponent: ProjectRoutePending,
  component: ProjectLayout,
  errorComponent: ProjectRouteError,
});

/**
 * MED-OSM-03: Dedicated error boundary for project routes.
 */
function ProjectRouteError({ error }: ErrorComponentProps) {
  const message = getStandardErrorMessage(
    error,
    "Failed to load project. Please try again."
  );

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <p className="text-destructive">{message}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectLayout() {
  const { projectId } = Route.useParams();

  return (
    <AuthenticatedAppLayout projectId={projectId}>
      <Outlet />
    </AuthenticatedAppLayout>
  );
}

function ProjectRoutePending() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
