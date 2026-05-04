import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { routing } from './src/i18n/routing';
import {
  checkAuthRateLimit,
  getAuthOperationType,
  createRateLimitHeaders,
} from "./src/lib/rate-limit/auth-limiter";

/**
 * SEC-03: Generate a cryptographic nonce for CSP
 * Used to allow inline scripts while maintaining CSP protection.
 */
function generateNonce(): string {
  // Use crypto.getRandomValues for cryptographically secure random bytes
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convert to base64 for the nonce value
  return Buffer.from(array).toString('base64');
}

/**
 * Build Content-Security-Policy header with nonce.
 * This CSP allows:
 * - Scripts only from same origin or with valid nonce
 * - Styles from same origin, Clerk, and unsafe-inline (required for some UI libs)
 * - Images from same origin and data URIs
 * - Fonts from same origin
 * - Connect to same origin, Clerk APIs, and backend services
 */
function buildCSPHeader(nonce: string): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev`,
    `img-src 'self' data: blob: https://*.clerk.accounts.dev https://img.clerk.com`,
    `font-src 'self'`,
    `connect-src 'self' https://*.clerk.accounts.dev https://clerk.tevero.io wss://*.clerk.accounts.dev`,
    `frame-src 'self' https://*.clerk.accounts.dev`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ];

  return directives.join('; ');
}

/**
 * Apply CSP headers and nonce to a response.
 * The nonce is passed via x-nonce header for use in _document or layout.
 */
function applyCSPHeaders(response: NextResponse, nonce: string): NextResponse {
  const csp = buildCSPHeader(nonce);

  // Set CSP header
  response.headers.set('Content-Security-Policy', csp);

  // Pass nonce to the app via header (used in layout.tsx to inject into scripts)
  response.headers.set('x-nonce', nonce);

  // Additional security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

/**
 * HIGH-UX-02: Help and support link redirects
 * Maps internal help/support paths to external documentation.
 */
const HELP_REDIRECTS: Record<string, string> = {
  '/help': 'https://docs.tevero.io',
  '/support': 'https://docs.tevero.io/support',
  '/help/getting-started': 'https://docs.tevero.io/getting-started',
  '/help/api': 'https://docs.tevero.io/api',
  '/help/faq': 'https://docs.tevero.io/faq',
};

/**
 * Check if pathname matches a help redirect and return the destination URL.
 */
function getHelpRedirect(pathname: string): string | null {
  // Exact match first
  if (pathname in HELP_REDIRECTS) {
    return HELP_REDIRECTS[pathname];
  }

  // Check for locale-prefixed paths (e.g., /lt/help)
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/help.*|\/support.*)$/);
  if (localeMatch) {
    const subpath = localeMatch[2];
    if (subpath in HELP_REDIRECTS) {
      return HELP_REDIRECTS[subpath];
    }
  }

  // Wildcard: any /help/* path not explicitly mapped goes to docs root
  if (pathname.startsWith('/help/') || pathname.match(/^\/[a-z]{2}\/help\//)) {
    return 'https://docs.tevero.io';
  }

  return null;
}

/**
 * Merged middleware combining next-intl locale routing with Clerk authentication.
 *
 * Order of operations:
 * 1. Rate limit authentication routes
 * 2. Run next-intl for locale detection and routing
 * 3. Check Clerk auth for protected routes
 * 4. Check session freshness for sensitive routes
 *
 * ## API Route Authentication Strategy
 *
 * API routes (/api/*, /trpc/*) are excluded from this middleware via the `matcher`
 * config. They use route-level authentication instead:
 *
 * - `requireAuth()` - Validates Clerk session, returns AuthContext with userId
 * - `requireClientAccess(clientId)` - Additionally verifies client ownership
 * - `withAuth(handler)` - Wrapper that handles auth errors automatically
 * - `withClientAuth(extractor, handler)` - Wrapper with client access verification
 *
 * This separation ensures:
 * 1. API routes can return JSON error responses (not redirects)
 * 2. Fine-grained rate limiting per endpoint type
 * 3. Custom CSRF protection for state-changing operations
 * 4. Explicit auth context in handler type signatures
 *
 * @see apps/web/src/lib/auth/api-auth.ts for API route authentication utilities
 */

const intlMiddleware = createIntlMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/connect/(.*)",
  "/api/health",
  // Include locale-prefixed versions
  "/lt/sign-in(.*)",
  "/lt/sign-up(.*)",
  "/lt/connect/(.*)",
]);

// Auth routes that need rate limiting
const isAuthRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/reset-password(.*)",
  "/verify(.*)",
  "/verification(.*)",
  // Include locale-prefixed versions
  "/lt/sign-in(.*)",
  "/lt/sign-up(.*)",
  "/lt/forgot-password(.*)",
  "/lt/reset-password(.*)",
  "/lt/verify(.*)",
  "/lt/verification(.*)",
]);

/**
 * Sensitive routes require fresh sessions (re-auth after 24 hours).
 *
 * Pattern Design Notes:
 * - Use explicit path segments to avoid false positives (e.g., "/deleted-items" matching "/delete")
 * - Admin routes use word boundary matching via explicit segment patterns
 * - Delete operations require "/delete" as a distinct path segment, not substring
 *
 * Edge Cases Handled:
 * - "/settings" and "/settings/..." - user account settings
 * - "/admin" and "/admin/..." - admin panel access
 * - "/clients/123/delete" - delete confirmation pages (segment-based)
 * - "/lt/..." - Lithuanian locale prefix variants
 *
 * NOT matched (by design):
 * - "/deleted-items" - contains "delete" as substring, not segment
 * - "/administrator-guide" - contains "admin" as substring, not segment
 */
const isSensitiveRoute = createRouteMatcher([
  // Settings pages - account management
  "/settings",
  "/settings/(.*)",
  // Admin panel - requires fresh session
  "/admin",
  "/admin/(.*)",
  // Delete operations - must be a path segment, not substring
  // Pattern: any path ending in /delete or /delete/...
  "(.*)/delete",
  "(.*)/delete/(.*)",
  // Include locale-prefixed versions (Lithuanian)
  "/lt/settings",
  "/lt/settings/(.*)",
  "/lt/admin",
  "/lt/admin/(.*)",
  "/lt/(.*)/delete",
  "/lt/(.*)/delete/(.*)",
]);

// Maximum session age for sensitive operations (24 hours)
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

export default clerkMiddleware(async (auth, req) => {
  // SEC-03: Generate CSP nonce for this request
  const nonce = generateNonce();

  // HIGH-UX-02: Handle help/support redirects before any other processing
  const helpRedirect = getHelpRedirect(req.nextUrl.pathname);
  if (helpRedirect) {
    return NextResponse.redirect(helpRedirect);
  }

  // Rate limit authentication routes BEFORE any other processing
  if (isAuthRoute(req)) {
    const authType = getAuthOperationType(req.nextUrl.pathname);
    const rateLimitResult = await checkAuthRateLimit(req, authType);

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      const headers = createRateLimitHeaders(rateLimitResult);

      return new NextResponse(
        JSON.stringify({
          error: "Too many authentication attempts",
          message: `Rate limit exceeded. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": headers.get("X-RateLimit-Limit") || "",
            "X-RateLimit-Remaining": headers.get("X-RateLimit-Remaining") || "",
            "X-RateLimit-Reset": headers.get("X-RateLimit-Reset") || "",
            "Retry-After": headers.get("Retry-After") || "",
          },
        }
      );
    }
  }

  // Run next-intl middleware for locale handling
  // This handles locale detection and URL rewriting
  const intlResponse = intlMiddleware(req) as NextResponse | Response;

  // Convert to NextResponse if needed and apply CSP headers
  let response: NextResponse;
  if (intlResponse instanceof NextResponse) {
    response = intlResponse;
  } else {
    // intlResponse is a Response, copy its headers
    const headers = new Headers(intlResponse.headers);
    response = NextResponse.next({ headers });
  }

  // Apply CSP headers to all page responses
  applyCSPHeaders(response, nonce);

  // For public routes, return with CSP headers applied
  if (isPublicRoute(req)) {
    return response;
  }

  const authObj = await auth();
  const { userId, sessionClaims } = authObj;

  // Require authentication for protected routes
  if (!userId) {
    return authObj.redirectToSignIn();
  }

  // Check session freshness for sensitive operations
  if (sessionClaims && isSensitiveRoute(req)) {
    // sessionClaims.iat is the "issued at" timestamp in seconds (JWT standard)
    const sessionIssuedAt = sessionClaims.iat
      ? (sessionClaims.iat as number) * 1000
      : 0;
    const sessionAge = Date.now() - sessionIssuedAt;

    if (sessionAge > MAX_SESSION_AGE_MS) {
      // Session too old for sensitive operations - require re-authentication
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
      signInUrl.searchParams.set("reason", "session_expired");
      return Response.redirect(signInUrl);
    }
  }

  // Return the response with CSP headers for authenticated users
  return response;
});

export const config = {
  // Match all pathnames except for:
  // - API routes (/api/*)
  // - tRPC routes (/trpc/*)
  // - Next.js internals (/_next/*)
  // - Vercel internals (/_vercel/*)
  // - Static files (files with a dot, e.g., favicon.ico)
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)', '/'],
};
