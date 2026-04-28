import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { getErrorCode } from "@/client/lib/error-messages";
import { AuthenticatedAppLayout } from "@/client/layout/AppShell";
import { getProjectAccess } from "@/serverFunctions/projects";

export const Route = createFileRoute("/_project/p/$projectId")({
  beforeLoad: async ({ params }) => {
    try {
      await getProjectAccess({ data: { projectId: params.projectId } });
    } catch (error) {
      if (getErrorCode(error) === "UNAUTHENTICATED") {
        // Auth handled by Clerk - redirect to root
        throw redirect({ to: "/", replace: true });
      }

      throw redirect({ to: "/", replace: true });
    }
  },
  pendingComponent: ProjectRoutePending,
  component: ProjectLayout,
});

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
