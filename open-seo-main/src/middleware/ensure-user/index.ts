import { resolveClerkContext } from "./clerk";
import type { EnsuredUserContext } from "./types";

/**
 * Resolve authenticated user context from Clerk JWT.
 * All authentication is handled by Clerk.
 */
export async function resolveUserContext(
  headers: Headers,
): Promise<EnsuredUserContext> {
  return resolveClerkContext(headers);
}

export type { EnsuredUserContext };
