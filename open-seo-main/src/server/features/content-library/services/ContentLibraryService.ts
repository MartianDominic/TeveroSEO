/**
 * ContentLibraryService
 * Phase 101-04: Content Library
 *
 * Business logic for content library operations.
 * Provides CRUD for content blocks, search, and usage tracking.
 */
import { ContentBlockRepository } from "../repositories/ContentBlockRepository";
import {
  type ContentBlockSelect,
  CONTENT_BLOCK_CATEGORIES,
} from "@/db/content-library-schema";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ContentLibraryService" });

/**
 * Content block category type derived from schema.
 */
type ContentBlockCategory = (typeof CONTENT_BLOCK_CATEGORIES)[number];

/**
 * Input for creating a new content block.
 */
interface CreateBlockInput {
  name: string;
  category: ContentBlockCategory;
  content: string;
  contentEn?: string;
  contentLt?: string;
  tags?: string[];
}

/**
 * Input for updating a content block.
 */
interface UpdateBlockInput {
  name?: string;
  category?: ContentBlockCategory;
  content?: string;
  contentEn?: string;
  contentLt?: string;
  tags?: string[];
}

/**
 * Search options for content blocks.
 */
interface SearchOptions {
  query?: string;
  category?: ContentBlockCategory;
  tags?: string[];
  limit?: number;
}

/**
 * ContentLibraryService handles business logic for content library.
 */
export const ContentLibraryService = {
  /**
   * Create a new content block.
   *
   * @param input - Block creation input
   * @param workspaceId - Workspace ID for tenant isolation
   * @param userId - User ID of creator
   * @returns Created content block
   */
  async create(
    input: CreateBlockInput,
    workspaceId: string,
    userId: string
  ): Promise<ContentBlockSelect> {
    const block = await ContentBlockRepository.create({
      workspaceId,
      name: input.name,
      category: input.category,
      content: input.content,
      contentEn: input.contentEn,
      contentLt: input.contentLt,
      tags: input.tags ?? [],
      createdBy: userId,
    });

    log.info("Created content block", {
      blockId: block.id,
      category: input.category,
      workspaceId,
    });

    return block;
  },

  /**
   * Get a single block by ID.
   *
   * @param id - Block ID
   * @param workspaceId - Workspace ID for tenant isolation
   * @returns Content block or null if not found
   */
  async getById(
    id: string,
    workspaceId: string
  ): Promise<ContentBlockSelect | null> {
    return ContentBlockRepository.findById(id, workspaceId);
  },

  /**
   * Search blocks with filters.
   *
   * @param workspaceId - Workspace ID for tenant isolation
   * @param options - Search options (query, category, tags, limit)
   * @returns Array of matching content blocks
   */
  async search(
    workspaceId: string,
    options: SearchOptions = {}
  ): Promise<ContentBlockSelect[]> {
    return ContentBlockRepository.search(workspaceId, options);
  },

  /**
   * Update a content block.
   *
   * @param id - Block ID
   * @param workspaceId - Workspace ID for tenant isolation
   * @param input - Update input
   * @returns Updated block or null if not found
   */
  async update(
    id: string,
    workspaceId: string,
    input: UpdateBlockInput
  ): Promise<ContentBlockSelect | null> {
    const block = await ContentBlockRepository.update(id, workspaceId, input);
    if (block) {
      log.info("Updated content block", { blockId: id, workspaceId });
    }
    return block;
  },

  /**
   * Delete a content block (soft delete).
   *
   * @param id - Block ID
   * @param workspaceId - Workspace ID for tenant isolation
   * @param userId - User ID performing deletion
   */
  async delete(
    id: string,
    workspaceId: string,
    userId: string
  ): Promise<void> {
    await ContentBlockRepository.softDelete(id, workspaceId, userId);
    log.info("Deleted content block", { blockId: id, workspaceId });
  },

  /**
   * Record usage of a block when inserted into a document.
   * Verifies block exists and belongs to workspace before recording.
   *
   * @param blockId - Block ID
   * @param workspaceId - Workspace ID for tenant isolation
   * @param entityType - Type of entity (proposal, contract, document)
   * @param entityId - ID of the entity
   * @param userId - User ID who inserted the block (optional)
   */
  async recordUsage(
    blockId: string,
    workspaceId: string,
    entityType: "proposal" | "contract" | "document",
    entityId: string,
    userId?: string
  ): Promise<void> {
    // Verify block exists and belongs to workspace
    const block = await ContentBlockRepository.findById(blockId, workspaceId);
    if (!block) {
      log.warn("Attempted to record usage for non-existent block", {
        blockId,
        workspaceId,
      });
      return;
    }

    // Record usage event
    await ContentBlockRepository.recordUsage(
      blockId,
      entityType,
      entityId,
      userId
    );

    // Increment usage counter on block
    await ContentBlockRepository.incrementUsage(blockId, workspaceId);

    log.debug("Recorded content block usage", {
      blockId,
      entityType,
      entityId,
    });
  },

  /**
   * Get most popular blocks by usage count.
   *
   * @param workspaceId - Workspace ID for tenant isolation
   * @param limit - Maximum number of blocks to return (default: 10)
   * @returns Array of popular blocks with usage stats
   */
  async getPopularBlocks(
    workspaceId: string,
    limit = 10
  ): Promise<Array<{ blockId: string; name: string; usageCount: number }>> {
    return ContentBlockRepository.getUsageStats(workspaceId, limit);
  },

  /**
   * Get all available content block categories.
   *
   * @returns Array of category strings
   */
  getCategories(): readonly string[] {
    return CONTENT_BLOCK_CATEGORIES;
  },
};
