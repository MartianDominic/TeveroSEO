/**
 * Alert Thresholds for Scraping Infrastructure.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

/**
 * Queue depth alert thresholds.
 */
export interface QueueDepthThresholds {
  /** Warning threshold (jobs waiting) */
  warning: number;
  /** Critical threshold (jobs waiting) */
  critical: number;
}

/**
 * Alert thresholds configuration.
 */
export const ALERT_THRESHOLDS = {
  // Queue depth alerts
  queueDepth: {
    priority: {
      warning: 30, // >30 jobs waiting
      critical: 50, // >50 jobs waiting
    },
    standard: {
      warning: 200,
      critical: 500,
    },
    background: {
      warning: 1000,
      critical: 2000,
    },
  },

  // Processing rate alerts
  processingRate: {
    /** Processing rate too slow (jobs/sec when queue >100) */
    tooSlow: 5,
    /** Processing rate suspiciously fast */
    tooFast: 50,
  },

  // Blocked domains alerts
  blockedDomains: {
    /** Warning: many domains blocked */
    warning: 50,
    /** Critical: possible IP issue */
    critical: 200,
  },

  // Concurrency alerts
  concurrency: {
    /** High utilization sustained */
    highUtilization: 0.9,
    /** Low utilization (waste or issue) */
    lowUtilization: 0.1,
  },

  // Error rate alerts
  errorRate: {
    /** Warning: >5% failure rate */
    warning: 0.05,
    /** Critical: >15% failure rate */
    critical: 0.15,
  },

  // SLA breach alerts (jobs taking longer than expected)
  slaBreachPercent: {
    /** Warning: >10% of jobs breaching SLA */
    warning: 0.1,
    /** Critical: >25% of jobs breaching SLA */
    critical: 0.25,
  },

  // Cost alerts (daily)
  dailyCost: {
    /** Warning threshold in USD */
    warning: 50,
    /** Critical threshold in USD */
    critical: 100,
  },
} as const;

/**
 * Alert severity levels.
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Alert definition.
 */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: "queue" | "rate" | "domains" | "concurrency" | "errors" | "sla" | "cost";
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

/**
 * Check if a value exceeds warning threshold.
 */
export function isWarning(value: number, thresholds: { warning: number; critical: number }): boolean {
  return value >= thresholds.warning && value < thresholds.critical;
}

/**
 * Check if a value exceeds critical threshold.
 */
export function isCritical(value: number, thresholds: { warning: number; critical: number }): boolean {
  return value >= thresholds.critical;
}

/**
 * Get severity level for a value.
 */
export function getSeverity(
  value: number,
  thresholds: { warning: number; critical: number }
): AlertSeverity {
  if (isCritical(value, thresholds)) return "critical";
  if (isWarning(value, thresholds)) return "warning";
  return "info";
}
