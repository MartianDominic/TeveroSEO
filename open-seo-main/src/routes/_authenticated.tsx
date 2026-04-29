/**
 * Authenticated route layout wrapper.
 *
 * SECURITY NOTE (2026-04-28): This client-side wrapper does NOT provide
 * security - it's a UX layer only. All API endpoints are protected server-side
 * via requireApiAuth() which validates Clerk JWTs.
 *
 * If a user is not authenticated:
 * 1. This wrapper renders the UI (no client-side auth check)
 * 2. API calls fail with 401 Unauthorized
 * 3. The parent app (apps/web) handles the redirect to sign-in
 *
 * Previous implementation used a stub useSession() that always returned
 * isPending: true, which blocked rendering indefinitely. This has been fixed
 * to allow rendering while relying on server-side auth.
 */
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthPageShell } from "@/client/features/auth/AuthPage";
import { isHostedClientAuthMode } from "@/lib/auth-mode";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedShellLayout,
});

function AuthenticatedShellLayout() {
  const isHostedMode = isHostedClientAuthMode();

  // In non-hosted mode (e.g., embedded/delegated auth), don't show shell
  if (!isHostedMode) {
    return null;
  }

  // Render the authenticated shell immediately.
  // Server-side auth (requireApiAuth) enforces actual authentication.
  // If user is not authenticated, API calls will fail and the parent app
  // will redirect to sign-in.
  return (
    <AuthPageShell>
      <Outlet />
    </AuthPageShell>
  );
}
