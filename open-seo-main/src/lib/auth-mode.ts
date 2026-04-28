/**
 * Auth mode stub - Clerk auth is always "hosted"
 * This file provides backward compatibility for client code during migration.
 * @deprecated Auth is now handled by Clerk via the Next.js app.
 */

export type AuthMode = "hosted";

export function getAuthMode(_mode?: string): AuthMode {
  return "hosted";
}

export function isHostedAuthMode(_mode?: string): boolean {
  return true;
}

export function isDelegatedAuthMode(_mode?: string): boolean {
  return false;
}

/**
 * Client-side auth mode check - always returns true with Clerk.
 * @deprecated Use Clerk hooks directly instead.
 */
export function isHostedClientAuthMode(): boolean {
  return true;
}
