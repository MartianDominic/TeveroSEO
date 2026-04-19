import "server-only";
import { auth } from "@clerk/nextjs/server";

const AI_WRITER_BACKEND_URL =
  process.env.AI_WRITER_BACKEND_URL ?? "http://ai-writer-backend:8000";
const OPEN_SEO_URL =
  process.env.OPEN_SEO_URL ?? "http://open-seo:3001";

export class FastApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "FastApiError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { getToken } = await auth();
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: init?.cache ?? "no-store",
    next: init?.next,
  });
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

export const getFastApi = <T>(path: string, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "GET", path, undefined, init);
export const postFastApi = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "POST", path, body, init);
export const patchFastApi = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "PATCH", path, body, init);
export const putFastApi = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "PUT", path, body, init);
export const deleteFastApi = <T>(path: string, init?: RequestInit) =>
  request<T>(AI_WRITER_BACKEND_URL, "DELETE", path, undefined, init);

export const getOpenSeo = <T>(path: string, init?: RequestInit) =>
  request<T>(OPEN_SEO_URL, "GET", path, undefined, init);
export const postOpenSeo = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(OPEN_SEO_URL, "POST", path, body, init);
export const putOpenSeo = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(OPEN_SEO_URL, "PUT", path, body, init);
export const patchOpenSeo = <T>(path: string, body: unknown, init?: RequestInit) =>
  request<T>(OPEN_SEO_URL, "PATCH", path, body, init);
export const deleteOpenSeo = <T>(path: string, init?: RequestInit) =>
  request<T>(OPEN_SEO_URL, "DELETE", path, undefined, init);
