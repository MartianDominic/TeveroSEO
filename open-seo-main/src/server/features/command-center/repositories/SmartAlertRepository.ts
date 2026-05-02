/**
 * SmartAlertRepository - Data access for smart alerts
 * Phase 62-07: Smart Alert Detection
 *
 * Provides:
 * - findByWorkspace: Get all alerts for a workspace
 * - findActiveByType: Check for existing active alert of a specific type
 * - create: Create a new alert
 * - dismiss: Mark an alert as dismissed by a user
 * - resolve: Auto-resolve an alert when condition clears
 * - expireOld: Resolve alerts past their expiration date
 */
import { eq, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  db,
  smartAlerts,
  type SmartAlertSelect,
  type SmartAlertInsert,
} from "@/db";
import { createLogger } from "@/server/lib/logger";

// Type for the Drizzle database client
type DrizzleClient = typeof db;

const log = createLogger({ module: "SmartAlertRepository" });

/**
 * Interface for the repository - enables mocking in tests.
 */
export interface SmartAlertRepositoryInterface {
  findByWorkspace(
    workspaceId: string,
    activeOnly?: boolean
  ): Promise<SmartAlertSelect[]>;
  findActiveByType(
    workspaceId: string,
    alertType: string
  ): Promise<SmartAlertSelect | null>;
  create(data: SmartAlertInsert): Promise<SmartAlertSelect>;
  dismiss(id: string, userId: string): Promise<void>;
  resolve(id: string): Promise<void>;
  expireOld(): Promise<number>;
}

/**
 * Repository for smart_alerts table operations.
 */
export class SmartAlertRepository implements SmartAlertRepositoryInterface {
  constructor(private readonly dbClient: DrizzleClient = db) {}

  /**
   * Get all alerts for a workspace.
   * @param workspaceId - The workspace to get alerts for
   * @param activeOnly - If true, only return non-dismissed, non-resolved alerts
   */
  async findByWorkspace(
    workspaceId: string,
    activeOnly = false
  ): Promise<SmartAlertSelect[]> {
    if (activeOnly) {
      return this.dbClient.query.smartAlerts.findMany({
        where: and(
          eq(smartAlerts.workspaceId, workspaceId),
          eq(smartAlerts.isDismissed, false),
          isNull(smartAlerts.resolvedAt)
        ),
        orderBy: (alerts, { desc }) => [desc(alerts.createdAt)],
      });
    }

    return this.dbClient.query.smartAlerts.findMany({
      where: eq(smartAlerts.workspaceId, workspaceId),
      orderBy: (alerts, { desc }) => [desc(alerts.createdAt)],
    });
  }

  /**
   * Find an active (non-dismissed, non-resolved) alert of a specific type.
   * Used to prevent duplicate alerts.
   */
  async findActiveByType(
    workspaceId: string,
    alertType: string
  ): Promise<SmartAlertSelect | null> {
    const result = await this.dbClient.query.smartAlerts.findFirst({
      where: and(
        eq(smartAlerts.workspaceId, workspaceId),
        eq(smartAlerts.alertType, alertType),
        eq(smartAlerts.isDismissed, false),
        isNull(smartAlerts.resolvedAt)
      ),
    });

    return result ?? null;
  }

  /**
   * Create a new alert.
   */
  async create(data: SmartAlertInsert): Promise<SmartAlertSelect> {
    const id = data.id ?? nanoid();

    const [created] = await this.dbClient
      .insert(smartAlerts)
      .values({
        ...data,
        id,
      })
      .returning();

    log.info("Created smart alert", {
      id,
      workspaceId: data.workspaceId,
      alertType: data.alertType,
      severity: data.severity,
    });

    return created;
  }

  /**
   * Dismiss an alert (user action).
   */
  async dismiss(id: string, userId: string): Promise<void> {
    await this.dbClient
      .update(smartAlerts)
      .set({
        isDismissed: true,
        dismissedBy: userId,
        dismissedAt: new Date(),
      })
      .where(eq(smartAlerts.id, id));

    log.info("Dismissed smart alert", { id, userId });
  }

  /**
   * Auto-resolve an alert when the condition no longer applies.
   */
  async resolve(id: string): Promise<void> {
    await this.dbClient
      .update(smartAlerts)
      .set({
        resolvedAt: new Date(),
      })
      .where(eq(smartAlerts.id, id));

    log.info("Auto-resolved smart alert", { id });
  }

  /**
   * Resolve all alerts that have passed their expiration date.
   * Returns the number of alerts resolved.
   */
  async expireOld(): Promise<number> {
    const now = new Date();

    // Find and resolve expired alerts in one transaction
    const expiredAlerts = await this.dbClient.query.smartAlerts.findMany({
      where: and(
        eq(smartAlerts.isDismissed, false),
        isNull(smartAlerts.resolvedAt)
      ),
      columns: { id: true, expiresAt: true },
    });

    const toResolve = expiredAlerts.filter(
      (a) => a.expiresAt && a.expiresAt < now
    );

    if (toResolve.length === 0) {
      return 0;
    }

    for (const alert of toResolve) {
      await this.resolve(alert.id);
    }

    log.info("Expired old alerts", { count: toResolve.length });

    return toResolve.length;
  }
}

// Singleton instance
let repoInstance: SmartAlertRepository | null = null;

/**
 * Get the singleton repository instance.
 */
export function getSmartAlertRepository(): SmartAlertRepository {
  if (!repoInstance) {
    repoInstance = new SmartAlertRepository();
  }
  return repoInstance;
}
