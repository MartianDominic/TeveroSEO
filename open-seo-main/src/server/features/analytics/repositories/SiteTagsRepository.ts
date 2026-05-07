/**
 * Site Tags Repository
 * Phase 96-02: Master Dashboard
 *
 * Handles site-level tag operations for multi-site filtering.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import type { DbClient } from '@/db';
import { siteTags, type SiteTag, type SiteTagInsert } from '@/db/analytics-tags-schema';

export class SiteTagsRepository {
  constructor(private db: DbClient) {}

  async findBySiteId(siteId: string): Promise<SiteTag[]> {
    return this.db.select().from(siteTags).where(eq(siteTags.siteId, siteId));
  }

  async findByTagName(tagName: string): Promise<SiteTag[]> {
    return this.db.select().from(siteTags).where(eq(siteTags.tagName, tagName));
  }

  /**
   * Find all site IDs that have any of the specified tags.
   * Used for dashboard filtering.
   */
  async findSiteIdsByTags(tagNames: string[]): Promise<string[]> {
    if (tagNames.length === 0) return [];

    const results = await this.db
      .selectDistinct({ siteId: siteTags.siteId })
      .from(siteTags)
      .where(inArray(siteTags.tagName, tagNames));

    return results.map((r: any) => r.siteId);
  }

  /**
   * Find all tags for multiple sites (for dashboard display).
   * Returns map of siteId -> tag names.
   */
  async findBySiteIds(siteIds: string[]): Promise<SiteTag[]> {
    if (siteIds.length === 0) return [];

    return this.db.select().from(siteTags).where(inArray(siteTags.siteId, siteIds));
  }

  async create(tag: SiteTagInsert): Promise<SiteTag> {
    const [created] = await this.db.insert(siteTags).values(tag).returning();
    return created;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(siteTags).where(eq(siteTags.id, id));
  }

  /**
   * Get all unique tag names with usage counts.
   * Used for tag filter dropdown.
   */
  async getAllUniqueTags(): Promise<Array<{ name: string; count: number }>> {
    const results = await this.db
      .select({
        name: siteTags.tagName,
        count: sql<number>`count(*)::int`,
      })
      .from(siteTags)
      .groupBy(siteTags.tagName)
      .orderBy(sql`count(*) DESC`);

    return results;
  }
}
