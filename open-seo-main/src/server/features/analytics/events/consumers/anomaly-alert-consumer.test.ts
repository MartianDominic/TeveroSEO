/**
 * AnomalyAlertConsumer Unit Tests
 * Phase 96: Agency Analytics - Event Consumer Implementation (EC-002)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  classifyAnomalySeverity,
  calculateHealthScoreImpact,
  handleAnomalyDetected,
  type AnomalyDetectedEventPayload,
  type AnomalyType,
  type AlertSeverity,
} from './anomaly-alert-consumer';

// Mock database
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue(Promise.resolve()),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
  alerts: {},
  alertRules: {},
}));

// Mock NotificationService
vi.mock('@/server/features/portal/services/NotificationService', () => ({
  NotificationService: {
    queueNotification: vi.fn().mockResolvedValue({ id: 'mock-notif-id' }),
  },
}));

// Mock notification queue
vi.mock('@/server/queues/notificationQueue', () => ({
  getNotificationQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  }),
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

describe('AnomalyAlertConsumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('classifyAnomalySeverity', () => {
    describe('traffic_drop', () => {
      it('should classify > 50% drop as critical', () => {
        const severity = classifyAnomalySeverity('traffic_drop', -55);
        expect(severity).toBe('critical');
      });

      it('should classify 40-50% drop as high', () => {
        const severity = classifyAnomalySeverity('traffic_drop', -45);
        expect(severity).toBe('high');
      });

      it('should classify 30-40% drop as medium', () => {
        const severity = classifyAnomalySeverity('traffic_drop', -35);
        expect(severity).toBe('medium');
      });

      it('should classify < 30% drop as low', () => {
        const severity = classifyAnomalySeverity('traffic_drop', -20);
        expect(severity).toBe('low');
      });
    });

    describe('ranking_loss', () => {
      it('should classify 20+ position loss as critical', () => {
        const severity = classifyAnomalySeverity('ranking_loss', 0, {
          previousPosition: 5,
          currentPosition: 30, // 25 position loss
        });
        expect(severity).toBe('critical');
      });

      it('should classify 10-20 position loss as high', () => {
        const severity = classifyAnomalySeverity('ranking_loss', 0, {
          previousPosition: 5,
          currentPosition: 18, // 13 position loss
        });
        expect(severity).toBe('high');
      });

      it('should classify 5-10 position loss as medium', () => {
        const severity = classifyAnomalySeverity('ranking_loss', 0, {
          previousPosition: 5,
          currentPosition: 12, // 7 position loss
        });
        expect(severity).toBe('medium');
      });

      it('should classify < 5 position loss as low', () => {
        const severity = classifyAnomalySeverity('ranking_loss', 0, {
          previousPosition: 5,
          currentPosition: 8, // 3 position loss
        });
        expect(severity).toBe('low');
      });
    });

    describe('crawl_error_spike', () => {
      it('should classify 100%+ increase as critical', () => {
        const severity = classifyAnomalySeverity('crawl_error_spike', 150);
        expect(severity).toBe('critical');
      });

      it('should classify 50-100% increase as high', () => {
        const severity = classifyAnomalySeverity('crawl_error_spike', 75);
        expect(severity).toBe('high');
      });

      it('should classify 25-50% increase as medium', () => {
        const severity = classifyAnomalySeverity('crawl_error_spike', 35);
        expect(severity).toBe('medium');
      });

      it('should classify < 25% increase as low', () => {
        const severity = classifyAnomalySeverity('crawl_error_spike', 15);
        expect(severity).toBe('low');
      });
    });

    describe('cwv_degradation', () => {
      it('should classify 100%+ degradation as critical', () => {
        const severity = classifyAnomalySeverity('cwv_degradation', 120, {
          cwvMetric: 'LCP',
        });
        expect(severity).toBe('critical');
      });

      it('should classify 50-100% degradation as high', () => {
        const severity = classifyAnomalySeverity('cwv_degradation', 75, {
          cwvMetric: 'FID',
        });
        expect(severity).toBe('high');
      });
    });

    describe('impression_drop', () => {
      it('should classify 60%+ drop as critical', () => {
        const severity = classifyAnomalySeverity('impression_drop', -65);
        expect(severity).toBe('critical');
      });

      it('should classify 40-60% drop as high', () => {
        const severity = classifyAnomalySeverity('impression_drop', -50);
        expect(severity).toBe('high');
      });
    });

    describe('ctr_anomaly', () => {
      it('should classify 50%+ drop as critical', () => {
        const severity = classifyAnomalySeverity('ctr_anomaly', -55);
        expect(severity).toBe('critical');
      });

      it('should classify 30-50% drop as high', () => {
        const severity = classifyAnomalySeverity('ctr_anomaly', -40);
        expect(severity).toBe('high');
      });
    });
  });

  describe('calculateHealthScoreImpact', () => {
    it('should return -20 for critical severity', () => {
      expect(calculateHealthScoreImpact('critical')).toBe(-20);
    });

    it('should return -10 for high severity', () => {
      expect(calculateHealthScoreImpact('high')).toBe(-10);
    });

    it('should return -5 for medium severity', () => {
      expect(calculateHealthScoreImpact('medium')).toBe(-5);
    });

    it('should return -2 for low severity', () => {
      expect(calculateHealthScoreImpact('low')).toBe(-2);
    });
  });

  describe('handleAnomalyDetected', () => {
    it('should process critical traffic drop and send immediate notification', async () => {
      const { NotificationService } = await import('@/server/features/portal/services/NotificationService');

      const payload: AnomalyDetectedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        anomalyType: 'traffic_drop',
        subject: '/important-page',
        currentValue: 100,
        previousValue: 250,
        changePercent: -60, // Critical: > 50% drop
        metadata: {
          periodDays: 7,
          confidence: 'high',
        },
        timestamp: new Date(),
      };

      const result = await handleAnomalyDetected(payload);

      expect(result.severity).toBe('critical');
      expect(result.notificationSent).toBe(true);
      expect(result.batchedForDigest).toBe(false);
      expect(NotificationService.queueNotification).toHaveBeenCalled();
    });

    it('should batch low severity anomalies for digest', async () => {
      const payload: AnomalyDetectedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        anomalyType: 'traffic_drop',
        subject: '/minor-page',
        currentValue: 90,
        previousValue: 100,
        changePercent: -10, // Low: < 30% drop
        metadata: {
          periodDays: 7,
          confidence: 'medium',
        },
        timestamp: new Date(),
      };

      const result = await handleAnomalyDetected(payload);

      expect(result.severity).toBe('low');
      expect(result.batchedForDigest).toBe(true);
    });

    it('should handle ranking loss with keyword metadata', async () => {
      const payload: AnomalyDetectedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        anomalyType: 'ranking_loss',
        subject: '/product-page',
        currentValue: 25,
        previousValue: 3,
        changePercent: 733, // Position delta matters more
        metadata: {
          keyword: 'buy widgets online',
          previousPosition: 3,
          currentPosition: 25, // 22 position loss - critical
          confidence: 'high',
        },
        timestamp: new Date(),
      };

      const result = await handleAnomalyDetected(payload);

      expect(result.severity).toBe('critical'); // 22 positions >= 20
      expect(result.alertId).toBeDefined();
    });

    it('should handle crawl error spike', async () => {
      const payload: AnomalyDetectedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        anomalyType: 'crawl_error_spike',
        subject: 'https://example.com',
        currentValue: 150,
        previousValue: 50,
        changePercent: 200, // Critical: 100%+ increase
        metadata: {
          errorTypes: ['404', '500'],
          periodDays: 3,
        },
        timestamp: new Date(),
      };

      const result = await handleAnomalyDetected(payload);

      expect(result.severity).toBe('critical');
    });

    it('should handle CWV degradation', async () => {
      const payload: AnomalyDetectedEventPayload = {
        siteId: 'site-123',
        clientId: 'client-456',
        workspaceId: 'workspace-789',
        anomalyType: 'cwv_degradation',
        subject: '/slow-page',
        currentValue: 4500, // ms
        previousValue: 2000, // ms
        changePercent: 125, // Critical: 100%+ degradation
        metadata: {
          cwvMetric: 'LCP',
          confidence: 'high',
        },
        timestamp: new Date(),
      };

      const result = await handleAnomalyDetected(payload);

      expect(result.severity).toBe('critical');
    });
  });
});

describe('Severity edge cases', () => {
  it('should handle exact threshold values', () => {
    // Exactly at critical threshold
    expect(classifyAnomalySeverity('traffic_drop', -50)).toBe('critical');

    // Just above critical (less negative)
    expect(classifyAnomalySeverity('traffic_drop', -49)).toBe('high');
  });

  it('should handle zero change', () => {
    expect(classifyAnomalySeverity('traffic_drop', 0)).toBe('low');
  });

  it('should handle positive change for drop metrics', () => {
    // Traffic increased - not a problem
    expect(classifyAnomalySeverity('traffic_drop', 50)).toBe('low');
  });
});
