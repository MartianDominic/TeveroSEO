/**
 * Tests for Next.js rate limiting middleware.
 */

import { NextRequest, NextResponse } from 'next/server';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'x-forwarded-for') return '192.168.1.100';
      return null;
    }),
  })),
}));

import {
  checkRateLimit,
  getRateLimitStatus,
  getClientIp,
  getClientIpFromRequest,
  withRateLimit,
  rateLimitAction,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitMapSize,
  RATE_LIMITS,
} from './rate-limit';

describe('rate-limit middleware', () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    clearAllRateLimits();
  });

  describe('checkRateLimit()', () => {
    it('should allow first request', async () => {
      const result = await checkRateLimit('test:client1', 10, 60000);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.limit).toBe(10);
    });

    it('should decrement remaining on each request', async () => {
      await checkRateLimit('test:client2', 10, 60000);
      await checkRateLimit('test:client2', 10, 60000);
      const result = await checkRateLimit('test:client2', 10, 60000);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 3
    });

    it('should reject when limit is reached', async () => {
      const identifier = 'test:limited';

      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(identifier, 10, 60000);
      }

      // 11th request should be rejected
      const result = await checkRateLimit(identifier, 10, 60000);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const identifier = 'test:expiring';

      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        await checkRateLimit(identifier, 10, 60000);
      }

      // Verify we're rate limited
      let result = await checkRateLimit(identifier, 10, 60000);
      expect(result.success).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(61000);

      // Should be allowed again
      result = await checkRateLimit(identifier, 10, 60000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should track different identifiers separately', async () => {
      // Exhaust limit for client1
      for (let i = 0; i < 10; i++) {
        await checkRateLimit('client1', 10, 60000);
      }

      // client2 should still be allowed
      const result = await checkRateLimit('client2', 10, 60000);
      expect(result.success).toBe(true);
    });
  });

  describe('getRateLimitStatus()', () => {
    it('should return status without incrementing', async () => {
      await checkRateLimit('test:status', 10, 60000);
      await checkRateLimit('test:status', 10, 60000);

      const status = await getRateLimitStatus('test:status', 10, 60000);

      expect(status.success).toBe(true);
      expect(status.remaining).toBe(8); // 10 - 2 (status doesn't increment)

      // Verify it didn't increment
      const status2 = await getRateLimitStatus('test:status', 10, 60000);
      expect(status2.remaining).toBe(8);
    });

    it('should return full limit for unknown identifier', async () => {
      const status = await getRateLimitStatus('unknown:id', 10, 60000);

      expect(status.success).toBe(true);
      expect(status.remaining).toBe(10);
    });
  });

  describe('getClientIp()', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      const ip = await getClientIp();
      expect(ip).toBe('192.168.1.100');
    });
  });

  describe('getClientIpFromRequest()', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' },
      });

      const ip = getClientIpFromRequest(req);
      expect(ip).toBe('10.0.0.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-real-ip': '172.16.0.1' },
      });

      const ip = getClientIpFromRequest(req);
      expect(ip).toBe('172.16.0.1');
    });

    it('should return unknown when no IP headers present', () => {
      const req = new NextRequest('http://localhost/api/test');

      const ip = getClientIpFromRequest(req);
      expect(ip).toBe('unknown');
    });
  });

  describe('withRateLimit()', () => {
    it('should allow requests under the limit', async () => {
      const handler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withRateLimit(handler, { limit: 10, windowMs: 60000 });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.50' },
      });

      const response = await wrappedHandler(req);

      expect(handler).toHaveBeenCalledWith(req);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('9');
    });

    it('should reject requests over the limit', async () => {
      const handler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withRateLimit(handler, { limit: 2, windowMs: 60000 });

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.60' },
      });

      // First two requests succeed
      await wrappedHandler(req);
      await wrappedHandler(req);

      // Third request should be rate limited
      const response = await wrappedHandler(req);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body.error).toBe('Too many requests');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });
  });

  describe('rateLimitAction()', () => {
    it('should allow actions under the limit', async () => {
      await expect(
        rateLimitAction('testAction', 'user123', { limit: 10, windowMs: 60000 })
      ).resolves.toBeUndefined();
    });

    it('should throw when limit is exceeded', async () => {
      const actionName = 'limitedAction';
      const userId = 'user456';

      // Exhaust the limit
      for (let i = 0; i < 5; i++) {
        await rateLimitAction(actionName, userId, { limit: 5, windowMs: 60000 });
      }

      // Next call should throw
      await expect(
        rateLimitAction(actionName, userId, { limit: 5, windowMs: 60000 })
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should use IP for anonymous users', async () => {
      await expect(
        rateLimitAction('anonAction', null, { limit: 10, windowMs: 60000 })
      ).resolves.toBeUndefined();
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have correct AUTH configuration', () => {
      expect(RATE_LIMITS.AUTH).toEqual({
        limit: 10,
        windowMs: 60000,
      });
    });

    it('should have correct API configuration', () => {
      expect(RATE_LIMITS.API).toEqual({
        limit: 100,
        windowMs: 60000,
      });
    });

    it('should have correct HEAVY configuration', () => {
      expect(RATE_LIMITS.HEAVY).toEqual({
        limit: 20,
        windowMs: 60000,
      });
    });

    it('should have correct PASSWORD_RESET configuration', () => {
      expect(RATE_LIMITS.PASSWORD_RESET).toEqual({
        limit: 3,
        windowMs: 300000,
      });
    });
  });

  describe('resetRateLimit()', () => {
    it('should reset rate limit for identifier', async () => {
      const identifier = 'test:reset';

      // Make some requests
      await checkRateLimit(identifier, 10, 60000);
      await checkRateLimit(identifier, 10, 60000);

      // Reset
      resetRateLimit(identifier);

      // Should be back to full limit
      const result = await checkRateLimit(identifier, 10, 60000);
      expect(result.remaining).toBe(9);
    });
  });

  describe('clearAllRateLimits()', () => {
    it('should clear all rate limits', async () => {
      await checkRateLimit('client1', 10, 60000);
      await checkRateLimit('client2', 10, 60000);

      expect(getRateLimitMapSize()).toBe(2);

      clearAllRateLimits();

      expect(getRateLimitMapSize()).toBe(0);
    });
  });
});
