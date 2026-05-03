/**
 * DomChangeService - Manages DOM change lifecycle for pixel injection.
 * Phase 66: Platform Unification Excellence - Plan 07
 *
 * Provides:
 * - Change queuing with approval workflow
 * - Approve/reject/rollback operations
 * - Approved changes retrieval for pixel
 * - Full change history with pagination
 *
 * Security (Threat Model):
 * - T-66-19: Sanitizes HTML content, validates schema JSON
 * - T-66-20: Approval requires appropriate userId
 * - T-66-21: Validates siteId matches pixel installation
 * - T-66-22: Full audit trail with userId and timestamps
 */
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  pixelDomChanges,
  pixelInstallations,
  PIXEL_CHANGE_TYPES,
  type PixelChangeType,
  type PixelDomChangeSelect,
  type PixelDomChangeInsert,
} from "@/db/pixel-schema";
import type { DbClient } from "@/db";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Request to queue a new DOM change.
 */
export interface QueueChangeRequest {
  siteId: string;
  changeType: PixelChangeType;
  targetSelector?: string;
  targetUrl?: string;
  newValue: string;
}

/**
 * Response for approved changes (for pixel to inject).
 */
export interface ApprovedChangesResponse {
  changes: ApprovedChange[];
}

/**
 * Single approved change for DOM injection.
 */
export interface ApprovedChange {
  id: string;
  type: string;
  selector?: string;
  url?: string;
  value: string;
}

/**
 * Pagination options for history queries.
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

// -----------------------------------------------------------------------------
// Validation and Sanitization
// -----------------------------------------------------------------------------

/**
 * Validate that change type is a valid enum value.
 */
function isValidChangeType(type: string): type is PixelChangeType {
  return PIXEL_CHANGE_TYPES.includes(type as PixelChangeType);
}

/**
 * Sanitize HTML content to prevent XSS (T-66-19).
 * Removes script tags and event handlers.
 */
function sanitizeHtml(content: string): string {
  // Remove script tags and their content
  let sanitized = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, "");
  return sanitized;
}

/**
 * Validate JSON schema content (T-66-19).
 */
function validateSchemaJson(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Pure Helper Functions (exported for module interface)
// -----------------------------------------------------------------------------

/**
 * Queue a change using a service instance.
 * Helper function for module exports.
 */
export async function queueChange(
  service: DomChangeService,
  request: QueueChangeRequest
): Promise<PixelDomChangeSelect> {
  return service.queueChange(request);
}

/**
 * Approve a change using a service instance.
 */
export async function approveChange(
  service: DomChangeService,
  changeId: string,
  userId: string
): Promise<PixelDomChangeSelect> {
  return service.approveChange(changeId, userId);
}

/**
 * Reject a change using a service instance.
 */
export async function rejectChange(
  service: DomChangeService,
  changeId: string,
  userId: string,
  reason?: string
): Promise<void> {
  return service.rejectChange(changeId, userId, reason);
}

/**
 * Rollback a change using a service instance.
 */
export async function rollbackChange(
  service: DomChangeService,
  changeId: string,
  userId: string
): Promise<PixelDomChangeSelect> {
  return service.rollbackChange(changeId, userId);
}

// -----------------------------------------------------------------------------
// Service Class
// -----------------------------------------------------------------------------

/**
 * DomChangeService - Manages DOM change lifecycle for pixel injection.
 */
export class DomChangeService {
  constructor(private readonly db: DbClient) {}

  /**
   * Queue a new DOM change for approval.
   *
   * Change lifecycle:
   * 1. queueChange -> status: 'pending'
   * 2. approveChange -> status: 'live' (approved then immediately live)
   * 3. rollbackChange -> original status: 'rolled_back', new change: 'live'
   *
   * @param request - Change request details
   * @returns Created change record
   * @throws Error if siteId not found or invalid change type
   */
  async queueChange(request: QueueChangeRequest): Promise<PixelDomChangeSelect> {
    const { siteId, changeType, targetSelector, targetUrl, newValue } = request;

    // Validate change type (T-66-19)
    if (!isValidChangeType(changeType)) {
      throw new Error("Invalid change type");
    }

    // Find installation by siteId (T-66-21)
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.siteId, siteId),
    });

    if (!installation) {
      throw new Error("Installation not found");
    }

    // Validate schema JSON if schema type (T-66-19)
    if (changeType === "schema" && !validateSchemaJson(newValue)) {
      throw new Error("Invalid JSON schema");
    }

    // Sanitize HTML content for content type (T-66-19)
    const sanitizedValue =
      changeType === "content" ? sanitizeHtml(newValue) : newValue;

    // Capture old value from current live change (for diff)
    const oldValue = await this.captureOldValue(
      installation.id,
      changeType,
      targetUrl
    );

    // Create pending change record (T-66-22: audit trail)
    const changeId = nanoid();
    const [newChange] = await this.db
      .insert(pixelDomChanges)
      .values({
        id: changeId,
        installationId: installation.id,
        changeType,
        targetSelector: targetSelector ?? null,
        targetUrl: targetUrl ?? null,
        oldValue,
        newValue: sanitizedValue,
        status: "pending",
      } satisfies PixelDomChangeInsert)
      .returning();

    return newChange;
  }

  /**
   * Approve a pending change and move it to live status.
   *
   * @param changeId - ID of the change to approve
   * @param userId - ID of the user approving the change (T-66-20, T-66-22)
   * @returns Updated change record
   * @throws Error if change not found or not pending
   */
  async approveChange(
    changeId: string,
    userId: string
  ): Promise<PixelDomChangeSelect> {
    // Find the change
    const change = await this.db.query.pixelDomChanges.findFirst({
      where: eq(pixelDomChanges.id, changeId),
    });

    if (!change) {
      throw new Error("Change not found");
    }

    if (change.status !== "pending") {
      throw new Error("Change is not pending");
    }

    const now = new Date();

    // Check for existing live change of same type/url - mark it as rolled_back
    const existingLive = await this.db.query.pixelDomChanges.findFirst({
      where: and(
        eq(pixelDomChanges.installationId, change.installationId),
        eq(pixelDomChanges.changeType, change.changeType),
        eq(pixelDomChanges.status, "live"),
        change.targetUrl
          ? eq(pixelDomChanges.targetUrl, change.targetUrl)
          : undefined
      ),
    });

    if (existingLive) {
      // Mark existing live change as rolled_back
      await this.db
        .update(pixelDomChanges)
        .set({ status: "rolled_back" })
        .where(eq(pixelDomChanges.id, existingLive.id));
    }

    // Approve and deploy immediately (T-66-22: audit trail)
    const [updatedChange] = await this.db
      .update(pixelDomChanges)
      .set({
        status: "live",
        approvedBy: userId,
        approvedAt: now,
        deployedAt: now,
      })
      .where(eq(pixelDomChanges.id, changeId))
      .returning();

    return updatedChange;
  }

  /**
   * Reject a pending change.
   *
   * @param changeId - ID of the change to reject
   * @param userId - ID of the user rejecting (T-66-22: audit trail)
   * @param reason - Optional rejection reason
   * @throws Error if change not found or not pending
   */
  async rejectChange(
    changeId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    // Find the change
    const change = await this.db.query.pixelDomChanges.findFirst({
      where: eq(pixelDomChanges.id, changeId),
    });

    if (!change) {
      throw new Error("Change not found");
    }

    if (change.status !== "pending") {
      throw new Error("Change is not pending");
    }

    // Update to rejected (T-66-22: audit trail)
    // Note: rejection reason would need schema update to store
    await this.db
      .update(pixelDomChanges)
      .set({
        status: "rejected",
        approvedBy: userId, // Store who rejected for audit
        approvedAt: new Date(),
      })
      .where(eq(pixelDomChanges.id, changeId));
  }

  /**
   * Rollback a live change to its previous value.
   *
   * Creates a new change that restores the oldValue and marks
   * the original change as rolled_back.
   *
   * @param changeId - ID of the live change to rollback
   * @param userId - ID of the user performing rollback (T-66-22)
   * @returns New change record with restored value
   * @throws Error if change not live or no oldValue to restore
   */
  async rollbackChange(
    changeId: string,
    userId: string
  ): Promise<PixelDomChangeSelect> {
    // Find the change
    const change = await this.db.query.pixelDomChanges.findFirst({
      where: eq(pixelDomChanges.id, changeId),
    });

    if (!change) {
      throw new Error("Change not found");
    }

    if (change.status !== "live") {
      throw new Error("Can only rollback live changes");
    }

    if (!change.oldValue) {
      throw new Error("No previous value to restore");
    }

    const now = new Date();

    // Mark original change as rolled_back
    await this.db
      .update(pixelDomChanges)
      .set({ status: "rolled_back" })
      .where(eq(pixelDomChanges.id, changeId));

    // Create new change to restore the old value (T-66-22: audit trail)
    const [rollbackChange] = await this.db
      .insert(pixelDomChanges)
      .values({
        id: nanoid(),
        installationId: change.installationId,
        changeType: change.changeType,
        targetSelector: change.targetSelector,
        targetUrl: change.targetUrl,
        oldValue: change.newValue, // Current value becomes old
        newValue: change.oldValue, // Restore to previous value
        status: "live", // Immediately live
        approvedBy: userId,
        approvedAt: now,
        deployedAt: now,
      } satisfies PixelDomChangeInsert)
      .returning();

    return rollbackChange;
  }

  /**
   * Get approved (live) changes for pixel to inject.
   *
   * @param siteId - Site ID from pixel data-site attribute
   * @param pageUrl - Optional page URL to filter changes
   * @returns Approved changes in format suitable for DOM injection
   */
  async getApprovedChanges(
    siteId: string,
    pageUrl?: string
  ): Promise<ApprovedChangesResponse> {
    // Find installation by siteId (T-66-21)
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.siteId, siteId),
    });

    if (!installation) {
      return { changes: [] };
    }

    // Get live changes for this installation
    const changes = await this.db.query.pixelDomChanges.findMany({
      where: and(
        eq(pixelDomChanges.installationId, installation.id),
        eq(pixelDomChanges.status, "live")
      ),
    });

    // Filter by URL if provided
    const filteredChanges = pageUrl
      ? changes.filter(
          (c) => !c.targetUrl || c.targetUrl === pageUrl
        )
      : changes;

    // Map to response format (only necessary fields for DOM injection)
    const approvedChanges: ApprovedChange[] = filteredChanges.map((c) => ({
      id: c.id,
      type: c.changeType,
      selector: c.targetSelector ?? undefined,
      url: c.targetUrl ?? undefined,
      value: c.newValue,
    }));

    return { changes: approvedChanges };
  }

  /**
   * Get pending changes awaiting approval.
   *
   * @param siteId - Site ID
   * @returns Array of pending changes
   */
  async getPendingChanges(siteId: string): Promise<PixelDomChangeSelect[]> {
    // Find installation by siteId
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.siteId, siteId),
    });

    if (!installation) {
      return [];
    }

    const changes = await this.db.query.pixelDomChanges.findMany({
      where: and(
        eq(pixelDomChanges.installationId, installation.id),
        eq(pixelDomChanges.status, "pending")
      ),
    });

    return changes;
  }

  /**
   * Get full change history with pagination.
   *
   * @param siteId - Site ID
   * @param options - Pagination options
   * @returns Array of all changes (any status)
   */
  async getChangeHistory(
    siteId: string,
    options?: PaginationOptions
  ): Promise<PixelDomChangeSelect[]> {
    const { limit = 50, offset = 0 } = options ?? {};

    // Find installation by siteId
    const installation = await this.db.query.pixelInstallations.findFirst({
      where: eq(pixelInstallations.siteId, siteId),
    });

    if (!installation) {
      return [];
    }

    const changes = await this.db.query.pixelDomChanges.findMany({
      where: eq(pixelDomChanges.installationId, installation.id),
      orderBy: [desc(pixelDomChanges.createdAt)],
      limit,
      offset,
    });

    return changes;
  }

  /**
   * Capture the current live value for a change type/URL.
   * Used to populate oldValue when queuing a new change.
   *
   * @param installationId - Installation ID
   * @param changeType - Type of change
   * @param targetUrl - Optional target URL
   * @returns Current live value or null
   */
  private async captureOldValue(
    installationId: string,
    changeType: string,
    targetUrl?: string
  ): Promise<string | null> {
    const existingLive = await this.db.query.pixelDomChanges.findFirst({
      where: and(
        eq(pixelDomChanges.installationId, installationId),
        eq(pixelDomChanges.changeType, changeType),
        eq(pixelDomChanges.status, "live"),
        targetUrl ? eq(pixelDomChanges.targetUrl, targetUrl) : undefined
      ),
    });

    return existingLive?.newValue ?? null;
  }
}

/**
 * Create a DomChangeService instance with the provided database client.
 */
export function createDomChangeService(db: DbClient): DomChangeService {
  return new DomChangeService(db);
}
