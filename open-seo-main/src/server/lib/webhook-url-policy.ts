/**
 * Webhook URL validation to prevent SSRF attacks.
 * Security fix for: SSRF in webhook URLs (HIGH severity)
 */

import { AppError } from "@/server/lib/errors";

/**
 * Cloud metadata endpoints that must be blocked.
 * These endpoints can leak sensitive instance credentials.
 */
const BLOCKED_METADATA_HOSTS = new Set([
  "169.254.169.254", // AWS/Azure/GCP metadata
  "metadata.google.internal", // GCP metadata
  "metadata", // GCP shorthand
  "100.100.100.200", // Alibaba metadata
  "fd00:ec2::254", // AWS IPv6 metadata
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
 * Check if a hostname is a private IPv4 address.
 */
function isPrivateIpv4(host: string): boolean {
  const parts = normalizeHost(host)
    .split(".")
    .map((x) => Number(x));
  if (
    parts.length !== 4 ||
    parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)
  ) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGN
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
  if (a >= 224) return true; // Multicast and reserved
  return false;
}

/**
 * Parse IPv4 address from IPv6 mapped format.
 */
function parseMappedIpv4FromIpv6(host: string): string | null {
  const normalized = normalizeHost(host);
  if (!normalized.startsWith("::ffff:")) return null;

  const mapped = normalized.slice("::ffff:".length);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) {
    return mapped;
  }

  const segments = mapped.split(":").filter(Boolean);
  if (segments.length !== 2) return null;

  const high = Number.parseInt(segments[0], 16);
  const low = Number.parseInt(segments[1], 16);
  if (
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    high < 0 ||
    high > 0xffff ||
    low < 0 ||
    low > 0xffff
  ) {
    return null;
  }

  const a = (high >> 8) & 0xff;
  const b = high & 0xff;
  const c = (low >> 8) & 0xff;
  const d = low & 0xff;
  return `${a}.${b}.${c}.${d}`;
}

/**
 * Check if a hostname is a private IPv6 address.
 */
function isPrivateIpv6(host: string): boolean {
  const value = normalizeHost(host);
  if (value === "::1" || value === "::") return true; // Loopback and unspecified
  if (value.startsWith("fc") || value.startsWith("fd")) return true; // Unique local
  if (
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb")
  ) {
    return true; // Link-local
  }

  // Check IPv4-mapped IPv6 addresses
  const mappedIpv4 = parseMappedIpv4FromIpv6(value);
  if (mappedIpv4 && isPrivateIpv4(mappedIpv4)) {
    return true;
  }

  return false;
}

/**
 * Check if host is an IP literal (not a domain name).
 */
function isIpLiteral(host: string): boolean {
  const normalized = normalizeHost(host);
  return /^\d+\.\d+\.\d+\.\d+$/.test(normalized) || normalized.includes(":");
}

/**
 * Check if the hostname is blocked (private IP or blocked host).
 */
function isBlockedHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (host === "localhost") return true;
  if (BLOCKED_METADATA_HOSTS.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return true;
  }

  if (isIpLiteral(host)) {
    return isPrivateIpv4(host) || isPrivateIpv6(host);
  }

  return false;
}

/**
 * Resolve hostname to IP addresses using DNS-over-HTTPS.
 * Returns empty array if resolution fails (fail-closed handled by caller).
 */
async function resolveAddressRecords(
  hostname: string,
  type: "A" | "AAAA",
): Promise<string[]> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(2_500),
      },
    );

    if (!response.ok) return [];

    const body = (await response.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number; data?: string }>;
    };
    if (body.Status !== 0 || !Array.isArray(body.Answer)) return [];

    const expectedType = type === "A" ? 1 : 28;
    return body.Answer.filter(
      (answer) => answer.type === expectedType && typeof answer.data === "string",
    ).map((answer) => normalizeHost(answer.data!));
  } catch {
    return [];
  }
}

/**
 * Check if hostname resolves to blocked IP addresses.
 *
 * MED-03 FIX: Changed to fail-closed on DNS resolution errors.
 * This prevents SSRF bypasses where an attacker could cause DNS resolution
 * to fail (e.g., via DNS rebinding or timing attacks) to bypass the check.
 */
async function hostnameResolvesToBlockedAddress(hostname: string): Promise<boolean> {
  const host = normalizeHost(hostname);
  if (!host || isIpLiteral(host)) return false;

  try {
    const [v4, v6] = await Promise.all([
      resolveAddressRecords(host, "A"),
      resolveAddressRecords(host, "AAAA"),
    ]);

    const addresses = [...v4, ...v6];

    // MED-03 FIX: If DNS resolution returns no addresses, fail closed
    // An attacker could manipulate DNS to return empty results to bypass checks
    if (addresses.length === 0) {
      // Log this for monitoring - could indicate DNS issues or attack attempts
      console.warn(`[webhook-url-policy] DNS resolution returned no addresses for ${host}`);
      return true; // Fail closed: treat as blocked
    }

    return addresses.some(
      (address) => isPrivateIpv4(address) || isPrivateIpv6(address),
    );
  } catch (error) {
    // MED-03 FIX: Fail closed on resolution errors
    // DNS failures could be used to bypass SSRF protection
    console.warn(`[webhook-url-policy] DNS resolution failed for ${host}:`, error);
    return true; // Fail closed: treat as blocked
  }
}

/**
 * Validate a webhook URL to prevent SSRF attacks.
 *
 * @param url - The webhook URL to validate
 * @throws AppError if the URL is invalid or points to blocked addresses
 *
 * Checks:
 * 1. URL is well-formed
 * 2. Protocol is HTTPS (required in production)
 * 3. Host is not a private/internal IP
 * 4. Host is not a cloud metadata endpoint
 * 5. Hostname does not resolve to private IP (DNS rebinding protection)
 */
export async function validateWebhookUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid webhook URL format");
  }

  // Only allow HTTP(S) protocols
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("VALIDATION_ERROR", "Webhook URL must use HTTP or HTTPS");
  }

  // Require HTTPS in production
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new AppError("VALIDATION_ERROR", "Webhook URL must use HTTPS in production");
  }

  // Check for blocked hosts (private IPs, metadata endpoints, etc.)
  if (isBlockedHost(parsed.hostname)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Webhook URL cannot point to private/internal addresses",
    );
  }

  // DNS rebinding protection: check if hostname resolves to private IP
  if (await hostnameResolvesToBlockedAddress(parsed.hostname)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Webhook URL cannot resolve to private/internal addresses",
    );
  }
}

/**
 * Check if an IP address is private (for external use).
 */
export function isPrivateIP(ip: string): boolean {
  return isPrivateIpv4(ip) || isPrivateIpv6(ip);
}

/**
 * Normalize a URL for consistent handling.
 */
export function normalizeUrl(url: string): URL {
  return new URL(url);
}
