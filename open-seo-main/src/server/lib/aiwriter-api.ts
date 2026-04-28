/**
 * Internal API client for fetching decrypted OAuth tokens from AI-Writer backend.
 *
 * SECURITY: This client sends X-Internal-Api-Key header for authentication.
 * Only use for service-to-service communication on internal network.
 */

const AIWRITER_INTERNAL_URL =
  process.env.AIWRITER_INTERNAL_URL || "http://localhost:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const FETCH_TIMEOUT_MS = 30000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string | null;
  token_expiry: string | null;
  scopes: string[];
  gsc_site_url: string | null;
  ga4_property_id: string | null;
}

export interface TokenUpdateRequest {
  access_token: string;
  refresh_token?: string;
  token_expiry?: string;
}

export async function getClientToken(
  clientId: string,
  provider: string,
): Promise<TokenResponse> {
  if (!INTERNAL_API_KEY) {
    throw new Error("INTERNAL_API_KEY environment variable not set");
  }

  const res = await fetchWithTimeout(
    `${AIWRITER_INTERNAL_URL}/internal/tokens/${clientId}/${provider}`,
    {
      headers: {
        "X-Internal-Api-Key": INTERNAL_API_KEY,
      },
    },
  );

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`No active ${provider} token for client ${clientId}`);
    }
    throw new Error(`Failed to fetch token: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function updateClientToken(
  clientId: string,
  provider: string,
  update: TokenUpdateRequest,
): Promise<void> {
  if (!INTERNAL_API_KEY) {
    throw new Error("INTERNAL_API_KEY environment variable not set");
  }

  const res = await fetchWithTimeout(
    `${AIWRITER_INTERNAL_URL}/internal/tokens/${clientId}/${provider}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": INTERNAL_API_KEY,
      },
      body: JSON.stringify(update),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to update token: ${res.status} ${res.statusText}`);
  }
}

export async function markTokenInactive(
  clientId: string,
  provider: string,
): Promise<void> {
  if (!INTERNAL_API_KEY) {
    throw new Error("INTERNAL_API_KEY environment variable not set");
  }

  const res = await fetchWithTimeout(
    `${AIWRITER_INTERNAL_URL}/internal/tokens/${clientId}/${provider}/deactivate`,
    {
      method: "POST",
      headers: {
        "X-Internal-Api-Key": INTERNAL_API_KEY,
      },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to deactivate token: ${res.status} ${res.statusText}`,
    );
  }
}
