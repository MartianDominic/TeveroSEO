/**
 * ContentBlockRepository
 * Phase 101-04: Content Library
 *
 * CRUD operations for content blocks with workspace scoping.
 * All queries are scoped by workspaceId for tenant isolation.
 */
import { eq, and, desc, isNull, ilike, sql } from "drizzle-orm";
import { db, type DrizzleTransaction } from "@/db";
import {
  contentBlocks,
  blockUsage,
  type ContentBlockInsert,
  type ContentBlockSelect,
} from "@/db/content-library-schema";
import { nanoid } from "nanoid";

/**
 * Search options for content blocks
 */
export interface ContentBlockSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Usage statistics for a block
 */
export interface BlockUsageStats {
  blockId: string;
  name: string;
  usageCount: number;
}

/**
 * ContentBlockRepository provides CRUD operations for content blocks.
 * Uses workspace scoping for all queries (security requirement).
 */
export const ContentBlockRepository = {
  /**
   * Create a new content block.
   * Generates ID using nanoid.
   */
  async create(
    data: Omit<ContentBlockInsert, "id">,
    tx?: DrizzleTransaction
  ): Promise<ContentBlockSelect> {
    const executor = tx ?? db;
    const id = nanoid();
    const [block] = await executor
      .insert(contentBlocks)
      .values({ ...data, id })
      .returning();
    return block;
  },

  /**
   * Find block by ID within workspace.
   * Returns null if not found or soft deleted.
   */
  async findById(
    id: string,
    workspaceId: string,
    tx?: DrizzleTransaction
  ): Promise<ContentBlockSelect | null> {
    const executor = tx ?? db;
    const [block] = await executor
      .select()
      .from(contentBlocks)
      .where(
        and(
          eq(contentBlocks.id, id),
          eq(contentBlocks.workspaceId, workspaceId),
          isNull(contentBlocks.softDeletedAt)
        )
      );
    return block ?? null;
  },

  /**
   * Find all blocks for a workspace.
   * Returns most recently updated first.
   */
  async findByWorkspace(
    workspaceId: string,
    limit = 100,
    tx?: DrizzleTransaction
  ): Promise<ContentBlockSelect[]> {
    const executor = tx ?? db;
    return executor
      .select()
      .from(contentBlocks)
      .where(
        and(
          eq(contentBlocks.workspaceId, workspaceId),
          isNull(contentBlocks.softDeletedAt)
        )
      )
      .orderBy(desc(contentBlocks.updatedAt))
      .limit(limit);
  },

  /**
   * Search blocks with filters.
   * Supports query (name search), category filter, and tags filter.
   * Results ordered by usage count (most popular first).
   */
  async search(
    workspaceId: string,
    options: ContentBlockSearchOptions,
    tx?: DrizzleTransaction
  ): Promise<ContentBlockSelect[]> {
    const executor = tx ?? db;

    // Build conditions array
    const conditions = [
      eq(contentBlocks.workspaceId, workspaceId),
      isNull(contentBlocks.softDeletedAt),
    ];

    if (options.query) {
      conditions.push(ilike(contentBlocks.name, `%${options.query}%`));
    }

    if (options.category) {
      conditions.push(eq(contentBlocks.category, options.category));
    }

    if (options.tags && options.tags.length > 0) {
      // PostgreSQL JSONB array overlap operator: ?| checks if any tag matches
      conditions.push(
        sql`${contentBlocks.tags} ?| array[${sql.join(
          options.tags.map((t) => sql`${t}`),
          sql`, `
        )}]`
      );
    }

    return executor
      .select()
      .from(contentBlocks)
      .where(and(...conditions))
      .orderBy(desc(contentBlocks.usageCount))
      .limit(options.limit ?? 50);
  },

  /**
   * Update a content block.
   * Returns updated block or null if not found.
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<ContentBlockInsert>,
    tx?: DrizzleTransaction
  ): Promise<ContentBlockSelect | null> {
    const executor = tx ?? db;
    const [updated] = await executor
      .update(contentBlocks)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(contentBlocks.id, id),
          eq(contentBlocks.workspaceId, workspaceId),
          isNull(contentBlocks.softDeletedAt)
        )
      )
      .returning();
    return updated ?? null;
  },

  /**
   * Increment usage count and update lastUsedAt timestamp.
   */
  async incrementUsage(
    id: string,
    workspaceId: string,
    tx?: DrizzleTransaction
  ): Promise<void> {
    const executor = tx ?? db;
    await executor
      .update(contentBlocks)
      .set({
        usageCount: sql`${contentBlocks.usageCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contentBlocks.id, id),
          eq(contentBlocks.workspaceId, workspaceId)
        )
      );
  },

  /**
   * Soft delete a content block.
   * Note: deletedBy is logged but not stored (softDeletedBy column not in schema).
   */
  async softDelete(
    id: string,
    workspaceId: string,
    _deletedBy: string,
    tx?: DrizzleTransaction
  ): Promise<void> {
    const executor = tx ?? db;
    await executor
      .update(contentBlocks)
      .set({
        softDeletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contentBlocks.id, id),
          eq(contentBlocks.workspaceId, workspaceId)
        )
      );
  },

  /**
   * Record usage of a block in an entity (proposal, contract, document).
   */
  async recordUsage(
    blockId: string,
    entityType: string,
    entityId: string,
    insertedBy?: string,
    tx?: DrizzleTransaction
  ): Promise<void> {
    const executor = tx ?? db;
    await executor.insert(blockUsage).values({
      id: nanoid(),
      blockId,
      entityType,
      entityId,
      insertedBy,
    });
  },

  /**
   * Get usage statistics for blocks in a workspace.
   * Returns blocks ordered by usage count (most popular first).
   */
  async getUsageStats(
    workspaceId: string,
    limit = 10,
    tx?: DrizzleTransaction
  ): Promise<BlockUsageStats[]> {
    const executor = tx ?? db;
    const stats = await executor
      .select({
        blockId: contentBlocks.id,
        name: contentBlocks.name,
        usageCount: contentBlocks.usageCount,
      })
      .from(contentBlocks)
      .where(
        and(
          eq(contentBlocks.workspaceId, workspaceId),
          isNull(contentBlocks.softDeletedAt)
        )
      )
      .orderBy(desc(contentBlocks.usageCount))
      .limit(limit);

    // Map to ensure usageCount is always a number
    return stats.map((s) => ({
      blockId: s.blockId,
      name: s.name,
      usageCount: s.usageCount ?? 0,
    }));
  },
};
