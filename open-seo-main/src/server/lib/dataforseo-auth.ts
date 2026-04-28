/**
 * DataForSEO Authentication Module
 *
 * Provides a single source of truth for DataForSEO API credentials.
 * All DataForSEO API clients should use this module for authentication.
 *
 * Credential Format:
 * - DATAFORSEO_API_KEY: base64-encoded "login:password"
 * - Generate with: echo -n "login:password" | base64
 *
 * This module replaces the previous dual credential pattern (LOGIN/PASSWORD vs API_KEY).
 */

import { getRequiredEnvValueSync } from "@/server/lib/runtime-env";

/**
 * Get the DataForSEO API key from environment.
 * The key is expected to be base64-encoded "login:password".
 *
 * @throws Error if DATAFORSEO_API_KEY is not set
 */
export function getDataForSEOApiKey(): string {
  return getRequiredEnvValueSync("DATAFORSEO_API_KEY");
}

/**
 * Get the Authorization header value for DataForSEO API requests.
 * Returns the full header value: "Basic <base64-encoded-credentials>"
 *
 * @throws Error if DATAFORSEO_API_KEY is not set
 */
export function getDataForSEOAuthHeader(): string {
  const apiKey = getDataForSEOApiKey();
  return `Basic ${apiKey}`;
}

/**
 * Get headers object with DataForSEO authorization.
 * Convenience function for fetch requests.
 *
 * @throws Error if DATAFORSEO_API_KEY is not set
 */
export function getDataForSEOHeaders(): Record<string, string> {
  return {
    Authorization: getDataForSEOAuthHeader(),
    "Content-Type": "application/json",
  };
}

/**
 * Create an authenticated fetch function for DataForSEO API calls.
 * This is the recommended pattern for new code.
 *
 * @throws Error if DATAFORSEO_API_KEY is not set (at call time, not creation time)
 */
export function createDataForSEOFetch() {
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", getDataForSEOAuthHeader());
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, {
      ...init,
      headers,
    });
  };
}

/**
 * Check if DataForSEO credentials are configured.
 * Useful for graceful degradation when credentials are optional.
 */
export function hasDataForSEOCredentials(): boolean {
  try {
    getDataForSEOApiKey();
    return true;
  } catch {
    return false;
  }
}
