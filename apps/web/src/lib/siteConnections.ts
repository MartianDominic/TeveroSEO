/**
 * Site Connections Client Library
 * Client-side functions for CMS platform connections (WordPress, Shopify, etc.)
 */

export interface SiteConnection {
  id: string;
  clientId: string;
  platform: "wordpress" | "shopify" | "wix" | "squarespace" | "webflow" | "custom" | "pixel";
  siteUrl: string;
  displayName: string | null;
  hasCredentials: boolean;
  capabilities: string[] | null;
  status: "pending" | "active" | "error" | "disconnected";
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionResult {
  platform: SiteConnection["platform"];
  confidence: "high" | "medium" | "low";
  signals: Array<{
    type: string;
    platform: string;
    weight: number;
    found: string;
  }>;
}

export interface CreateConnectionInput {
  clientId: string;
  platform: SiteConnection["platform"];
  siteUrl: string;
  displayName?: string;
  credentials: Record<string, string>;
}

/**
 * Detect platform from domain.
 * Probes the domain for CMS fingerprints (WordPress REST API, Shopify CDN, etc.)
 */
export async function detectPlatform(domain: string): Promise<DetectionResult> {
  const res = await fetch("/api/site-connections/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to detect platform" }));
    throw new Error(error.error || "Failed to detect platform");
  }
  return res.json();
}

/**
 * Create a new site connection.
 * Credentials are encrypted server-side before storage.
 */
export async function createSiteConnection(input: CreateConnectionInput): Promise<SiteConnection> {
  const res = await fetch("/api/site-connections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to create connection" }));
    throw new Error(error.error || "Failed to create connection");
  }
  return res.json();
}

/**
 * Get all connections for a client.
 * Returns connections with hasCredentials flag (never exposes actual credentials).
 */
export async function getSiteConnections(clientId: string): Promise<SiteConnection[]> {
  const res = await fetch(`/api/site-connections?clientId=${encodeURIComponent(clientId)}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to fetch connections" }));
    throw new Error(error.error || "Failed to fetch connections");
  }
  return res.json();
}

/**
 * Verify a connection by testing credentials against the platform API.
 * Updates connection status to 'active' on success or 'error' on failure.
 */
export async function verifySiteConnection(connectionId: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/site-connections/${connectionId}/verify`, {
    method: "POST",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to verify connection" }));
    throw new Error(error.error || "Failed to verify connection");
  }
  return res.json();
}

/**
 * Delete a connection.
 * Removes the connection and associated encrypted credentials.
 */
export async function deleteSiteConnection(connectionId: string): Promise<void> {
  const res = await fetch(`/api/site-connections/${connectionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Failed to delete connection" }));
    throw new Error(error.error || "Failed to delete connection");
  }
}
