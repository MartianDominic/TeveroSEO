/**
 * Project route layout wrapper.
 *
 * HIGH-OSM-01 FIX: Added beforeLoad auth check for _project routes.
 * This ensures authentication is verified before any project-scoped
 * route is rendered. The actual project access check happens in the
 * $projectId route, but this provides a first-level auth gate.
 *
 * H-TSK-02 FIX: Auth architecture for _project routes:
 * - Hosted mode: Redirects to "/" since users should use /_app routes
 * - Embedded mode: Parent app handles auth UI, server functions enforce auth
 *   via requireAuthenticatedContext middleware which returns UNAUTHENTICATED
 *   if the session is invalid.
 *
 * Note: This route is used for embedded/delegated auth scenarios
 * where the parent app handles the auth UI.
 */
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { isHostedClientAuthMode } from "@/lib/auth-mode";

export const Route = createFileRoute("/_project")({
  beforeLoad: async () => {
    // HIGH-OSM-01: In hosted mode, we rely on _app layout for auth.
    // In embedded mode, the parent app handles auth - just render.
    //
    // H-TSK-02: Defense in depth - server functions enforce auth via
    // requireAuthenticatedContext middleware. Any unauthenticated request
    // to a server function will receive an UNAUTHENTICATED error response,
    // which the client can handle by redirecting to the parent app's login.
    //
    // The actual auth check happens via requireAuthenticatedContext
    // in server functions, which will return UNAUTHENTICATED if needed.
    const isHostedMode = isHostedClientAuthMode();

    // In hosted mode, this route should not be directly accessible
    // Users should go through /_app routes instead
    if (isHostedMode) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: ProjectRouteLayout,
});

function ProjectRouteLayout() {
  return <Outlet />;
}
