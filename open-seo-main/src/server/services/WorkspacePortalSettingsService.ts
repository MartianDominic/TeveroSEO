/**
 * Workspace Portal Settings Service
 * Phase 96: CPR-005, CPR-007
 *
 * Manages agency-level portal configuration including:
 * - Session timeout settings (CPR-005)
 * - Timezone configuration (CPR-007)
 *
 * Usage:
 * ```ts
 * import { workspacePortalSettingsService } from '@/server/services/WorkspacePortalSettingsService';
 *
 * // Get settings (creates default if not exists)
 * const settings = await workspacePortalSettingsService.getSettings(workspaceId);
 *
 * // Update settings
 * await workspacePortalSettingsService.updateSettings(workspaceId, {
 *   sessionTimeoutHours: 48,
 *   timezone: 'America/New_York',
 * });
 * ```
 */
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  workspacePortalSettings,
  DEFAULT_PORTAL_SETTINGS,
  type WorkspacePortalSettingsSelect,
} from "@/db/workspace-portal-settings-schema";
import { createLogger } from "@/server/lib/logger";

const logger = createLogger({ module: "workspace-portal-settings" });

// ============================================================================
// Types
// ============================================================================

/**
 * Settings update input - all fields optional.
 */
export interface PortalSettingsUpdate {
  sessionTimeoutHours?: number;
  timezone?: string;
  portalTitle?: string | null;
  supportEmail?: string | null;
}

/**
 * Public portal settings (safe for frontend).
 */
export interface PublicPortalSettings {
  sessionTimeoutHours: number;
  timezone: string;
  portalTitle: string | null;
  supportEmail: string | null;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate session timeout is within allowed range (1-72 hours).
 */
function validateSessionTimeout(hours: number): boolean {
  return Number.isInteger(hours) && hours >= 1 && hours <= 72;
}

/**
 * Validate timezone is a valid IANA identifier.
 * Uses Intl.DateTimeFormat to check validity.
 */
function validateTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for managing workspace portal settings.
 */
export class WorkspacePortalSettingsService {
  /**
   * Get portal settings for a workspace.
   * Creates default settings if none exist.
   *
   * @param workspaceId - The workspace ID
   * @returns Portal settings
   */
  async getSettings(workspaceId: string): Promise<WorkspacePortalSettingsSelect> {
    // Try to get existing settings
    const existing = await db.query.workspacePortalSettings.findFirst({
      where: eq(workspacePortalSettings.workspaceId, workspaceId),
    });

    if (existing) {
      return existing;
    }

    // Create default settings
    const [created] = await db
      .insert(workspacePortalSettings)
      .values({
        id: nanoid(),
        workspaceId,
        ...DEFAULT_PORTAL_SETTINGS,
      })
      .returning();

    logger.debug("Created default portal settings", { workspaceId });

    return created;
  }

  /**
   * Get public portal settings (safe for frontend/portal).
   *
   * @param workspaceId - The workspace ID
   * @returns Public settings subset
   */
  async getPublicSettings(workspaceId: string): Promise<PublicPortalSettings> {
    const settings = await this.getSettings(workspaceId);

    return {
      sessionTimeoutHours: settings.sessionTimeoutHours,
      timezone: settings.timezone,
      portalTitle: settings.portalTitle,
      supportEmail: settings.supportEmail,
    };
  }

  /**
   * Update portal settings for a workspace.
   *
   * @param workspaceId - The workspace ID
   * @param updates - Settings to update
   * @returns Updated settings
   * @throws Error if validation fails
   */
  async updateSettings(
    workspaceId: string,
    updates: PortalSettingsUpdate
  ): Promise<WorkspacePortalSettingsSelect> {
    // Validate session timeout if provided
    if (
      updates.sessionTimeoutHours !== undefined &&
      !validateSessionTimeout(updates.sessionTimeoutHours)
    ) {
      throw new Error(
        "Invalid session timeout: must be an integer between 1 and 72 hours"
      );
    }

    // Validate timezone if provided
    if (updates.timezone !== undefined && !validateTimezone(updates.timezone)) {
      throw new Error(`Invalid timezone: ${updates.timezone}`);
    }

    // Ensure settings exist first
    await this.getSettings(workspaceId);

    // Update settings
    const [updated] = await db
      .update(workspacePortalSettings)
      .set({
        ...(updates.sessionTimeoutHours !== undefined && {
          sessionTimeoutHours: updates.sessionTimeoutHours,
        }),
        ...(updates.timezone !== undefined && {
          timezone: updates.timezone,
        }),
        ...(updates.portalTitle !== undefined && {
          portalTitle: updates.portalTitle,
        }),
        ...(updates.supportEmail !== undefined && {
          supportEmail: updates.supportEmail,
        }),
        updatedAt: new Date(),
      })
      .where(eq(workspacePortalSettings.workspaceId, workspaceId))
      .returning();

    logger.info("Updated portal settings", {
      workspaceId,
      sessionTimeoutHours: updates.sessionTimeoutHours,
      timezone: updates.timezone,
    });

    return updated;
  }

  /**
   * Get session timeout in milliseconds for a workspace.
   * Used by token generation and validation.
   *
   * @param workspaceId - The workspace ID
   * @returns Session timeout in milliseconds
   */
  async getSessionTimeoutMs(workspaceId: string): Promise<number> {
    const settings = await this.getSettings(workspaceId);
    return settings.sessionTimeoutHours * 60 * 60 * 1000;
  }

  /**
   * Get session expiry date based on workspace settings.
   *
   * @param workspaceId - The workspace ID
   * @returns Expiry date
   */
  async getSessionExpiryDate(workspaceId: string): Promise<Date> {
    const timeoutMs = await this.getSessionTimeoutMs(workspaceId);
    return new Date(Date.now() + timeoutMs);
  }
}

// Default singleton instance
export const workspacePortalSettingsService = new WorkspacePortalSettingsService();

/**
 * Factory function for testing.
 */
export function createWorkspacePortalSettingsService(): WorkspacePortalSettingsService {
  return new WorkspacePortalSettingsService();
}
