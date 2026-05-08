/**
 * IP Address Extraction Utility
 *
 * DUP-003 FIX: Consolidates multiple getClientIp implementations into one.
 *
 * Previously duplicated in:
 * - apps/web/src/lib/middleware/rate-limit.ts (getClientIpFromRequest)
 * - apps/web/src/lib/middleware/request-logger.ts (getClientIp)
 * - open-seo-main/src/server/features/scraping/middleware/adminAuth.ts (getClientIp)
 *
 * This is the canonical implementation for open-seo-main.
 * For apps/web, continue using getClientIpFromRequest from rate-limit.ts
 * (which has additional spoofing protection for the Next.js context).
 *
 * @module server/lib/ip-extractor
 */

// Generic Request type that works with both Express and Fetch API
interface GenericRequest {
  headers: {
    get?: (name: string) => string | null;
    [key: string]: unknown;
  };
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * Extract client IP from a request, handling proxies.
 *
 * Checks headers in order of preference:
 * 1. X-Forwarded-For (nginx, load balancers) - takes first IP
 * 2. X-Real-IP (nginx)
 * 3. CF-Connecting-IP (Cloudflare)
 * 4. Direct socket address (fallback)
 *
 * @param request - Request object (Fetch API or Express-like)
 * @returns Client IP address or 'unknown'
 *
 * @example
 * // Express/TanStack Start handler
 * function handler(req: Request) {
 *   const clientIp = getClientIp(req);
 *   logger.info('Request from', { clientIp });
 * }
 */
export function getClientIp(request: GenericRequest): string {
  // Support both Fetch API (request.headers.get) and Express-like (request.headers[key])
  const getHeader = (name: string): string | null => {
    if (typeof request.headers.get === "function") {
      return request.headers.get(name);
    }
    const value = request.headers[name.toLowerCase()] ?? request.headers[name];
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return typeof value === "string" ? value : null;
  };

  // 1. Check X-Forwarded-For header (nginx, load balancers)
  const forwardedFor = getHeader("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP (original client) from comma-separated list
    const firstIp = forwardedFor.split(",")[0];
    return firstIp?.trim() ?? "unknown";
  }

  // 2. Check X-Real-IP header (nginx)
  const realIp = getHeader("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // 3. Check CF-Connecting-IP (Cloudflare)
  const cfIp = getHeader("cf-connecting-ip");
  if (cfIp) {
    return cfIp.trim();
  }

  // 4. Fall back to socket remote address (Express/Node.js)
  if (request.ip) {
    return request.ip;
  }

  if (request.socket?.remoteAddress) {
    return request.socket.remoteAddress;
  }

  return "unknown";
}

/**
 * Extract client IP from a Web API Request (Fetch API style).
 *
 * Type-safe version for use with TanStack Start or other Fetch API contexts.
 *
 * @param request - Fetch API Request object
 * @returns Client IP address or 'unknown'
 */
export function getClientIpFromFetchRequest(request: Request): string {
  return getClientIp(request as unknown as GenericRequest);
}

/**
 * Check if an IP address is in a CIDR range.
 *
 * Useful for IP allowlists and blocklists.
 *
 * @param ip - IP address to check (IPv4)
 * @param cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns true if IP is in range
 *
 * @example
 * isIpInRange("192.168.1.100", "192.168.1.0/24") // true
 * isIpInRange("192.168.2.1", "192.168.1.0/24") // false
 */
export function isIpInRange(ip: string, cidr: string): boolean {
  const parts = cidr.split("/");
  const range = parts[0];
  const bits = parseInt(parts[1] ?? "32", 10);

  if (!range || isNaN(bits)) {
    return false;
  }

  const mask = ~(2 ** (32 - bits) - 1);

  const ipParts = ip.split(".");
  const rangeParts = range.split(".");

  if (ipParts.length !== 4 || rangeParts.length !== 4) {
    return false;
  }

  const ipNum = ipParts.reduce(
    (acc, octet) => (acc << 8) + parseInt(octet, 10),
    0
  );
  const rangeNum = rangeParts.reduce(
    (acc, octet) => (acc << 8) + parseInt(octet, 10),
    0
  );

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if an IP is in any of the given CIDR ranges.
 *
 * @param ip - IP address to check
 * @param cidrs - Array of CIDR notations
 * @returns true if IP is in any range
 */
export function isIpInAnyRange(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => isIpInRange(ip, cidr));
}
