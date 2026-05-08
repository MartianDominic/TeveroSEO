/**
 * SSRF (Server-Side Request Forgery) Protection
 *
 * Shared utility for validating URLs before making external requests.
 * Prevents attacks targeting internal infrastructure via URL manipulation.
 *
 * This is the CANONICAL source for SSRF validation in scraping operations.
 * Use this for synchronous validation when DNS resolution is not needed.
 *
 * For webhook validation with DNS rebinding protection, use:
 * - @/server/lib/webhook-url-policy.ts (async, includes DNS resolution)
 *
 * @module ssrf-validator
 */

import { AppError } from "@/server/lib/errors";

// =============================================================================
// Constants
// =============================================================================

/**
 * Cloud metadata endpoints that must be blocked.
 * These can leak sensitive instance credentials.
 */
const BLOCKED_METADATA_HOSTS = new Set([
  "169.254.169.254", // AWS/Azure/GCP metadata
  "metadata.google.internal", // GCP metadata
  "metadata", // GCP shorthand
  "100.100.100.200", // Alibaba metadata
]);

/**
 * Blocked host suffixes for internal/local networks.
 */
const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home.arpa",
  ".svc.cluster.local", // Kubernetes internal
];

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Normalize hostname for consistent comparison.
 */
function normalizeHost(hostname: string): string {
  let host = hostname.toLowerCase().trim();
  // Handle IPv6 bracket notation
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  // Remove zone identifier
  if (host.includes("%")) {
    host = host.split("%", 1)[0];
  }
  // Remove trailing dot
  if (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  return host;
}

/**
 * Check if hostname is a private IPv4 address.
 */
function isPrivateIpv4(host: string): {
  isPrivate: boolean;
  range?: string;
} {
  const normalized = normalizeHost(host);
  const parts = normalized.split(".").map((x) => Number(x));

  if (
    parts.length !== 4 ||
    parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)
  ) {
    return { isPrivate: false };
  }

  const [a, b] = parts;

  // 10.0.0.0/8 - Private
  if (a === 10) return { isPrivate: true, range: "10.x.x.x" };

  // 127.0.0.0/8 - Loopback
  if (a === 127) return { isPrivate: true, range: "127.x.x.x" };

  // 0.0.0.0/8 - Reserved
  if (a === 0) return { isPrivate: true, range: "0.x.x.x" };

  // 169.254.0.0/16 - Link-local (includes AWS metadata)
  if (a === 169 && b === 254) return { isPrivate: true, range: "169.254.x.x" };

  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31)
    return { isPrivate: true, range: "172.16-31.x.x" };

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return { isPrivate: true, range: "192.168.x.x" };

  // 100.64.0.0/10 - Carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127)
    return { isPrivate: true, range: "100.64-127.x.x" };

  // 198.18.0.0/15 - Benchmark testing
  if (a === 198 && (b === 18 || b === 19))
    return { isPrivate: true, range: "198.18-19.x.x" };

  // 224.0.0.0/4 and above - Multicast and reserved
  if (a >= 224) return { isPrivate: true, range: "multicast/reserved" };

  return { isPrivate: false };
}

/**
 * Check if hostname is a private IPv6 address.
 */
function isPrivateIpv6(host: string): {
  isPrivate: boolean;
  range?: string;
} {
  const normalized = normalizeHost(host);

  // Loopback (::1)
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") {
    return { isPrivate: true, range: "IPv6 loopback" };
  }

  // Unspecified (::)
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") {
    return { isPrivate: true, range: "IPv6 unspecified" };
  }

  // Unique local (fc00::/7)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return { isPrivate: true, range: "IPv6 unique local" };
  }

  // Link-local (fe80::/10)
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return { isPrivate: true, range: "IPv6 link-local" };
  }

  // Check IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) {
      const ipv4Check = isPrivateIpv4(mapped);
      if (ipv4Check.isPrivate) {
        return { isPrivate: true, range: `IPv6-mapped ${ipv4Check.range}` };
      }
    }
  }

  return { isPrivate: false };
}

/**
 * Check if hostname is blocked (private IP, metadata endpoint, or blocked suffix).
 */
function isBlockedHost(hostname: string): {
  isBlocked: boolean;
  reason?: string;
} {
  const host = normalizeHost(hostname);

  if (!host) {
    return { isBlocked: true, reason: "Empty hostname" };
  }

  // Localhost
  if (host === "localhost") {
    return { isBlocked: true, reason: "localhost" };
  }

  // Metadata endpoints
  if (BLOCKED_METADATA_HOSTS.has(host)) {
    return { isBlocked: true, reason: "cloud metadata endpoint" };
  }

  // Blocked suffixes
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) {
      return { isBlocked: true, reason: `blocked suffix ${suffix}` };
    }
  }

  // IPv4 check
  const ipv4Check = isPrivateIpv4(host);
  if (ipv4Check.isPrivate) {
    return { isBlocked: true, reason: `private IP (${ipv4Check.range})` };
  }

  // IPv6 check (including bracketed notation)
  const ipv6Check = isPrivateIpv6(host);
  if (ipv6Check.isPrivate) {
    return { isBlocked: true, reason: `private IP (${ipv6Check.range})` };
  }

  return { isBlocked: false };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Validation result returned by validateUrl().
 */
export interface SsrfValidationResult {
  valid: boolean;
  error?: string;
  hostname?: string;
  protocol?: string;
}

/**
 * Validate a URL for SSRF protection (synchronous).
 *
 * Returns a result object instead of throwing. Use this when you want
 * to handle validation failures gracefully.
 *
 * @param url - URL to validate
 * @returns Validation result with error message if invalid
 */
export function validateUrl(url: string): SsrfValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: `Invalid URL format: ${url}` };
  }

  // Only allow HTTP(S)
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Invalid URL scheme: ${parsed.protocol} - only http and https are allowed`,
      hostname: parsed.hostname,
      protocol: parsed.protocol,
    };
  }

  // Check for blocked hosts
  const blockCheck = isBlockedHost(parsed.hostname);
  if (blockCheck.isBlocked) {
    return {
      valid: false,
      error: `Cannot scrape ${blockCheck.reason}`,
      hostname: parsed.hostname,
      protocol: parsed.protocol,
    };
  }

  return {
    valid: true,
    hostname: parsed.hostname,
    protocol: parsed.protocol,
  };
}

/**
 * Validate a URL for SSRF protection (throws AppError on failure).
 *
 * Use this in request handlers where you want to return a proper error.
 *
 * @param url - URL to validate
 * @throws AppError if URL is not safe to scrape
 */
export function validateScrapableUrl(url: string): void {
  const result = validateUrl(url);
  if (!result.valid) {
    throw new AppError("VALIDATION_ERROR", result.error!);
  }
}

/**
 * Validate a URL for SSRF protection (throws plain Error on failure).
 *
 * Use this in internal code where AppError is not available.
 *
 * @param url - URL to validate
 * @throws Error if URL is not safe to scrape
 */
export function validateScrapableUrlSimple(url: string): void {
  const result = validateUrl(url);
  if (!result.valid) {
    throw new Error(result.error);
  }
}

/**
 * Check if an IP address is private (for external use).
 *
 * @param ip - IP address to check
 * @returns true if the IP is private
 */
export function isPrivateIP(ip: string): boolean {
  const ipv4 = isPrivateIpv4(ip);
  if (ipv4.isPrivate) return true;

  const ipv6 = isPrivateIpv6(ip);
  return ipv6.isPrivate;
}

// =============================================================================
// Deprecation Notice
// =============================================================================

/**
 * @deprecated Use validateScrapableUrl from @/server/lib/ssrf-validator instead.
 * This export exists for backward compatibility during migration.
 */
export { validateScrapableUrl as validateScrapableUrlLegacy };
