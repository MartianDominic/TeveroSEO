/**
 * Auth client stub for backward compatibility.
 * Authentication is now handled by Clerk.
 * @deprecated Use Clerk's React SDK hooks directly when available.
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
 * Session hook stub - returns a minimal session shape.
 * In production, Clerk's useUser/useSession hooks should be used instead.
 * @deprecated Use Clerk's useSession or useUser hook.
 */
export function useSession(): SessionResult {
  // This stub always returns a pending/null state.
  // The actual auth state should come from Clerk's React components.
  // Client-side auth is handled by Clerk's hosted UI.
  return {
    data: null,
    isPending: true,
    error: null,
  };
}

/**
 * Sign out and redirect to home page.
 * With Clerk, this should use Clerk's signOut function.
 * @deprecated Use Clerk's useClerk().signOut() or SignOutButton component.
 */
export function signOutAndRedirect(): void {
  // In production with Clerk, use:
  // import { useClerk } from "@clerk/clerk-react";
  // const { signOut } = useClerk();
  // signOut({ redirectUrl: "/" });

  // For now, redirect to Clerk's sign-out flow
  if (typeof window !== "undefined") {
    window.location.href = "/sign-out";
  }
}
