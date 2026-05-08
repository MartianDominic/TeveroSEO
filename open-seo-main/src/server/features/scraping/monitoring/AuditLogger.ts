/**
 * Audit Logger for Scraping Admin Actions
 * Phase 95-14: Security & Authentication
 *
 * Provides comprehensive audit logging for all admin operations:
 * - Buffered writes for non-critical actions (performance)
 * - Immediate persistence for critical actions (reliability)
 * - Redis pub/sub for real-time monitoring
 * - Alert integration for critical actions
 */

import { db } from "@/db";
import {
  scrapingAuditLogs,
  ACTION_SEVERITY_MAP,
  type ScrapingAuditAction,
  type ScrapingAuditSeverity,
} from "@/db/scraping-audit-schema";
import { redis } from "@/server/lib/redis";
import type { AdminContext } from "../middleware/adminAuth";

// =============================================================================
// Types
// =============================================================================

/**
 * Target of an admin action.
 */
export interface AuditTarget {
  /** Type of target (circuit, migration, cache, queue, domain) */
  type: string;
  /** Identifier of the target */
  id: string;
}

/**
 * Audit log entry for an admin action.
 */
export interface AuditEntry {
  /** Action performed */
  action: ScrapingAuditAction;
  /** Actor information (from AdminContext) */
  actor: {
    ip: string;
    userAgent?: string;
    apiKeyPrefix?: string;
  };
  /** Target of the action (optional) */
  target?: AuditTarget;
  /** Action parameters (optional) */
  parameters?: Record<string, unknown>;
  /** Result of the action */
  result: "success" | "failure";
  /** Error message if failed */
  errorMessage?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Internal audit entry with computed severity.
 */
interface InternalAuditEntry extends AuditEntry {
  severity: ScrapingAuditSeverity;
  timestamp: Date;
}

// =============================================================================
// AuditLogger Class
// =============================================================================

/**
 * Audit logger for scraping admin actions.
 *
 * Features:
 * - Buffered writes for info/warning actions
 * - Immediate persistence for critical actions
 * - Automatic flush on interval or buffer size
 * - Redis pub/sub for real-time dashboards
 * - Alert integration for critical actions
 *
 * @example
 * ```typescript
 * const auditLogger = getAuditLogger();
 *
 * await auditLogger.log({
 *   action: 'emergency_stop',
 *   actor: createAuditContext(req),
 *   result: 'success',
 *   durationMs: 150,
 * });
 * ```
 */
export class AuditLogger {
  private buffer: InternalAuditEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 5000;
  private isShuttingDown = false;

  constructor() {
    this.startFlushInterval();
  }

  /**
   * Log an admin action.
   * Critical actions are persisted immediately; others are buffered.
   */
  async log(entry: AuditEntry): Promise<void> {
    const severity = ACTION_SEVERITY_MAP[entry.action] ?? "info";
    const fullEntry: InternalAuditEntry = {
      ...entry,
      severity,
      timestamp: new Date(),
    };

    // Critical actions: persist immediately and alert
    if (severity === "critical") {
      await this.persistEntry(fullEntry);
      await this.alertOnCritical(fullEntry);
    } else {
      // Non-critical: buffer for batch write
      this.buffer.push(fullEntry);
      if (this.buffer.length >= this.BUFFER_SIZE) {
        await this.flush();
      }
    }

    // Publish to Redis for real-time monitoring (fire-and-forget)
    this.publishToRedis(fullEntry).catch(() => {
      // Redis publish failure is non-critical
    });
  }

  /**
   * Persist a single audit entry to the database.
   */
  private async persistEntry(entry: InternalAuditEntry): Promise<void> {
    try {
      await db.insert(scrapingAuditLogs).values({
        action: entry.action,
        severity: entry.severity,
        actorIp: entry.actor.ip,
        actorUserAgent: entry.actor.userAgent,
        actorApiKeyPrefix: entry.actor.apiKeyPrefix,
        targetType: entry.target?.type,
        targetId: entry.target?.id,
        parameters: entry.parameters,
        result: entry.result,
        errorMessage: entry.errorMessage,
        durationMs: entry.durationMs,
        createdAt: entry.timestamp,
      });
    } catch (error) {
      console.error("[AuditLogger] Failed to persist entry:", error);
      // Don't throw - audit logging should not break admin operations
    }
  }

  /**
   * Publish audit entry to Redis for real-time monitoring.
   */
  private async publishToRedis(entry: InternalAuditEntry): Promise<void> {
    try {
      await redis.publish(
        "scraping:audit",
        JSON.stringify({
          action: entry.action,
          severity: entry.severity,
          actor: entry.actor,
          target: entry.target,
          result: entry.result,
          timestamp: entry.timestamp.toISOString(),
        })
      );
    } catch {
      // Redis publish failure is non-critical - ignore
    }
  }

  /**
   * Fire alert for critical admin actions.
   */
  private async alertOnCritical(entry: InternalAuditEntry): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency
      const { AlertManager } = await import("./AlertManager");
      const alertManager = new AlertManager();

      // Use evaluate method with a metric snapshot that triggers the alert
      // This integrates with existing AlertManager infrastructure
      console.warn(
        `[AuditLogger] CRITICAL admin action: ${entry.action} by ${entry.actor.ip}` +
          (entry.result === "failure" ? ` - FAILED: ${entry.errorMessage}` : "")
      );

      // Fire alert via AlertManager channels if configured
      if (alertManager.hasChannel("slack")) {
        // Trigger alert evaluation with admin action metrics
        await alertManager.evaluate({
          "admin.critical_action": 1,
          "admin.action_type": entry.action as unknown as number,
        });
      }
    } catch (error) {
      // Alert failure should not break the audit log
      console.error("[AuditLogger] Failed to fire critical alert:", error);
    }
  }

  /**
   * Flush buffered entries to the database.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Batch insert for efficiency
    try {
      await db.insert(scrapingAuditLogs).values(
        entries.map((entry) => ({
          action: entry.action,
          severity: entry.severity,
          actorIp: entry.actor.ip,
          actorUserAgent: entry.actor.userAgent,
          actorApiKeyPrefix: entry.actor.apiKeyPrefix,
          targetType: entry.target?.type,
          targetId: entry.target?.id,
          parameters: entry.parameters,
          result: entry.result,
          errorMessage: entry.errorMessage,
          durationMs: entry.durationMs,
          createdAt: entry.timestamp,
        }))
      );
    } catch (error) {
      console.error(
        `[AuditLogger] Failed to flush ${entries.length} entries:`,
        error
      );
      // Put entries back in buffer for retry on next flush
      this.buffer = [...entries, ...this.buffer].slice(0, this.BUFFER_SIZE * 2);
    }
  }

  /**
   * Start the automatic flush interval.
   */
  private startFlushInterval(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.flush().catch((error) => {
          console.error("[AuditLogger] Flush interval error:", error);
        });
      }
    }, this.FLUSH_INTERVAL_MS);

    // Don't prevent process exit
    this.flushInterval.unref();
  }

  /**
   * Stop the automatic flush interval.
   */
  private stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Get buffer statistics.
   */
  getBufferStats(): { size: number; capacity: number } {
    return {
      size: this.buffer.length,
      capacity: this.BUFFER_SIZE,
    };
  }

  /**
   * Gracefully shutdown the audit logger.
   * Flushes remaining buffer and stops intervals.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopFlushInterval();
    await this.flush();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get the singleton AuditLogger instance.
 */
export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

/**
 * Shutdown the audit logger singleton.
 * Call during application shutdown.
 */
export async function shutdownAuditLogger(): Promise<void> {
  if (auditLoggerInstance) {
    await auditLoggerInstance.shutdown();
    auditLoggerInstance = null;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create audit actor context from Express request with AdminContext.
 *
 * @example
 * ```typescript
 * router.post('/emergency-stop', requireAdminAuth, async (req, res) => {
 *   const actor = createAuditContext(req);
 *   await auditLogger.log({
 *     action: 'emergency_stop',
 *     actor,
 *     result: 'success',
 *   });
 * });
 * ```
 */
export function createAuditContext(req: {
  adminContext?: AdminContext;
  ip?: string;
  socket?: { remoteAddress?: string };
  headers: Record<string, string | string[] | undefined>;
}): AuditEntry["actor"] {
  // Use AdminContext if available (from requireAdminAuth middleware)
  if (req.adminContext) {
    return {
      ip: req.adminContext.clientIp,
      userAgent: req.adminContext.userAgent,
      apiKeyPrefix: req.adminContext.apiKeyPrefix,
    };
  }

  // Fallback: extract from request directly
  const apiKey = req.headers["x-admin-api-key"] as string | undefined;
  return {
    ip: req.ip || req.socket?.remoteAddress || "unknown",
    userAgent: req.headers["user-agent"] as string | undefined,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) : undefined,
  };
}

/**
 * Wrap an async handler with audit logging.
 *
 * @example
 * ```typescript
 * router.post('/emergency-stop', requireAdminAuth, withAuditLog(
 *   'emergency_stop',
 *   async (req, res) => {
 *     await scrapingService.emergencyStop();
 *     return { success: true };
 *   }
 * ));
 * ```
 */
export function withAuditLog<T>(
  action: ScrapingAuditAction,
  handler: (req: any, res: any) => Promise<T>,
  options?: {
    getTarget?: (req: any) => AuditTarget | undefined;
    getParameters?: (req: any) => Record<string, unknown> | undefined;
  }
): (req: any, res: any) => Promise<void> {
  const auditLogger = getAuditLogger();

  return async (req, res) => {
    const startTime = Date.now();
    const actor = createAuditContext(req);
    const target = options?.getTarget?.(req);
    const parameters = options?.getParameters?.(req);

    try {
      const result = await handler(req, res);

      await auditLogger.log({
        action,
        actor,
        target,
        parameters,
        result: "success",
        durationMs: Date.now() - startTime,
      });

      if (!res.headersSent) {
        res.json(result);
      }
    } catch (error) {
      await auditLogger.log({
        action,
        actor,
        target,
        parameters,
        result: "failure",
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }
  };
}
