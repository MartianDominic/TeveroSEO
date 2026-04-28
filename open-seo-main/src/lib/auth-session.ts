/**
 * Auth session utilities stub for backward compatibility.
 * Authentication is now handled by Clerk.
 * @deprecated Use Clerk's session/organization hooks directly when available.
 */

interface User {
  id: string;
  email: string;
  name?: string | null;
}

interface Session {
  user: User;
}

/**
 * Get the active organization ID from a session.
 * With Clerk, the user ID is used as the organization ID (single-tenant model).
 * @deprecated Use Clerk's organization hooks when multi-tenant support is needed.
 */
export function getActiveOrganizationId(session: Session | null): string | null {
  // In the current model, organizationId equals userId
  return session?.user?.id ?? null;
}
