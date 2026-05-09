/**
 * TrendNotificationConsumer Unit Tests
 * Phase 96: Agency Analytics - Event Consumer Implementation (EC-001)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractSignificantChanges,
  handleTrendsComputed,
  type TrendsComputedEventPayload,
  type TrendNotificationConfig,
  type SignificantChange,
} from './trend-notification-consumer';
import type { TrendResult, TrendAnalysis } from '../../types';

// Mock NotificationService
vi.mock('@/server/features/portal/services/NotificationService', () => ({
  NotificationService: {
    queueNotification: vi.fn().mockResolvedValue({ id: 'mock-notif-id' }),
  },
}));

// Mock logger
vi.mock('@/server/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('TrendNotificationConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractSignificantChanges', () => {
    const defaultConfig: TrendNotificationConfig = {
      positionDeltaThreshold: 10,
      ctrAnomalyStdDev: 2,
      impressionSpikeThreshold: 0.5,
      minSignificantVolume: 100,
    };

    it('should detect position gains above threshold', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/page-1',
            previousPosition: 25,
            currentPosition: 10, // 15 position improvement
            currentImpressions: 500,
            previousImpressions: 400,
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('position_gain');
      expect(changes[0].severity).toBe('medium'); // 15 positions
      expect(changes[0].details.previousValue).toBe(25);
      expect(changes[0].details.currentValue).toBe(10);
    });

    it('should detect position losses above threshold', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/page-1',
            previousPosition: 5,
            currentPosition: 30, // 25 position loss
            currentImpressions: 500,
            previousImpressions: 400,
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('position_loss');
      expect(changes[0].severity).toBe('high'); // 25 positions >= 20
    });

    it('should detect impression spikes above threshold', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/page-1',
            previousImpressions: 1000,
            currentImpressions: 2000, // 100% increase
            previousPosition: 10,
            currentPosition: 10,
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      const impressionSpike = changes.find(c => c.changeType === 'impression_spike');
      expect(impressionSpike).toBeDefined();
      expect(impressionSpike?.severity).toBe('high'); // 100% >= 100%
    });

    it('should detect traffic decay', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/page-1',
            trend: 'decaying',
            changePercent: -45, // 45% click drop
            previousClicks: 100,
            currentClicks: 55,
            currentImpressions: 500,
            previousImpressions: 500,
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      const trafficDecay = changes.find(c => c.changeType === 'traffic_decay');
      expect(trafficDecay).toBeDefined();
      expect(trafficDecay?.severity).toBe('medium'); // -45% between -40% and -50%
    });

    it('should skip low-volume pages', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/low-volume',
            previousPosition: 50,
            currentPosition: 10, // Big improvement but low volume
            currentImpressions: 50,
            previousImpressions: 50,
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      expect(changes).toHaveLength(0);
    });

    it('should sort changes by severity (high first)', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/page-low',
            previousPosition: 20,
            currentPosition: 8, // 12 positions - low severity
            currentImpressions: 500,
            previousImpressions: 400,
          }),
          createTrendAnalysis({
            pageUrl: '/page-high',
            previousPosition: 5,
            currentPosition: 30, // 25 positions - high severity
            currentImpressions: 500,
            previousImpressions: 400,
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      expect(changes.length).toBeGreaterThanOrEqual(2);
      expect(changes[0].severity).toBe('high');
    });

    it('should include top queries in changes', () => {
      const result: TrendResult = {
        pages: [
          createTrendAnalysis({
            pageUrl: '/page-1',
            previousPosition: 30,
            currentPosition: 10,
            currentImpressions: 500,
            previousImpressions: 400,
            topQueries: ['query1', 'query2', 'query3', 'query4'],
          }),
        ],
        meta: createMeta(),
      };

      const changes = extractSignificantChanges(result, defaultConfig);

      expect(changes[0].topQueries).toEqual(['query1', 'query2', 'query3']);
    });
  });

  describe('handleTrendsComputed', () => {
    it('should return zero notifications when no significant changes', async () => {
      const payload: TrendsComputedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        result: {
          pages: [
            createTrendAnalysis({
              pageUrl: '/stable-page',
              trend: 'stable',
              changePercent: 5,
              previousPosition: 10,
              currentPosition: 10,
              currentImpressions: 500,
              previousImpressions: 500,
            }),
          ],
          meta: createMeta(),
        },
        timestamp: new Date(),
      };

      const result = await handleTrendsComputed(payload);

      expect(result.significantChanges).toBe(0);
      expect(result.notificationsSent).toBe(0);
    });

    it('should send notifications for significant changes', async () => {
      const { NotificationService } = await import('@/server/features/portal/services/NotificationService');

      const payload: TrendsComputedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        result: {
          pages: [
            createTrendAnalysis({
              pageUrl: '/improving-page',
              trend: 'growing',
              changePercent: 50,
              previousPosition: 30,
              currentPosition: 5, // 25 position gain - high severity
              currentImpressions: 1000,
              previousImpressions: 500,
              topQueries: ['main keyword'],
            }),
          ],
          meta: createMeta({ growingCount: 1 }),
        },
        timestamp: new Date(),
      };

      const result = await handleTrendsComputed(payload);

      expect(result.significantChanges).toBeGreaterThan(0);
      expect(NotificationService.queueNotification).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createTrendAnalysis(overrides: Partial<TrendAnalysis> = {}): TrendAnalysis {
  return {
    pageUrl: '/test-page',
    currentClicks: 100,
    previousClicks: 100,
    currentImpressions: 1000,
    previousImpressions: 1000,
    currentPosition: 10,
    previousPosition: 10,
    changePercent: 0,
    trend: 'stable',
    confidence: 'high',
    topQueries: [],
    ...overrides,
  };
}

function createMeta(overrides: Partial<TrendResult['meta']> = {}): TrendResult['meta'] {
  return {
    totalAnalyzed: 1,
    growingCount: 0,
    decayingCount: 0,
    stableCount: 1,
    periodDays: 21,
    threshold: 0.1,
    ...overrides,
  };
}
