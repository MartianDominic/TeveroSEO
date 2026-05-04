/**
 * WorkflowRepository
 * Phase 62-03: Engagement Workflow Engine
 *
 * Data access layer for workflow templates, instances, and events.
 */
import { eq, and, inArray, lte, isNull, or, desc } from "drizzle-orm";
import { db } from "@/db";
import { nanoid } from "nanoid";
import {
  workflowTemplates,
  workflowInstances,
  workflowEvents,
  type WorkflowTemplateSelect,
  type WorkflowTemplateInsert,
  type WorkflowInstanceSelect,
  type WorkflowInstanceInsert,
  type WorkflowEventSelect,
  type WorkflowEventInsert,
  type WorkflowInstanceStatus,
  type WorkflowEventType,
  type EntityType,
} from "@/db";

export class WorkflowRepository {
  private readonly db = db;

  // ============================================================================
  // Workflow Instances
  // ============================================================================

  /**
   * Find workflow instance by ID.
   *
   * SECURITY: This method does NOT filter by workspace.
   * Use findByIdScoped() for tenant-safe access, or
   * call assertTenantAccess() at service layer after retrieval.
   */
  async findById(id: string): Promise<WorkflowInstanceSelect | null> {
    const result = await this.db.query.workflowInstances.findFirst({
      where: eq(workflowInstances.id, id),
    });
    return result ?? null;
  }

  /**
   * Find workflow instance by ID with workspace scope.
   * Returns null if instance doesn't exist OR belongs to different workspace.
   * Use this for tenant-safe data access.
   */
  async findByIdScoped(
    id: string,
    workspaceId: string
  ): Promise<WorkflowInstanceSelect | null> {
    const result = await this.db.query.workflowInstances.findFirst({
      where: and(
        eq(workflowInstances.id, id),
        eq(workflowInstances.workspaceId, workspaceId)
      ),
    });
    return result ?? null;
  }

  /**
   * Find active/snoozed workflow for a specific entity.
   * Returns null if no active workflow exists.
   */
  async findByEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<WorkflowInstanceSelect | null> {
    const result = await this.db.query.workflowInstances.findFirst({
      where: and(
        eq(workflowInstances.entityType, entityType),
        eq(workflowInstances.entityId, entityId),
        inArray(workflowInstances.status, ["pending", "active", "snoozed"])
      ),
    });
    return result ?? null;
  }

  /**
   * Find all active workflow instances for a workspace.
   */
  async findActiveByWorkspace(
    workspaceId: string
  ): Promise<WorkflowInstanceSelect[]> {
    return this.db.query.workflowInstances.findMany({
      where: and(
        eq(workflowInstances.workspaceId, workspaceId),
        eq(workflowInstances.status, "active")
      ),
    });
  }

  /**
   * Find snoozed workflows that are due to resume.
   */
  async findSnoozedDue(): Promise<WorkflowInstanceSelect[]> {
    const now = new Date();
    return this.db.query.workflowInstances.findMany({
      where: and(
        eq(workflowInstances.status, "snoozed"),
        lte(workflowInstances.snoozedUntil, now)
      ),
    });
  }

  /**
   * Create a new workflow instance.
   */
  async create(
    data: Omit<WorkflowInstanceInsert, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowInstanceSelect> {
    const [result] = await this.db
      .insert(workflowInstances)
      .values({
        id: nanoid(),
        ...data,
      })
      .returning();
    return result;
  }

  /**
   * Update a workflow instance.
   */
  async update(
    id: string,
    data: Partial<
      Omit<WorkflowInstanceInsert, "id" | "workspaceId" | "createdAt">
    >
  ): Promise<void> {
    await this.db
      .update(workflowInstances)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(workflowInstances.id, id));
  }

  // ============================================================================
  // Workflow Events (Audit Log)
  // ============================================================================

  /**
   * Log a workflow event.
   */
  async logEvent(
    instanceId: string,
    eventType: WorkflowEventType,
    details: {
      stepIndex?: number;
      actionTaken?: string;
      result?: Record<string, unknown>;
      errorMessage?: string;
      triggeredBy?: string;
    } = {}
  ): Promise<void> {
    await this.db.insert(workflowEvents).values({
      id: nanoid(),
      instanceId,
      eventType,
      stepIndex: details.stepIndex,
      actionTaken: details.actionTaken,
      result: details.result,
      errorMessage: details.errorMessage,
      triggeredBy: details.triggeredBy ?? "system",
    });
  }

  /**
   * Get events for a workflow instance.
   */
  async getEvents(instanceId: string): Promise<WorkflowEventSelect[]> {
    return this.db.query.workflowEvents.findMany({
      where: eq(workflowEvents.instanceId, instanceId),
      orderBy: desc(workflowEvents.createdAt),
    });
  }

  // ============================================================================
  // Workflow Templates
  // ============================================================================

  /**
   * Get templates for a workspace (includes system templates).
   */
  async getTemplates(
    workspaceId: string,
    entityType?: EntityType
  ): Promise<WorkflowTemplateSelect[]> {
    const conditions = [
      or(
        eq(workflowTemplates.workspaceId, workspaceId),
        isNull(workflowTemplates.workspaceId) // System templates
      ),
      eq(workflowTemplates.isActive, true),
    ];

    if (entityType) {
      conditions.push(eq(workflowTemplates.entityType, entityType));
    }

    return this.db.query.workflowTemplates.findMany({
      where: and(...conditions),
    });
  }

  /**
   * Get a template by ID.
   *
   * SECURITY: This method does NOT filter by workspace.
   * Use getTemplateByIdScoped() for tenant-safe access, or
   * call assertTenantAccess() at service layer after retrieval.
   */
  async getTemplateById(id: string): Promise<WorkflowTemplateSelect | null> {
    const result = await this.db.query.workflowTemplates.findFirst({
      where: eq(workflowTemplates.id, id),
    });
    return result ?? null;
  }

  /**
   * Get a template by ID with workspace scope.
   * Includes system templates (workspaceId = null) as they are shared.
   * Returns null if template doesn't exist OR belongs to different workspace.
   */
  async getTemplateByIdScoped(
    id: string,
    workspaceId: string
  ): Promise<WorkflowTemplateSelect | null> {
    const result = await this.db.query.workflowTemplates.findFirst({
      where: and(
        eq(workflowTemplates.id, id),
        or(
          eq(workflowTemplates.workspaceId, workspaceId),
          isNull(workflowTemplates.workspaceId) // System templates are shared
        )
      ),
    });
    return result ?? null;
  }

  /**
   * Create a workflow template.
   */
  async createTemplate(
    data: Omit<WorkflowTemplateInsert, "id" | "createdAt" | "updatedAt">
  ): Promise<WorkflowTemplateSelect> {
    const [result] = await this.db
      .insert(workflowTemplates)
      .values({
        id: nanoid(),
        ...data,
      })
      .returning();
    return result;
  }

  /**
   * Update a workflow template.
   */
  async updateTemplate(
    id: string,
    data: Partial<
      Omit<WorkflowTemplateInsert, "id" | "workspaceId" | "createdAt">
    >
  ): Promise<void> {
    await this.db
      .update(workflowTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(workflowTemplates.id, id));
  }

  // ============================================================================
  // Touch Count Management
  // ============================================================================

  /**
   * Increment touch count for an instance.
   */
  async incrementTouchCount(instanceId: string): Promise<void> {
    const instance = await this.findById(instanceId);
    if (!instance) return;

    await this.update(instanceId, {
      touchesThisWeek: (instance.touchesThisWeek ?? 0) + 1,
      lastTouchAt: new Date(),
    });
  }

  /**
   * Reset weekly touch counts for all instances.
   * Called by scheduled job every Monday.
   */
  async resetWeeklyTouchCounts(): Promise<number> {
    const result = await this.db
      .update(workflowInstances)
      .set({
        touchesThisWeek: 0,
        updatedAt: new Date(),
      })
      .where(
        inArray(workflowInstances.status, ["pending", "active", "snoozed"])
      );

    // Note: Drizzle doesn't return count directly, but we can query separately if needed
    return 0;
  }
}

// Singleton instance
let workflowRepositoryInstance: WorkflowRepository | null = null;

/**
 * Get the singleton WorkflowRepository instance.
 */
export function getWorkflowRepository(): WorkflowRepository {
  if (!workflowRepositoryInstance) {
    workflowRepositoryInstance = new WorkflowRepository();
  }
  return workflowRepositoryInstance;
}
