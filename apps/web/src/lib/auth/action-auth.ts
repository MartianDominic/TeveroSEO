/**
 * Server Action Authentication Utilities
 *
 * Provides authentication wrappers for Next.js Server Actions.
 * All server actions that modify data or access sensitive resources
 * should use these utilities.
 */
'use server';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

/**
 * Authentication context for server actions.
 */
export interface ActionAuthContext {
  userId: string;
  orgId?: string;
}

/**
 * Error thrown when server action authorization fails.
 */
export class ActionAuthError extends Error {
  constructor(
    message: string,
    public code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' = 'UNAUTHORIZED'
  ) {
    super(message);
    this.name = 'ActionAuthError';
  }
}

/**
 * Require authentication in server actions.
 * Redirects to sign-in page if not authenticated.
 *
 * Use this for actions that should redirect unauthenticated users.
 *
 * @returns ActionAuthContext with userId and orgId
 *
 * @example
 * ```ts
 * export async function createPost(title: string) {
 *   const auth = await requireActionAuth();
 *   return db.posts.create({ title, userId: auth.userId });
 * }
 * ```
 */
export async function requireActionAuth(): Promise<ActionAuthContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    // Use string variable to bypass Next.js typed routes check
    const signInPath = '/sign-in';
    redirect(signInPath as never);
  }

  return {
    userId,
    orgId: orgId ?? undefined
  };
}

/**
 * Require authentication without redirect.
 * Throws ActionAuthError if not authenticated.
 *
 * Use this for API-like actions where you want to return an error
 * instead of redirecting.
 *
 * @returns ActionAuthContext with userId and orgId
 * @throws ActionAuthError if not authenticated
 */
export async function requireActionAuthStrict(): Promise<ActionAuthContext> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new ActionAuthError('Unauthorized: Authentication required', 'UNAUTHORIZED');
  }

  return {
    userId,
    orgId: orgId ?? undefined
  };
}

/**
 * Validate that the current user has access to a specific client.
 * Verifies ownership through the backend API.
 *
 * @param clientId - The client ID to validate access for
 * @param authContext - The authentication context from requireActionAuth
 * @throws ActionAuthError with FORBIDDEN code if access is denied
 *
 * @example
 * ```ts
 * export async function updateClient(clientId: string, data: ClientData) {
 *   const auth = await requireActionAuth();
 *   await validateClientOwnership(clientId, auth);
 *   return db.clients.update(clientId, data);
 * }
 * ```
 */
export async function validateClientOwnership(
  clientId: string,
  authContext: ActionAuthContext
): Promise<void> {
  const backendUrl = process.env.AI_WRITER_BACKEND_URL ?? 'http://ai-writer-backend:8000';

  try {
    const response = await fetch(
      `${backendUrl}/api/clients/${clientId}/verify-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: authContext.userId,
          orgId: authContext.orgId
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new ActionAuthError('Client not found', 'NOT_FOUND');
      }
      throw new ActionAuthError('Access denied: You do not own this client', 'FORBIDDEN');
    }

    const result = await response.json() as { hasAccess: boolean };

    if (!result.hasAccess) {
      throw new ActionAuthError('Access denied: You do not own this client', 'FORBIDDEN');
    }
  } catch (error) {
    if (error instanceof ActionAuthError) {
      throw error;
    }

    // Network error or backend unavailable
    // Fail closed for security, but log the error
    console.error(`[ActionAuth] Failed to verify client access: clientId=${clientId}, userId=${authContext.userId}`, error);
    throw new ActionAuthError('Unable to verify access. Please try again.', 'FORBIDDEN');
  }
}

/**
 * Create an authenticated action wrapper.
 * Wraps an action function with automatic authentication.
 *
 * @param action - The action function to wrap
 * @returns A new function that authenticates before running the action
 *
 * @example
 * ```ts
 * const createPostAction = createAuthenticatedAction(
 *   async (input: { title: string }, auth) => {
 *     return db.posts.create({ title: input.title, userId: auth.userId });
 *   }
 * );
 *
 * // Usage
 * const post = await createPostAction({ title: 'Hello' });
 * ```
 */
export function createAuthenticatedAction<TInput, TOutput>(
  action: (input: TInput, auth: ActionAuthContext) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const authContext = await requireActionAuth();
    return action(input, authContext);
  };
}

/**
 * Create an authenticated action with client ownership validation.
 * Wraps an action function with authentication AND client access verification.
 *
 * @param clientIdExtractor - Function to extract clientId from input
 * @param action - The action function to wrap
 * @returns A new function that authenticates and validates ownership before running
 *
 * @example
 * ```ts
 * const updateClientAction = createClientAuthenticatedAction(
 *   (input) => input.clientId,
 *   async (input: { clientId: string; name: string }, auth) => {
 *     return db.clients.update(input.clientId, { name: input.name });
 *   }
 * );
 * ```
 */
export function createClientAuthenticatedAction<TInput, TOutput>(
  clientIdExtractor: (input: TInput) => string,
  action: (input: TInput, auth: ActionAuthContext) => Promise<TOutput>
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const authContext = await requireActionAuth();
    const clientId = clientIdExtractor(input);
    await validateClientOwnership(clientId, authContext);
    return action(input, authContext);
  };
}

/**
 * Result type for actions that return success/error status.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Wrap an action with error handling that returns ActionResult.
 * Use this for client-facing actions where you want structured error responses.
 *
 * @param action - The action function to wrap
 * @returns A function that returns ActionResult instead of throwing
 *
 * @example
 * ```ts
 * const safeCreatePost = withActionErrorHandler(
 *   async (input: { title: string }) => {
 *     const auth = await requireActionAuth();
 *     return db.posts.create({ title: input.title, userId: auth.userId });
 *   }
 * );
 *
 * const result = await safeCreatePost({ title: 'Hello' });
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function withActionErrorHandler<TInput, TOutput>(
  action: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<ActionResult<TOutput>> {
  return async (input: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const data = await action(input);
      return { success: true, data };
    } catch (error) {
      if (error instanceof ActionAuthError) {
        return {
          success: false,
          error: error.message,
          code: error.code
        };
      }

      // Log unexpected errors
      console.error('[Action] Unexpected error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      };
    }
  };
}
