"use client";

import { logger } from '@/lib/logger';

import {
  fetchWithTimeout,
  TimeoutError,
  DEFAULT_TIMEOUT_MS,
} from "./fetch-with-timeout";

import type { ZodLikeSchema } from "./utils/type-guards";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export { TimeoutError };

export interface RequestOptions<T = unknown> {
  /** Timeout in milliseconds. Defaults to 30 seconds. */
  timeout?: number;
  /** Optional Zod schema for response validation. If provided, validates the parsed JSON. */
  schema?: ZodLikeSchema<T>;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions<T> = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT_MS, schema } = options;
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
  } catch (error) {
    // JSON parse failed - use raw text as fallback
    // This is expected for non-JSON responses (plain text, HTML errors)
    logger.debug(`[api-client] JSON parse failed for ${method} ${path}, using raw text`, {
      error: error instanceof Error ? error.message : 'Unknown parse error',
    });
    parsed = text;
  }
  if (!res.ok) {
    throw new ApiError(res.status, parsed, `${method} ${path} failed: ${res.status}`);
  }

  // If schema provided, validate the parsed response
  if (schema) {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const errorMsg = `Response validation failed for ${method} ${path}: ${result.error.message}`;
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[api-client] ${errorMsg}`);
      }
      throw new ApiError(res.status, parsed, errorMsg);
    }
    return result.data;
  }

  // Without schema, return as T (maintains backward compatibility)
  // Note: Callers should prefer passing a schema for type safety
  return parsed as T;
}

export const apiGet = <T>(path: string, options?: RequestOptions<T>) =>
  request<T>("GET", path, undefined, options);
export const apiPost = <T>(path: string, body: unknown, options?: RequestOptions<T>) =>
  request<T>("POST", path, body, options);
export const apiPatch = <T>(path: string, body: unknown, options?: RequestOptions<T>) =>
  request<T>("PATCH", path, body, options);
export const apiPut = <T>(path: string, body: unknown, options?: RequestOptions<T>) =>
  request<T>("PUT", path, body, options);
export const apiDelete = <T>(path: string, options?: RequestOptions<T>) =>
  request<T>("DELETE", path, undefined, options);
