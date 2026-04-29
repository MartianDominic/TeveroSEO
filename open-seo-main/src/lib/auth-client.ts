/**
 * Auth client stub - REMOVED for security.
 *
 * SECURITY NOTE (2026-04-28): This stub has been removed because:
 * 1. It always returned { data: null, isPending: true } providing no actual auth check
 * 2. Client-side route guards using this gave a false sense of security
 * 3. Auth in open-seo-main is handled server-side via JWT from Clerk (via apps/web)
 *
 * MIGRATION:
 * - Server-side auth: Use requireApiAuth() from @/routes/api/seo/-middleware
 * - Client-side: Rely on server-side authentication; client guards are UX only
 * - If you need client-side auth state, the parent app (apps/web) handles it via Clerk
 *
 * The _authenticated.tsx route guard now returns content immediately since
 * actual authentication is enforced server-side on all API calls.
 *
 * @deprecated This module is deprecated. Auth is handled server-side.
 */

// Minimal session type for backward compatibility
interface User {
  id: string;
  email: string;
  name?: string | null;
}

interface Session {
  user: User;
}

interface SessionResult {
  data: Session | null;
  isPending: boolean;
  error: Error | null;
}

/**
 * Session hook stub - DEPRECATED.
 *
 * SECURITY: This hook does NOT provide authentication. Server-side auth via
 * requireApiAuth() is the actual security layer. This returns a synthetic
 * "authenticated" state to allow routes to render; the server will reject
 * any unauthorized API calls.
 *
 * @deprecated Auth is handled server-side. Do not rely on this for security.
 */
export function useSession(): SessionResult {
  // Return a synthetic "authenticated" state.
  // This is intentional - client-side auth guards provide UX, not security.
  // Server-side requireApiAuth() enforces actual authentication.
  //
  // If a user is not authenticated:
  // 1. Any API call will fail with 401
  // 2. The parent app (apps/web) will redirect to sign-in
  //
  // Returning isPending: false with synthetic user data allows the UI to render.
  // Actual auth errors surface when making API calls.
  return {
    data: {
      user: {
        id: "__pending__",
        email: "",
        name: null,
      },
    },
    isPending: false,
    error: null,
  };
}

/**
 * Sign out and redirect to home page.
 * Redirects to the parent app's sign-out flow.
 * @deprecated Use the parent app's sign-out mechanism.
 */
export function signOutAndRedirect(): void {
  if (typeof window !== "undefined") {
    // Redirect to the parent app's sign-out endpoint
    window.location.href = "/sign-out";
  }
}
