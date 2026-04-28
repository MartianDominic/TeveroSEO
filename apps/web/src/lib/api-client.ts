"use client";

import {
  fetchWithTimeout,
  TimeoutError,
  DEFAULT_TIMEOUT_MS,
} from "./fetch-with-timeout";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export { TimeoutError };

export interface RequestOptions {
  /** Timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;
  const url = path.startsWith("/") ? path : `/${path}`;

  const res = await fetchWithTimeout(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    timeout,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new ApiError(res.status, parsed, `${method} ${path} failed: ${res.status}`);
  }
  return parsed as T;
}

export const apiGet = <T>(path: string, options?: RequestOptions) =>
  request<T>("GET", path, undefined, options);
export const apiPost = <T>(path: string, body: unknown, options?: RequestOptions) =>
  request<T>("POST", path, body, options);
export const apiPatch = <T>(path: string, body: unknown, options?: RequestOptions) =>
  request<T>("PATCH", path, body, options);
export const apiPut = <T>(path: string, body: unknown, options?: RequestOptions) =>
  request<T>("PUT", path, body, options);
export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  request<T>("DELETE", path, undefined, options);
