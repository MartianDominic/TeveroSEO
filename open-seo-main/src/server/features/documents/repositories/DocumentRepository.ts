/**
 * Document Repository
 * Phase 101: Document Management (D-04)
 *
 * Provides data access layer for documents with workspace scoping.
 * All queries enforce tenant isolation via workspaceId parameter.
 */
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  documents,
  documentVersions,
  documentReminders,
  type DocumentInsert,
  type DocumentSelect,
} from "@/db/document-schema";
import { nanoid } from "nanoid";

// ============================================================================
// Repository Implementation
// ============================================================================

export const DocumentRepository = {
  /**
   * Create a new document.
   */
  async create(data: Omit<DocumentInsert, "id">): Promise<DocumentSelect> {
    const id = nanoid();
    const [doc] = await db
      .insert(documents)
      .values({ ...data, id })
      .returning();
    return doc;
  },

  /**
   * Find document by ID with workspace scoping.
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<DocumentSelect | null> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.workspaceId, workspaceId),
          isNull(documents.softDeletedAt)
        )
      );
    return doc ?? null;
  },

  /**
   * Find documents by client ID.
   */
  async findByClient(
    clientId: string,
    workspaceId: string
  ): Promise<DocumentSelect[]> {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.clientId, clientId),
          eq(documents.workspaceId, workspaceId),
          isNull(documents.softDeletedAt)
        )
      )
      .orderBy(desc(documents.createdAt));
  },

  /**
   * Find documents by proposal ID.
   */
  async findByProposal(
    proposalId: string,
    workspaceId: string
  ): Promise<DocumentSelect[]> {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.proposalId, proposalId),
          eq(documents.workspaceId, workspaceId),
          isNull(documents.softDeletedAt)
        )
      )
      .orderBy(desc(documents.createdAt));
  },

  /**
   * Find document by Google Drive file ID (for deduplication).
   */
  async findByDriveFileId(
    driveFileId: string,
    workspaceId: string
  ): Promise<DocumentSelect | null> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.driveFileId, driveFileId),
          eq(documents.workspaceId, workspaceId),
          isNull(documents.softDeletedAt)
        )
      );
    return doc ?? null;
  },

  /**
   * Find all documents for a workspace (paginated).
   */
  async findByWorkspace(
    workspaceId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<DocumentSelect[]> {
    const { limit = 100, offset = 0 } = options;
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, workspaceId),
          isNull(documents.softDeletedAt)
        )
      )
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * Update document fields.
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<DocumentInsert>
  ): Promise<DocumentSelect | null> {
    const [updated] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(documents.id, id), eq(documents.workspaceId, workspaceId))
      )
      .returning();
    return updated ?? null;
  },

  /**
   * Increment view count and update last viewed timestamp.
   */
  async incrementViewCount(id: string, workspaceId: string): Promise<void> {
    await db
      .update(documents)
      .set({
        viewCount: sql`${documents.viewCount} + 1`,
        lastViewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(documents.id, id), eq(documents.workspaceId, workspaceId))
      );
  },

  /**
   * Soft delete a document.
   */
  async softDelete(
    id: string,
    workspaceId: string,
    _deletedBy: string
  ): Promise<void> {
    await db
      .update(documents)
      .set({
        softDeletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(documents.id, id), eq(documents.workspaceId, workspaceId))
      );
  },

  /**
   * Restore a soft-deleted document.
   */
  async restore(id: string, workspaceId: string): Promise<void> {
    await db
      .update(documents)
      .set({
        softDeletedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(documents.id, id), eq(documents.workspaceId, workspaceId))
      );
  },

  /**
   * Get documents needing sync (lastSyncedAt older than threshold).
   */
  async findNeedingSync(
    workspaceId: string,
    olderThanMinutes: number = 60
  ): Promise<DocumentSelect[]> {
    const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, workspaceId),
          isNull(documents.softDeletedAt),
          sql`${documents.driveFileId} IS NOT NULL`,
          sql`(${documents.lastSyncedAt} IS NULL OR ${documents.lastSyncedAt} < ${threshold})`
        )
      )
      .limit(50);
  },
};
