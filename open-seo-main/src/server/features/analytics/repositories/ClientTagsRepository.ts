/**
 * Client Tags Repository
 * Phase 96-02: Master Dashboard
 *
 * Handles client-level tag operations for agency organization.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '@/db';
import { clientTags, type ClientTag, type ClientTagInsert } from '@/db/analytics-tags-schema';

export class ClientTagsRepository {
  constructor(private db: DbClient) {}

  async findByClientId(clientId: string): Promise<ClientTag[]> {
    return this.db.select().from(clientTags).where(eq(clientTags.clientId, clientId));
  }

  async findByTagName(tagName: string): Promise<ClientTag[]> {
    return this.db.select().from(clientTags).where(eq(clientTags.tagName, tagName));
  }

  /**
   * Find all client IDs that have any of the specified tags.
   */
  async findClientIdsByTags(tagNames: string[]): Promise<string[]> {
    if (tagNames.length === 0) return [];

    const results = await this.db
      .selectDistinct({ clientId: clientTags.clientId })
      .from(clientTags)
      .where(inArray(clientTags.tagName, tagNames));

    return results.map((r: any) => r.clientId);
  }

  /**
   * Find all tags for multiple clients.
   */
  async findByClientIds(clientIds: string[]): Promise<ClientTag[]> {
    if (clientIds.length === 0) return [];

    return this.db.select().from(clientTags).where(inArray(clientTags.clientId, clientIds));
  }

  async create(tag: ClientTagInsert): Promise<ClientTag> {
    const [created] = await this.db.insert(clientTags).values(tag).returning();
    return created;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(clientTags).where(eq(clientTags.id, id));
  }

  /**
   * Get all unique tag names with usage counts.
   */
  async getAllUniqueTags(): Promise<Array<{ name: string; count: number }>> {
    const results = await this.db
      .select({
        name: clientTags.tagName,
        count: sql<number>`count(*)::int`,
      })
      .from(clientTags)
      .groupBy(clientTags.tagName)
      .orderBy(sql`count(*) DESC`);

    return results;
  }
}
