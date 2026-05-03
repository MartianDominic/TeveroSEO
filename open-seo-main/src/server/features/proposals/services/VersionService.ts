/**
 * VersionService - CRUD operations for proposal versions
 * Phase 57-06: Auto-Save + Version History
 */
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "../../../../db";
import {
  proposalVersions,
  type ProposalVersionSelect,
  type ProposalVersionInsert,
  type ChangeType,
} from "../../../../db/schema/proposal-versions";
import { proposals, type ProposalContent } from "../../../../db/proposal-schema";

export interface CreateVersionInput {
  proposalId: string;
  content: ProposalContent;
  sectionOrder?: string[];
  changeType: ChangeType;
  changeDescription?: string;
  changeDescriptionEn?: string;
  changeDescriptionLt?: string;
  changedSections?: string[];
  createdBy?: string;
}

export interface VersionListItem {
  id: string;
  versionNumber: number;
  changeType: ChangeType;
  changeDescription: string | null;
  changeDescriptionEn: string | null;
  changeDescriptionLt: string | null;
  changedSections: string[] | null;
  createdBy: string | null;
  createdAt: Date;
}

/**
 * Service for managing proposal version history
 */
export const VersionService = {
  /**
   * Create a new version snapshot
   * HIGH-53 fix: Uses transaction with row-level locking to prevent race conditions
   * when concurrent requests try to create versions for the same proposal.
   */
  async createVersion(input: CreateVersionInput): Promise<ProposalVersionSelect> {
    // Use transaction with FOR UPDATE to prevent race condition on version numbers
    const created = await db.transaction(async (tx) => {
      // Lock and get the latest version number atomically
      // Using raw SQL for FOR UPDATE as Drizzle doesn't support it directly
      const lastVersionResult = await tx
        .select({ versionNumber: proposalVersions.versionNumber })
        .from(proposalVersions)
        .where(eq(proposalVersions.proposalId, input.proposalId))
        .orderBy(desc(proposalVersions.versionNumber))
        .limit(1)
        .for('update');

      const nextVersionNumber = (lastVersionResult[0]?.versionNumber ?? 0) + 1;

      const id = crypto.randomUUID();

      const version: ProposalVersionInsert = {
        id,
        proposalId: input.proposalId,
        versionNumber: nextVersionNumber,
        content: input.content,
        sectionOrder: input.sectionOrder,
        changeType: input.changeType,
        changeDescription: input.changeDescription,
        changeDescriptionEn: input.changeDescriptionEn,
        changeDescriptionLt: input.changeDescriptionLt,
        changedSections: input.changedSections,
        createdBy: input.createdBy,
      };

      const [inserted] = await tx
        .insert(proposalVersions)
        .values(version)
        .returning();

      return inserted;
    });

    return created;
  },

  /**
   * List all versions for a proposal (newest first)
   */
  async listVersions(proposalId: string): Promise<VersionListItem[]> {
    const versions = await db
      .select({
        id: proposalVersions.id,
        versionNumber: proposalVersions.versionNumber,
        changeType: proposalVersions.changeType,
        changeDescription: proposalVersions.changeDescription,
        changeDescriptionEn: proposalVersions.changeDescriptionEn,
        changeDescriptionLt: proposalVersions.changeDescriptionLt,
        changedSections: proposalVersions.changedSections,
        createdBy: proposalVersions.createdBy,
        createdAt: proposalVersions.createdAt,
      })
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposalId))
      .orderBy(desc(proposalVersions.versionNumber));

    return versions;
  },

  /**
   * Get a specific version by ID
   */
  async getVersion(versionId: string): Promise<ProposalVersionSelect | null> {
    const [version] = await db
      .select()
      .from(proposalVersions)
      .where(eq(proposalVersions.id, versionId))
      .limit(1);

    return version ?? null;
  },

  /**
   * Get latest version for a proposal
   */
  async getLatestVersion(
    proposalId: string
  ): Promise<ProposalVersionSelect | null> {
    const [version] = await db
      .select()
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposalId))
      .orderBy(desc(proposalVersions.versionNumber))
      .limit(1);

    return version ?? null;
  },

  /**
   * Restore a version - overwrites current proposal content
   * Creates a new version entry with type "restore"
   */
  async restoreVersion(
    versionId: string,
    restoredBy?: string
  ): Promise<ProposalVersionSelect | null> {
    const version = await this.getVersion(versionId);
    if (!version) return null;

    // Update proposal with version content
    await db
      .update(proposals)
      .set({
        content: version.content,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, version.proposalId));

    // Create restore version entry
    const restoreVersion = await this.createVersion({
      proposalId: version.proposalId,
      content: version.content,
      sectionOrder: version.sectionOrder ?? undefined,
      changeType: "restore",
      changeDescriptionEn: `Restored to version ${version.versionNumber}`,
      changeDescriptionLt: `Atkurta versija ${version.versionNumber}`,
      createdBy: restoredBy,
    });

    return restoreVersion;
  },

  /**
   * Check if content has changed significantly from last version
   * Used to determine if a new version should be created
   */
  async shouldCreateVersion(
    proposalId: string,
    newContent: ProposalContent
  ): Promise<boolean> {
    const lastVersion = await this.getLatestVersion(proposalId);

    if (!lastVersion) {
      // No versions exist, create initial
      return true;
    }

    const lastContent = lastVersion.content;

    // Compare stringified content (simple deep equality)
    const lastStr = JSON.stringify(lastContent);
    const newStr = JSON.stringify(newContent);

    if (lastStr === newStr) {
      return false;
    }

    // Check for significant changes (not just whitespace)
    // This is a simple heuristic - could be made more sophisticated
    const sizeDiff = Math.abs(newStr.length - lastStr.length);
    const percentChange = sizeDiff / lastStr.length;

    // Create version if content changed by more than 1% or more than 100 chars
    return percentChange > 0.01 || sizeDiff > 100;
  },

  /**
   * Create version only if significant changes detected
   */
  async createVersionIfSignificant(
    input: CreateVersionInput
  ): Promise<ProposalVersionSelect | null> {
    const shouldCreate = await this.shouldCreateVersion(
      input.proposalId,
      input.content
    );

    if (!shouldCreate) {
      return null;
    }

    return this.createVersion(input);
  },

  /**
   * Delete old versions, keeping only the most recent N
   */
  async pruneVersions(
    proposalId: string,
    keepCount: number = 50
  ): Promise<number> {
    const versions = await this.listVersions(proposalId);

    if (versions.length <= keepCount) {
      return 0;
    }

    const toDelete = versions.slice(keepCount);
    const idsToDelete = toDelete.map((v) => v.id);

    await db
      .delete(proposalVersions)
      .where(
        and(
          eq(proposalVersions.proposalId, proposalId),
          sql`${proposalVersions.id} = ANY(${idsToDelete})`
        )
      );

    return idsToDelete.length;
  },
};
