import "server-only";
import { auth } from "@clerk/nextjs/server";
import { getOpenSeoUrl, getAiWriterUrl } from "./env";
import {
  fetchWithTimeout,
  DEFAULT_TIMEOUT_MS,
  type FetchWithTimeoutOptions,
} from "./fetch-with-timeout";

const AI_WRITER_URL = getAiWriterUrl();
const OPEN_SEO_URL = getOpenSeoUrl();

/** Default server-side request timeout */
const SERVER_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;

/**
 * Sanitize backend error responses to prevent information leakage.
 * Only allows short, string error messages through.
 */
function sanitizeErrorBody(body: unknown): { error: string } {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === 'string' && error.length < 200) {
      // Only allow short, string error messages
      return { error };
    }
  }
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string' && detail.length < 200) {
      return { error: detail };
    }
  }
  return { error: 'An error occurred' };
}

export class FastApiError extends Error {
  public sanitizedBody: { error: string };

  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "FastApiError";
    // Sanitize body for safe client exposure
    this.sanitizedBody = sanitizeErrorBody(body);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ServerFetchInit extends RequestInit {
  /** Timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
}

async function request<T>(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  init?: ServerFetchInit,
): Promise<T> {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const { timeout = SERVER_TIMEOUT_MS, ...restInit } = init ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((restInit?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: restInit?.cache ?? "no-store",
    next: restInit?.next,
    timeout,
  } as FetchWithTimeoutOptions);
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new FastApiError(res.status, parsed, `${method} ${path} failed: ${res.status}`);
  }
  return parsed as T;
}

export const getFastApi = <T>(path: string, init?: ServerFetchInit) =>
  request<T>(AI_WRITER_URL, "GET", path, undefined, init);
export const postFastApi = <T>(path: string, body: unknown, init?: ServerFetchInit) =>
  request<T>(AI_WRITER_URL, "POST", path, body, init);
export const patchFastApi = <T>(path: string, body: unknown, init?: ServerFetchInit) =>
  request<T>(AI_WRITER_URL, "PATCH", path, body, init);
export const putFastApi = <T>(path: string, body: unknown, init?: ServerFetchInit) =>
  request<T>(AI_WRITER_URL, "PUT", path, body, init);
export const deleteFastApi = <T>(path: string, init?: ServerFetchInit) =>
  request<T>(AI_WRITER_URL, "DELETE", path, undefined, init);

export const getOpenSeo = <T>(path: string, init?: ServerFetchInit) =>
  request<T>(OPEN_SEO_URL, "GET", path, undefined, init);
export const postOpenSeo = <T>(path: string, body: unknown, init?: ServerFetchInit) =>
  request<T>(OPEN_SEO_URL, "POST", path, body, init);
export const putOpenSeo = <T>(path: string, body: unknown, init?: ServerFetchInit) =>
  request<T>(OPEN_SEO_URL, "PUT", path, body, init);
export const patchOpenSeo = <T>(path: string, body: unknown, init?: ServerFetchInit) =>
  request<T>(OPEN_SEO_URL, "PATCH", path, body, init);
export const deleteOpenSeo = <T>(path: string, init?: ServerFetchInit) =>
  request<T>(OPEN_SEO_URL, "DELETE", path, undefined, init);

/**
 * Pattern type returned by the open-seo patterns API.
 * Note: API returns 'patternType' not 'type' for the pattern classification.
 */
export interface OpenSeoPattern {
  id: string;
  workspaceId: string;
  patternType: string;
  status: string;
  title: string;
  description: string;
  affectedClientIds: string[];
  affectedCount: number;
  magnitude: number;
  direction: 'up' | 'down' | 'stable';
  confidence: number;
  startDate: string;
  endDate: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  dismissedAt: string | null;
}

/**
 * Fetch a pattern by ID from open-seo backend.
 * Used to validate workspace membership before modifying patterns.
 */
export async function getOpenSeoPattern(patternId: string): Promise<OpenSeoPattern> {
  return getOpenSeo<OpenSeoPattern>(`/api/patterns/${patternId}`);
}
