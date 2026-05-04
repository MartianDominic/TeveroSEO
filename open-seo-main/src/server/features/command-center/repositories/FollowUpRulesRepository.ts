/**
 * FollowUp Rules Repository
 * Phase 62-02: Follow-up system with rules engine
 *
 * CRUD operations for follow_up_rules table.
 * Supports rule management for automated follow-up creation.
 */
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  followUpRules,
  type FollowUpRuleSelect,
  type FollowUpRuleInsert,
  type EntityType,
} from "@/db/follow-up-schema";

/**
 * Find all rules for a workspace.
 */
export async function findByWorkspace(
  workspaceId: string,
  activeOnly: boolean = false
): Promise<FollowUpRuleSelect[]> {
  const conditions = [eq(followUpRules.workspaceId, workspaceId)];

  if (activeOnly) {
    conditions.push(eq(followUpRules.isActive, true));
  }

  return await db
    .select()
    .from(followUpRules)
    .where(and(...conditions))
    .orderBy(asc(followUpRules.name));
}

/**
 * Find rules by entity type.
 */
export async function findByEntityType(
  workspaceId: string,
  entityType: EntityType
): Promise<FollowUpRuleSelect[]> {
  return await db
    .select()
    .from(followUpRules)
    .where(
      and(
        eq(followUpRules.workspaceId, workspaceId),
        eq(followUpRules.entityType, entityType),
        eq(followUpRules.isActive, true)
      )
    )
    .orderBy(asc(followUpRules.name));
}

/**
 * Find a rule by ID.
 *
 * SECURITY: This method does NOT filter by workspace.
 * Use findByIdScoped() for tenant-safe access, or
 * call assertTenantAccess() at service layer after retrieval.
 */
export async function findById(id: string): Promise<FollowUpRuleSelect | null> {
  const [result] = await db
    .select()
    .from(followUpRules)
    .where(eq(followUpRules.id, id))
    .limit(1);

  return result ?? null;
}

/**
 * Find a rule by ID with workspace scope.
 * Returns null if rule doesn't exist OR belongs to different workspace.
 * Use this for tenant-safe data access.
 */
export async function findByIdScoped(
  id: string,
  workspaceId: string
): Promise<FollowUpRuleSelect | null> {
  const [result] = await db
    .select()
    .from(followUpRules)
    .where(and(eq(followUpRules.id, id), eq(followUpRules.workspaceId, workspaceId)))
    .limit(1);

  return result ?? null;
}

/**
 * Create a new rule.
 */
export async function create(
  data: FollowUpRuleInsert
): Promise<FollowUpRuleSelect> {
  const [result] = await db.insert(followUpRules).values(data).returning();
  return result;
}

/**
 * Update a rule.
 */
export async function update(
  id: string,
  data: Partial<FollowUpRuleInsert>
): Promise<FollowUpRuleSelect | null> {
  const [result] = await db
    .update(followUpRules)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(followUpRules.id, id))
    .returning();

  return result ?? null;
}

/**
 * Toggle rule active state.
 */
export async function toggleActive(
  id: string,
  isActive: boolean
): Promise<void> {
  await db
    .update(followUpRules)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(followUpRules.id, id));
}

/**
 * Delete a rule.
 */
export async function deleteRule(id: string): Promise<void> {
  await db.delete(followUpRules).where(eq(followUpRules.id, id));
}

export const FollowUpRulesRepository = {
  findByWorkspace,
  findByEntityType,
  findById,
  findByIdScoped,
  create,
  update,
  toggleActive,
  delete: deleteRule,
};
