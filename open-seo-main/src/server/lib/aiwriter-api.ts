/**
 * Internal API client for fetching decrypted OAuth tokens from AI-Writer backend.
 *
 * SECURITY:
 * - CSI-001/CSI-002 FIX: Uses HMAC-SHA256 signed requests instead of plain API key
 * - X-Internal-Signature: HMAC signature of "{timestamp}.{body}"
 * - X-Internal-Timestamp: Unix timestamp in milliseconds
 * - Only use for service-to-service communication on internal network.
 */

import { createHmac } from "crypto";

// ENV-H04 FIX: Standardized to AI_WRITER_URL to match apps/web and docker-compose.vps.yml
// Supports legacy AI_WRITER_URL for backward compatibility during migration
const AI_WRITER_URL =
  process.env.AI_WRITER_URL || process.env.AI_WRITER_URL || "http://localhost:8000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Generate HMAC-SHA256 signature for internal API request.
 *
 * CSI-001/CSI-002 FIX: Implements HMAC signing protocol matching AI-Writer's
 * InternalAuthMiddleware expectations.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param body - Request body as string (empty string for GET requests)
 * @returns Hex-encoded HMAC-SHA256 signature
 */
function generateSignature(timestamp: number, body: string): string {
  if (!INTERNAL_API_KEY) {
    throw new Error("INTERNAL_API_KEY environment variable not set");
  }

  const message = `${timestamp}.${body}`;
  return createHmac("sha256", INTERNAL_API_KEY)
    .update(message)
    .digest("hex");
}

/**
 * Build headers with HMAC signature for internal API requests.
 *
 * @param body - Request body as string (empty string for GET requests)
 * @returns Headers object with signature and timestamp
 */
function buildSignedHeaders(body: string = ""): Record<string, string> {
  const timestamp = Date.now();
  const signature = generateSignature(timestamp, body);

  return {
    "X-Internal-Signature": signature,
    "X-Internal-Timestamp": timestamp.toString(),
    "X-Correlation-ID": `osm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

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

  // GET requests have empty body
  const signedHeaders = buildSignedHeaders("");

  const res = await fetchWithTimeout(
    `${AI_WRITER_URL}/internal/tokens/${clientId}/${provider}`,
    {
      headers: {
        ...signedHeaders,
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

  const body = JSON.stringify(update);
  const signedHeaders = buildSignedHeaders(body);

  const res = await fetchWithTimeout(
    `${AI_WRITER_URL}/internal/tokens/${clientId}/${provider}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...signedHeaders,
      },
      body,
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

  // POST with empty body
  const signedHeaders = buildSignedHeaders("");

  const res = await fetchWithTimeout(
    `${AI_WRITER_URL}/internal/tokens/${clientId}/${provider}/deactivate`,
    {
      method: "POST",
      headers: {
        ...signedHeaders,
      },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to deactivate token: ${res.status} ${res.statusText}`,
    );
  }
}
