"use server";

import { auth } from "@clerk/nextjs/server";

import type {
  OAuthConnection,
  InviteResponse,
  InviteValidation,
} from "@tevero/types";

import { getAiWriterUrl, getPublicAiWriterUrl } from "./env";
import {
  fetchWithTimeout,
  DEFAULT_TIMEOUT_MS,
} from "./fetch-with-timeout";

/** AI Writer URL from centralized env (validated at startup) */
const BACKEND_URL = getAiWriterUrl();

/** OAuth operations timeout - 30 seconds default */
const OAUTH_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/**
 * Get auth header for authenticated requests.
 */
async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetch all OAuth connections for a client.
 * Requires authentication.
 */
export async function fetchConnections(
  clientId: string
): Promise<OAuthConnection[]> {
  const headers = await authHeader();
  const res = await fetchWithTimeout(
    `${BACKEND_URL}/api/clients/${clientId}/connections`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      cache: "no-store",
      timeout: OAUTH_TIMEOUT_MS,
    }
  );

  if (!res.ok) {
    if (res.status === 404) {
      return [];
    }
    throw new Error(`Failed to fetch connections: ${res.status}`);
  }

  return res.json();
}

/**
 * Create a magic link invite for client self-authorization.
 * Requires authentication.
 */
export async function createInvite(
  clientId: string,
  scopes: string[] = []
): Promise<InviteResponse> {
  const headers = await authHeader();
  const res = await fetchWithTimeout(
    `${BACKEND_URL}/api/clients/${clientId}/invites`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ scopes_requested: scopes }),
      cache: "no-store",
      timeout: OAUTH_TIMEOUT_MS,
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to create invite: ${res.status}`);
  }

  return res.json();
}

/**
 * Revoke (soft-delete) an OAuth connection for a provider.
 * Requires authentication.
 */
export async function revokeConnection(
  clientId: string,
  provider: string
): Promise<boolean> {
  const headers = await authHeader();
  const res = await fetchWithTimeout(
    `${BACKEND_URL}/api/clients/${clientId}/connections/${provider}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      cache: "no-store",
      timeout: OAUTH_TIMEOUT_MS,
    }
  );

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to revoke connection: ${res.status}`);
  }

  return true;
}

/**
 * Validate a magic link invite token.
 * PUBLIC endpoint - no authentication required.
 */
export async function validateInvite(
  token: string
): Promise<InviteValidation | null> {
  const res = await fetchWithTimeout(
    `${BACKEND_URL}/api/invites/${token}/validate`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      timeout: OAUTH_TIMEOUT_MS,
    }
  );

  if (!res.ok) {
    return null;
  }

  return res.json();
}

/**
 * Get the Google OAuth start URL for the given token.
 * Used by the magic link page to redirect to Google OAuth.
 */
export function getGoogleOAuthUrl(token: string): string {
  // Use the public-facing URL for client redirects (validated at startup)
  const publicUrl = getPublicAiWriterUrl();
  return `${publicUrl}/api/auth/google/start?token=${encodeURIComponent(token)}`;
}
