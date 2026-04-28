/**
 * Link repository for data access operations.
 * Phase 35-04: Auto-Insert + Velocity Control
 *
 * Provides data access for:
 * - Link suggestions
 * - Link opportunities
 * - Link graph
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { db as appDb } from "@/db";
import {
  linkSuggestions,
  linkOpportunities,
  linkGraph,
  pageLinks,
} from "@/db/link-schema";
import type {
  LinkSuggestionsSelect,
  LinkSuggestionsInsert,
  LinkOpportunitiesSelect,
} from "@/db/link-schema";

type AppDb = typeof appDb;

/**
 * Repository for link-related data operations.
 */
export class LinkRepository {
  constructor(private db: AppDb) {}

  /**
   * Get pending link suggestions for a client.
   */
  async getPendingSuggestions(
    clientId: string,
    limit = 50
  ): Promise<LinkSuggestionsSelect[]> {
    return this.db
      .select()
      .from(linkSuggestions)
      .where(
        and(
          eq(linkSuggestions.clientId, clientId),
          eq(linkSuggestions.status, "pending")
        )
      )
      .orderBy(desc(linkSuggestions.score))
      .limit(limit);
  }

  /**
   * Get auto-applicable suggestions for a client.
   */
  async getAutoApplicableSuggestions(
    clientId: string,
    limit = 10
  ): Promise<LinkSuggestionsSelect[]> {
    return this.db
      .select()
      .from(linkSuggestions)
      .where(
        and(
          eq(linkSuggestions.clientId, clientId),
          eq(linkSuggestions.status, "pending"),
          eq(linkSuggestions.isAutoApplicable, true)
        )
      )
      .orderBy(desc(linkSuggestions.score))
      .limit(limit);
  }

  /**
   * Create a new link suggestion.
   */
  async createSuggestion(
    suggestion: LinkSuggestionsInsert
  ): Promise<LinkSuggestionsSelect> {
    const [created] = await this.db
      .insert(linkSuggestions)
      .values(suggestion)
      .returning();
    return created;
  }

  /**
   * Get suggestion by ID.
   */
  async getSuggestionById(id: string): Promise<LinkSuggestionsSelect | null> {
    const [suggestion] = await this.db
      .select()
      .from(linkSuggestions)
      .where(eq(linkSuggestions.id, id));
    return suggestion ?? null;
  }

  /**
   * Get pending opportunities for a client.
   */
  async getPendingOpportunities(
    clientId: string,
    limit = 100
  ): Promise<LinkOpportunitiesSelect[]> {
    return this.db
      .select()
      .from(linkOpportunities)
      .where(
        and(
          eq(linkOpportunities.clientId, clientId),
          eq(linkOpportunities.status, "pending")
        )
      )
      .orderBy(desc(linkOpportunities.urgency))
      .limit(limit);
  }

  /**
   * Get inbound link count for a page.
   */
  async getInboundLinkCount(
    clientId: string,
    targetUrl: string
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(linkGraph)
      .where(
        and(eq(linkGraph.clientId, clientId), eq(linkGraph.targetUrl, targetUrl))
      );
    return Number(result?.count ?? 0);
  }

  /**
   * Get outbound link count for a page.
   */
  async getOutboundLinkCount(
    clientId: string,
    sourceUrl: string
  ): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(linkGraph)
      .where(
        and(eq(linkGraph.clientId, clientId), eq(linkGraph.sourceUrl, sourceUrl))
      );
    return Number(result?.count ?? 0);
  }

  /**
   * Get page link metrics.
   */
  async getPageLinkMetrics(
    clientId: string,
    pageUrl: string
  ): Promise<{ inbound: number; outbound: number }> {
    const [inbound, outbound] = await Promise.all([
      this.getInboundLinkCount(clientId, pageUrl),
      this.getOutboundLinkCount(clientId, pageUrl),
    ]);
    return { inbound, outbound };
  }

  /**
   * Get anchor distribution for a target page.
   */
  async getAnchorDistribution(
    clientId: string,
    targetUrl: string
  ): Promise<{ exact: number; branded: number; misc: number }> {
    const links = await this.db
      .select({
        isExactMatch: linkGraph.isExactMatch,
        isBranded: linkGraph.isBranded,
      })
      .from(linkGraph)
      .where(
        and(eq(linkGraph.clientId, clientId), eq(linkGraph.targetUrl, targetUrl))
      );

    let exact = 0;
    let branded = 0;
    let misc = 0;

    for (const link of links) {
      if (link.isExactMatch) {
        exact++;
      } else if (link.isBranded) {
        branded++;
      } else {
        misc++;
      }
    }

    return { exact, branded, misc };
  }
}

/**
 * Create a link repository instance with the app database.
 */
export function createLinkRepository(): LinkRepository {
  return new LinkRepository(appDb);
}
