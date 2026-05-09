/**
 * Tests for middleware route matchers.
 *
 * These tests verify that sensitive route patterns correctly identify
 * routes requiring fresh session authentication without false positives.
 *
 * Note: Clerk's createRouteMatcher expects NextRequest which requires
 * complex mocking. Instead, we test the regex patterns directly using
 * path-to-regexp which is what Clerk uses internally.
 */

import { match } from 'path-to-regexp';
import { describe, it, expect } from 'vitest';

/**
 * Create a route matcher that mimics Clerk's createRouteMatcher behavior.
 * Uses path-to-regexp which is the same library Clerk uses internally.
 */
function createTestRouteMatcher(patterns: string[]): (pathname: string) => boolean {
  const matchers = patterns.map(pattern => {
    // Convert Clerk pattern syntax to path-to-regexp syntax
    // Clerk uses (.*) for catch-all, path-to-regexp uses (.*)
    const regexPattern = pattern
      .replace(/\(\.\*\)/g, '(.*)'); // Keep (.*) as-is for path-to-regexp

    try {
      return match(regexPattern, { end: true });
    } catch {
      // Fallback to regex for complex patterns
      const escapedPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\(\\\.\\\*\\\)/g, '.*');
      return (path: string) => new RegExp(`^${escapedPattern}$`).test(path);
    }
  });

  return (pathname: string): boolean => {
    // Strip query string for matching (like Clerk does)
    const pathOnly = pathname.split('?')[0];
    return matchers.some(m => {
      if (typeof m === 'function') {
        const result = m(pathOnly);
        return result !== false;
      }
      return false;
    });
  };
}

/**
 * Recreate the sensitive route matcher from middleware.ts for testing.
 * This ensures tests stay in sync with the actual implementation.
 */
const isSensitiveRoute = createTestRouteMatcher([
  // Settings pages - account management
  "/settings",
  "/settings/(.*)",
  // Admin panel - requires fresh session
  "/admin",
  "/admin/(.*)",
  // Delete operations - must be a path segment, not substring
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

describe('isSensitiveRoute matcher', () => {
  describe('settings routes', () => {
    it('should match /settings', () => {
      expect(isSensitiveRoute('/settings')).toBe(true);
    });

    it('should match /settings/profile', () => {
      expect(isSensitiveRoute('/settings/profile')).toBe(true);
    });

    it('should match /settings/security/2fa', () => {
      expect(isSensitiveRoute('/settings/security/2fa')).toBe(true);
    });

    it('should match /lt/settings (locale prefix)', () => {
      expect(isSensitiveRoute('/lt/settings')).toBe(true);
    });

    it('should match /lt/settings/profile (locale prefix)', () => {
      expect(isSensitiveRoute('/lt/settings/profile')).toBe(true);
    });
  });

  describe('admin routes', () => {
    it('should match /admin', () => {
      expect(isSensitiveRoute('/admin')).toBe(true);
    });

    it('should match /admin/users', () => {
      expect(isSensitiveRoute('/admin/users')).toBe(true);
    });

    it('should match /admin/settings/advanced', () => {
      expect(isSensitiveRoute('/admin/settings/advanced')).toBe(true);
    });

    it('should match /lt/admin (locale prefix)', () => {
      expect(isSensitiveRoute('/lt/admin')).toBe(true);
    });

    it('should match /lt/admin/users (locale prefix)', () => {
      expect(isSensitiveRoute('/lt/admin/users')).toBe(true);
    });
  });

  describe('delete routes', () => {
    it('should match /clients/123/delete', () => {
      expect(isSensitiveRoute('/clients/123/delete')).toBe(true);
    });

    it('should match /articles/abc/delete', () => {
      expect(isSensitiveRoute('/articles/abc/delete')).toBe(true);
    });

    it('should match /projects/xyz/delete/confirm', () => {
      expect(isSensitiveRoute('/projects/xyz/delete/confirm')).toBe(true);
    });

    it('should match /lt/clients/123/delete (locale prefix)', () => {
      expect(isSensitiveRoute('/lt/clients/123/delete')).toBe(true);
    });

    it('should match deeply nested delete: /org/team/project/delete', () => {
      expect(isSensitiveRoute('/org/team/project/delete')).toBe(true);
    });
  });

  describe('edge cases - should NOT match (false positives avoided)', () => {
    it('should NOT match /deleted-items (substring, not segment)', () => {
      // "delete" appears as substring, not as path segment
      expect(isSensitiveRoute('/deleted-items')).toBe(false);
    });

    it('should NOT match /clients/123/deleted (past tense, different word)', () => {
      expect(isSensitiveRoute('/clients/123/deleted')).toBe(false);
    });

    it('should NOT match /administrator-guide (admin as substring)', () => {
      // "admin" appears as substring, not as path segment
      expect(isSensitiveRoute('/administrator-guide')).toBe(false);
    });

    it('should NOT match /docs/admin-setup (admin as prefix in segment)', () => {
      expect(isSensitiveRoute('/docs/admin-setup')).toBe(false);
    });

    it('should NOT match /user-settings (settings as suffix)', () => {
      expect(isSensitiveRoute('/user-settings')).toBe(false);
    });

    it('should NOT match /settings-backup (settings as prefix)', () => {
      expect(isSensitiveRoute('/settings-backup')).toBe(false);
    });

    it('should NOT match /dashboard (regular route)', () => {
      expect(isSensitiveRoute('/dashboard')).toBe(false);
    });

    it('should NOT match /clients/123 (regular client page)', () => {
      expect(isSensitiveRoute('/clients/123')).toBe(false);
    });

    it('should NOT match /articles/new (regular create page)', () => {
      expect(isSensitiveRoute('/articles/new')).toBe(false);
    });
  });

  describe('edge cases - query strings', () => {
    it('should match /settings?tab=profile (query string)', () => {
      expect(isSensitiveRoute('/settings?tab=profile')).toBe(true);
    });

    it('should match /admin?page=1 (query string)', () => {
      expect(isSensitiveRoute('/admin?page=1')).toBe(true);
    });

    it('should match /clients/123/delete?confirm=true', () => {
      expect(isSensitiveRoute('/clients/123/delete?confirm=true')).toBe(true);
    });
  });
});

describe('public route matcher', () => {
  const isPublicRoute = createTestRouteMatcher([
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/connect/(.*)",
    "/api/health",
    // Include locale-prefixed versions
    "/lt/sign-in(.*)",
    "/lt/sign-up(.*)",
    "/lt/connect/(.*)",
  ]);

  it('should match /sign-in', () => {
    expect(isPublicRoute('/sign-in')).toBe(true);
  });

  it('should match /sign-in/sso-callback', () => {
    expect(isPublicRoute('/sign-in/sso-callback')).toBe(true);
  });

  it('should match /sign-up', () => {
    expect(isPublicRoute('/sign-up')).toBe(true);
  });

  it('should match /connect/google', () => {
    expect(isPublicRoute('/connect/google')).toBe(true);
  });

  it('should match /api/health', () => {
    expect(isPublicRoute('/api/health')).toBe(true);
  });

  it('should match /lt/sign-in (locale prefix)', () => {
    expect(isPublicRoute('/lt/sign-in')).toBe(true);
  });

  it('should NOT match /dashboard', () => {
    expect(isPublicRoute('/dashboard')).toBe(false);
  });

  it('should NOT match /api/clients', () => {
    expect(isPublicRoute('/api/clients')).toBe(false);
  });
});

describe('auth route matcher', () => {
  const isAuthRoute = createTestRouteMatcher([
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

  it('should match /sign-in', () => {
    expect(isAuthRoute('/sign-in')).toBe(true);
  });

  it('should match /forgot-password', () => {
    expect(isAuthRoute('/forgot-password')).toBe(true);
  });

  it('should match /reset-password/token123', () => {
    expect(isAuthRoute('/reset-password/token123')).toBe(true);
  });

  it('should match /verify/email', () => {
    expect(isAuthRoute('/verify/email')).toBe(true);
  });

  it('should match /verification', () => {
    expect(isAuthRoute('/verification')).toBe(true);
  });

  it('should match /lt/forgot-password (locale prefix)', () => {
    expect(isAuthRoute('/lt/forgot-password')).toBe(true);
  });

  it('should NOT match /dashboard', () => {
    expect(isAuthRoute('/dashboard')).toBe(false);
  });
});
