/**
 * ClientVisibilityService
 * Phase 96-05: Client Portal Visibility Controls
 *
 * Manages per-metric visibility configuration for client portals.
 * Enforces field-level privacy at the service layer.
 *
 * Key features:
 * - Per-client, per-workspace visibility configuration
 * - Deep filtering of nested objects and arrays
 * - Workspace access validation
 * - Default visibility for unconfigured clients
 */
import { eq, and, sql } from "drizzle-orm";
import type { DbClient } from "@/db";
import {
  clientVisibility,
  DEFAULT_VISIBILITY,
  type VisibilityConfig,
  type ClientVisibilityInsert,
} from "@/db/analytics-extended-schema";
import { clients } from "@/db/client-schema";

/**
 * Fields to filter based on visibility config
 */
const VISIBILITY_FIELD_MAP: Record<keyof VisibilityConfig, string[]> = {
  showClicks: ["clicks", "clicksChange", "totalClicks", "dailyClicks"],
  showImpressions: ["impressions", "impressionsChange", "totalImpressions", "dailyImpressions"],
  showPosition: ["position", "positionChange", "avgPosition", "averagePosition"],
  showCtr: ["ctr", "ctrChange", "averageCtr", "avgCtr"],
  showQueries: ["query", "queries", "topQueries", "searchQuery", "searchQueries"],
  showPages: ["pageUrl", "page", "pages", "url", "urls"],
  showCompetitors: ["competitors", "competitorDomain", "competitorData"],
  canViewGrowing: [], // Used for route access control, not field filtering
  canViewDecaying: [], // Used for route access control, not field filtering
  canViewCannibalization: [], // Used for route access control, not field filtering
  canExport: [], // Used for route access control, not field filtering
};

export class ClientVisibilityService {
  constructor(private db: DbClient) {}

  /**
   * Get visibility configuration for a client.
   * Returns default config if no custom config exists.
   */
  async getVisibilityConfig(
    clientId: string,
    workspaceId: string
  ): Promise<VisibilityConfig> {
    const result = await this.db
      .select()
      .from(clientVisibility)
      .where(
        and(
          eq(clientVisibility.clientId, clientId),
          eq(clientVisibility.workspaceId, workspaceId)
        )
      );

    if (result.length === 0) {
      return { ...DEFAULT_VISIBILITY };
    }

    const row = result[0];
    return {
      showClicks: row.showClicks,
      showImpressions: row.showImpressions,
      showPosition: row.showPosition,
      showCtr: row.showCtr,
      showQueries: row.showQueries,
      showPages: row.showPages,
      showCompetitors: row.showCompetitors,
      canViewGrowing: row.canViewGrowing,
      canViewDecaying: row.canViewDecaying,
      canViewCannibalization: row.canViewCannibalization,
      canExport: row.canExport,
    };
  }

  /**
   * Update visibility configuration for a client.
   * Uses upsert to create or update as needed.
   */
  async updateVisibilityConfig(
    clientId: string,
    workspaceId: string,
    updates: Partial<VisibilityConfig>
  ): Promise<VisibilityConfig> {
    const insertData: ClientVisibilityInsert = {
      clientId,
      workspaceId,
      showClicks: updates.showClicks ?? DEFAULT_VISIBILITY.showClicks,
      showImpressions: updates.showImpressions ?? DEFAULT_VISIBILITY.showImpressions,
      showPosition: updates.showPosition ?? DEFAULT_VISIBILITY.showPosition,
      showCtr: updates.showCtr ?? DEFAULT_VISIBILITY.showCtr,
      showQueries: updates.showQueries ?? DEFAULT_VISIBILITY.showQueries,
      showPages: updates.showPages ?? DEFAULT_VISIBILITY.showPages,
      showCompetitors: updates.showCompetitors ?? DEFAULT_VISIBILITY.showCompetitors,
      canViewGrowing: updates.canViewGrowing ?? DEFAULT_VISIBILITY.canViewGrowing,
      canViewDecaying: updates.canViewDecaying ?? DEFAULT_VISIBILITY.canViewDecaying,
      canViewCannibalization: updates.canViewCannibalization ?? DEFAULT_VISIBILITY.canViewCannibalization,
      canExport: updates.canExport ?? DEFAULT_VISIBILITY.canExport,
    };

    const result = await this.db
      .insert(clientVisibility)
      .values(insertData)
      .onConflictDoUpdate({
        target: [clientVisibility.clientId, clientVisibility.workspaceId],
        set: {
          ...updates,
          updatedAt: new Date(),
        },
      })
      .returning();

    const row = result[0];
    return {
      showClicks: row.showClicks,
      showImpressions: row.showImpressions,
      showPosition: row.showPosition,
      showCtr: row.showCtr,
      showQueries: row.showQueries,
      showPages: row.showPages,
      showCompetitors: row.showCompetitors,
      canViewGrowing: row.canViewGrowing,
      canViewDecaying: row.canViewDecaying,
      canViewCannibalization: row.canViewCannibalization,
      canExport: row.canExport,
    };
  }

  /**
   * Filter data based on visibility configuration.
   * Recursively processes nested objects and arrays.
   */
  filterByVisibility<T extends Record<string, unknown>>(
    data: T,
    config: VisibilityConfig
  ): Partial<T> {
    return this.filterObject(data, config) as Partial<T>;
  }

  /**
   * Validate that a client belongs to the given workspace.
   */
  async validateWorkspaceAccess(
    clientId: string,
    workspaceId: string
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${clients}
      WHERE ${clients.id} = ${clientId}
        AND ${clients.workspaceId} = ${workspaceId}
        AND ${clients.isDeleted} = false
    `);

    const count = Number(result.rows[0]?.count ?? 0);
    return count > 0;
  }

  /**
   * Get fields that should be hidden based on config.
   */
  private getHiddenFields(config: VisibilityConfig): Set<string> {
    const hidden = new Set<string>();

    for (const [key, fields] of Object.entries(VISIBILITY_FIELD_MAP)) {
      const configKey = key as keyof VisibilityConfig;
      if (!config[configKey]) {
        for (const field of fields) {
          hidden.add(field.toLowerCase());
        }
      }
    }

    return hidden;
  }

  /**
   * Recursively filter an object, removing hidden fields.
   */
  private filterObject(
    obj: unknown,
    config: VisibilityConfig
  ): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.filterObject(item, config));
    }

    if (typeof obj !== "object") {
      return obj;
    }

    const hiddenFields = this.getHiddenFields(config);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // Check if this field should be hidden
      if (hiddenFields.has(lowerKey)) {
        continue;
      }

      // Recursively filter nested objects
      if (value !== null && typeof value === "object") {
        result[key] = this.filterObject(value, config);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

// Singleton instance with lazy db import to avoid test-time DATABASE_URL requirement
let instance: ClientVisibilityService | null = null;

export async function getClientVisibilityService(): Promise<ClientVisibilityService> {
  if (!instance) {
    const { db } = await import("@/db");
    instance = new ClientVisibilityService(db);
  }
  return instance;
}

// Synchronous getter for cases where service is already initialized
export function getClientVisibilityServiceSync(): ClientVisibilityService {
  if (!instance) {
    throw new Error("ClientVisibilityService not initialized. Call getClientVisibilityService() first.");
  }
  return instance;
}

// Reset singleton for testing
export function resetClientVisibilityService(): void {
  instance = null;
}

// Convenience export
export { DEFAULT_VISIBILITY };
