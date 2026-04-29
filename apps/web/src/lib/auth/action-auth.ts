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
import { z } from 'zod';
import { env } from '@/lib/env';

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
 * Get the session token for backend API authentication.
 * This token should be passed as Authorization: Bearer header to backend services.
 *
 * @returns The session token or null if not authenticated
 */
async function getSessionToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}

/**
 * Validate that the current user is a member of a specific workspace.
 * Verifies membership through the backend API.
 *
 * @param workspaceId - The workspace ID to validate membership for
 * @param authContext - The authentication context from requireActionAuth
 * @throws ActionAuthError with FORBIDDEN code if not a member
 *
 * @example
 * ```ts
 * export async function getWorkspaceData(workspaceId: string) {
 *   const auth = await requireActionAuth();
 *   await validateWorkspaceMembership(workspaceId, auth);
 *   return db.workspaces.find(workspaceId);
 * }
 * ```
 */
/**
 * Schema for workspace membership API response.
 */
const workspaceMembershipResponseSchema = z.object({
  isMember: z.boolean(),
  role: z.string().optional(),
});

export async function validateWorkspaceMembership(
  workspaceId: string,
  authContext: ActionAuthContext
): Promise<void> {
  const backendUrl = env.OPEN_SEO_URL;

  // Get session token for backend authentication
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new ActionAuthError('Unable to obtain session token for backend authentication', 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/workspaces/${workspaceId}/membership?userId=${encodeURIComponent(authContext.userId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new ActionAuthError('Workspace not found', 'NOT_FOUND');
      }
      throw new ActionAuthError('Access denied: Not a member of this workspace', 'FORBIDDEN');
    }

    const json = await response.json();
    const parsed = workspaceMembershipResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[ActionAuth] Invalid workspace membership response shape:', parsed.error);
      throw new ActionAuthError('Invalid response from authorization service', 'FORBIDDEN');
    }

    if (!parsed.data.isMember) {
      throw new ActionAuthError('Access denied: Not a member of this workspace', 'FORBIDDEN');
    }
  } catch (error) {
    if (error instanceof ActionAuthError) {
      throw error;
    }

    // Network error or backend unavailable - fail closed for security
    console.error(`[ActionAuth] Failed to verify workspace membership: workspaceId=${workspaceId}, userId=${authContext.userId}`, error);
    throw new ActionAuthError('Unable to verify workspace membership. Please try again.', 'FORBIDDEN');
  }
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
/**
 * Schema for client ownership API response.
 */
const clientOwnershipResponseSchema = z.object({
  hasAccess: z.boolean(),
});

export async function validateClientOwnership(
  clientId: string,
  authContext: ActionAuthContext
): Promise<void> {
  const backendUrl = env.AI_WRITER_URL;

  // Get session token for backend authentication
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new ActionAuthError('Unable to obtain session token for backend authentication', 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/clients/${clientId}/verify-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
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

    const json = await response.json();
    const parsed = clientOwnershipResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[ActionAuth] Invalid client ownership response shape:', parsed.error);
      throw new ActionAuthError('Invalid response from authorization service', 'FORBIDDEN');
    }

    if (!parsed.data.hasAccess) {
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
 * Validate that the current user has access to a specific prospect.
 * Verifies ownership through the backend API by checking prospect's workspace membership.
 *
 * @param prospectId - The prospect ID to validate access for
 * @param authContext - The authentication context from requireActionAuth
 * @throws ActionAuthError with FORBIDDEN code if access is denied
 *
 * @example
 * ```ts
 * export async function updateProspect(prospectId: string, data: ProspectData) {
 *   const auth = await requireActionAuth();
 *   await validateProspectOwnership(prospectId, auth);
 *   return db.prospects.update(prospectId, data);
 * }
 * ```
 */
/**
 * Schema for prospect ownership API response.
 */
const prospectOwnershipResponseSchema = z.object({
  hasAccess: z.boolean(),
  workspaceId: z.string().optional(),
});

export async function validateProspectOwnership(
  prospectId: string,
  authContext: ActionAuthContext
): Promise<void> {
  const backendUrl = env.OPEN_SEO_URL;

  // Get session token for backend authentication
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new ActionAuthError('Unable to obtain session token for backend authentication', 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/prospects/${prospectId}/verify-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: authContext.userId,
          orgId: authContext.orgId
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new ActionAuthError('Prospect not found', 'NOT_FOUND');
      }
      throw new ActionAuthError('Access denied: You do not have access to this prospect', 'FORBIDDEN');
    }

    const json = await response.json();
    const parsed = prospectOwnershipResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[ActionAuth] Invalid prospect ownership response shape:', parsed.error);
      throw new ActionAuthError('Invalid response from authorization service', 'FORBIDDEN');
    }

    if (!parsed.data.hasAccess) {
      throw new ActionAuthError('Access denied: You do not have access to this prospect', 'FORBIDDEN');
    }
  } catch (error) {
    if (error instanceof ActionAuthError) {
      throw error;
    }

    // Network error or backend unavailable - fail closed for security
    console.error(`[ActionAuth] Failed to verify prospect access: prospectId=${prospectId}, userId=${authContext.userId}`, error);
    throw new ActionAuthError('Unable to verify prospect access. Please try again.', 'FORBIDDEN');
  }
}

/**
 * Validate that the current user has access to a specific proposal.
 * Verifies ownership through the backend API.
 *
 * @param proposalId - The proposal ID to validate access for
 * @param authContext - The authentication context from requireActionAuth
 * @throws ActionAuthError with FORBIDDEN code if access is denied
 */
const proposalOwnershipResponseSchema = z.object({
  hasAccess: z.boolean(),
  prospectId: z.string().optional(),
});

export async function validateProposalOwnership(
  proposalId: string,
  authContext: ActionAuthContext
): Promise<void> {
  const backendUrl = env.OPEN_SEO_URL;

  // Get session token for backend authentication
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new ActionAuthError('Unable to obtain session token for backend authentication', 'UNAUTHORIZED');
  }

  try {
    const response = await fetch(
      `${backendUrl}/api/proposals/${proposalId}/verify-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          userId: authContext.userId,
          orgId: authContext.orgId
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new ActionAuthError('Proposal not found', 'NOT_FOUND');
      }
      throw new ActionAuthError('Access denied: You do not have access to this proposal', 'FORBIDDEN');
    }

    const json = await response.json();
    const parsed = proposalOwnershipResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.error('[ActionAuth] Invalid proposal ownership response shape:', parsed.error);
      throw new ActionAuthError('Invalid response from authorization service', 'FORBIDDEN');
    }

    if (!parsed.data.hasAccess) {
      throw new ActionAuthError('Access denied: You do not have access to this proposal', 'FORBIDDEN');
    }
  } catch (error) {
    if (error instanceof ActionAuthError) {
      throw error;
    }

    // Network error or backend unavailable - fail closed for security
    console.error(`[ActionAuth] Failed to verify proposal access: proposalId=${proposalId}, userId=${authContext.userId}`, error);
    throw new ActionAuthError('Unable to verify proposal access. Please try again.', 'FORBIDDEN');
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
