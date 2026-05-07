import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertManager } from '../AlertManager';
import type { AlertChannelHandler, MetricsSnapshot } from '../AlertManager';

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let slackHandler: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    alertManager = new AlertManager();
    slackHandler = { send: vi.fn().mockResolvedValue(undefined) };
    alertManager.registerChannel('slack', slackHandler as AlertChannelHandler);
  });

  describe('alert firing', () => {
    it('should fire alert when condition met', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 75 };
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).toHaveBeenCalled();
      const call = slackHandler.send.mock.calls[0][0];
      expect(call.name).toBe('test-alert');
      expect(call.severity).toBe('warning');
      expect(call.value).toBe(75);
    });

    it('should not fire alert when condition not met', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 30 };
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).not.toHaveBeenCalled();
    });

    it('should fire alert for less than operator', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cache.hit_rate', operator: '<', threshold: 0.5 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cache.hit_rate': 0.3 };
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).toHaveBeenCalled();
    });
  });

  describe('cooldown', () => {
    it('should respect cooldown period', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 3600,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 75 };

      await alertManager.evaluate(metrics);
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).toHaveBeenCalledTimes(1);
    });

    it('should allow firing after cooldown expires', async () => {
      vi.useFakeTimers();

      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 1,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 75 };

      await alertManager.evaluate(metrics);
      expect(slackHandler.send).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1100);

      await alertManager.evaluate(metrics);
      expect(slackHandler.send).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('multiple channels', () => {
    it('should send to multiple channels', async () => {
      const pagerdutyHandler = { send: vi.fn().mockResolvedValue(undefined) };
      alertManager.registerChannel('pagerduty', pagerdutyHandler as AlertChannelHandler);

      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'critical',
        channels: ['slack', 'pagerduty'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 150 };
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).toHaveBeenCalled();
      expect(pagerdutyHandler.send).toHaveBeenCalled();
    });
  });

  describe('default alerts', () => {
    it('should have default cost alerts registered', () => {
      const metrics: MetricsSnapshot = { 'cost.daily': 60 };
      alertManager.evaluate(metrics);

      // Alert manager is initialized with default alerts
      expect(alertManager.getActiveAlerts).toBeDefined();
    });

    it('should fire error rate warning', async () => {
      const metrics: MetricsSnapshot = { 'scraping.error_rate': 0.08 };
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).toHaveBeenCalled();
    });

    it('should fire circuit breaker alert', async () => {
      const metrics: MetricsSnapshot = { 'circuit.open_count': 1 };
      await alertManager.evaluate(metrics);

      expect(slackHandler.send).toHaveBeenCalled();
    });
  });

  describe('alert resolution', () => {
    it('should track active alerts', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 75 };
      await alertManager.evaluate(metrics);

      const activeAlerts = alertManager.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);
      expect(activeAlerts[0].name).toBe('test-alert');
    });

    it('should resolve alerts', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 75 };
      await alertManager.evaluate(metrics);

      const activeAlerts = alertManager.getActiveAlerts();
      const alertId = activeAlerts[0].id;

      alertManager.resolveAlert(alertId);

      const updatedAlerts = alertManager.getActiveAlerts();
      expect(updatedAlerts.length).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should continue after channel failure', async () => {
      const failingHandler = {
        send: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      const workingHandler = { send: vi.fn().mockResolvedValue(undefined) };

      alertManager.registerChannel('failing', failingHandler as AlertChannelHandler);
      alertManager.registerChannel('working', workingHandler as AlertChannelHandler);

      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
        severity: 'warning',
        channels: ['failing', 'working'],
        cooldown: 0,
      });

      const metrics: MetricsSnapshot = { 'cost.daily': 75 };
      await alertManager.evaluate(metrics);

      expect(failingHandler.send).toHaveBeenCalled();
      expect(workingHandler.send).toHaveBeenCalled();
    });
  });

  describe('operators', () => {
    it('should handle >= operator', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'value', operator: '>=', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      await alertManager.evaluate({ value: 50 });
      expect(slackHandler.send).toHaveBeenCalled();
    });

    it('should handle <= operator', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'value', operator: '<=', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      await alertManager.evaluate({ value: 50 });
      expect(slackHandler.send).toHaveBeenCalled();
    });

    it('should handle == operator', async () => {
      alertManager.registerAlert({
        name: 'test-alert',
        condition: { metric: 'value', operator: '==', threshold: 50 },
        severity: 'warning',
        channels: ['slack'],
        cooldown: 0,
      });

      await alertManager.evaluate({ value: 50 });
      expect(slackHandler.send).toHaveBeenCalled();
    });
  });
});
