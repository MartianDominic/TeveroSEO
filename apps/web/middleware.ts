import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';

/**
 * next-intl middleware for locale routing.
 *
 * Behavior:
 * - Detects locale from Accept-Language header
 * - No prefix for English (default locale)
 * - /lt/ prefix for Lithuanian
 * - Redirects to appropriate locale based on detection
 */
export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  // - API routes (/api/*)
  // - tRPC routes (/trpc/*)
  // - Next.js internals (/_next/*)
  // - Vercel internals (/_vercel/*)
  // - Static files (files with a dot, e.g., favicon.ico)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
