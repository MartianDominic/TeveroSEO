/**
 * ActivityService - Portal activity tracking.
 * Phase 90-01: Trust Foundation
 *
 * Tracks work done for clients displayed in the portal activity feed.
 * Categories: content, technical, links, tracking, analytics, communication.
 *
 * Uses portalActivities table from portal-schema.ts.
 */
import {
  db,
  portalActivities,
  type PortalActivitySelect,
  type PortalActivityInsert,
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
} from "@/db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ActivityService" });

/**
 * Options for filtering and paginating activities.
 */
export interface GetActivitiesOptions {
  /** Filter by category */
  category?: ActivityCategory;
  /** Maximum number of results (default: 50) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
}

/**
 * Activity stats by category.
 */
export interface ActivityStats {
  category: string;
  count: number;
}

/**
 * ActivityService provides CRUD operations for portal activities.
 *
 * Activities track work done for clients:
 * - Content: blog posts, landing pages, content updates
 * - Technical: meta tags, schema markup, site speed
 * - Links: backlinks built, internal linking
 * - Tracking: GA4, GTM, pixel setup
 * - Analytics: reports, audits, analysis
 * - Communication: meetings, emails, calls
 */
export class ActivityService {
  /**
   * Get activities for a client with optional filtering and pagination.
   *
   * @param clientId - Client UUID
   * @param options - Filter and pagination options
   * @returns Activities sorted by createdAt descending
   */
  static async getClientActivities(
    clientId: string,
    options: GetActivitiesOptions = {}
  ): Promise<PortalActivitySelect[]> {
    const { category, limit = 50, offset = 0 } = options;

    log.debug("Fetching client activities", { clientId, category, limit, offset });

    // Build query with optional category filter
    const conditions = [eq(portalActivities.clientId, clientId)];

    if (category && ACTIVITY_CATEGORIES.includes(category)) {
      conditions.push(eq(portalActivities.category, category));
    }

    const activities = await db
      .select()
      .from(portalActivities)
      .where(and(...conditions))
      .orderBy(desc(portalActivities.createdAt))
      .limit(limit)
      .offset(offset);

    return activities;
  }

  /**
   * Create a new activity entry.
   *
   * @param data - Activity data to insert
   * @returns Created activity with generated ID
   * @throws Error if category is invalid
   */
  static async createActivity(
    data: PortalActivityInsert
  ): Promise<PortalActivitySelect> {
    // Validate category
    if (!ACTIVITY_CATEGORIES.includes(data.category as ActivityCategory)) {
      throw new Error(
        `Invalid category: ${data.category}. Must be one of: ${ACTIVITY_CATEGORIES.join(", ")}`
      );
    }

    // Sanitize artifacts to ensure proper structure
    const sanitizedArtifacts = Array.isArray(data.artifacts)
      ? data.artifacts.map((a) => ({
          label: String(a.label || "").slice(0, 255),
          url: String(a.url || "").slice(0, 2048),
        }))
      : [];

    log.debug("Creating activity", {
      clientId: data.clientId,
      category: data.category,
      title: data.title,
    });

    const [created] = await db
      .insert(portalActivities)
      .values({
        ...data,
        artifacts: sanitizedArtifacts,
      })
      .returning();

    log.info("Activity created", {
      activityId: created.id,
      clientId: created.clientId,
      category: created.category,
    });

    return created;
  }

  /**
   * Get activity counts by category for a date range.
   *
   * @param clientId - Client UUID
   * @param startDate - Start of date range
   * @param endDate - End of date range
   * @returns Array of { category, count } objects
   */
  static async getActivityStats(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityStats[]> {
    log.debug("Fetching activity stats", {
      clientId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const stats = await db
      .select({
        category: portalActivities.category,
        count: sql<number>`count(*)::int`,
      })
      .from(portalActivities)
      .where(
        and(
          eq(portalActivities.clientId, clientId),
          gte(portalActivities.createdAt, startDate),
          lte(portalActivities.createdAt, endDate)
        )
      )
      .groupBy(portalActivities.category);

    return stats.map((s) => ({
      category: s.category,
      count: Number(s.count),
    }));
  }

  /**
   * Get a single activity by ID.
   *
   * @param activityId - Activity UUID
   * @returns Activity or null if not found
   */
  static async getActivityById(
    activityId: string
  ): Promise<PortalActivitySelect | null> {
    const [activity] = await db
      .select()
      .from(portalActivities)
      .where(eq(portalActivities.id, activityId))
      .limit(1);

    return activity ?? null;
  }

  /**
   * Count total activities for a client.
   *
   * @param clientId - Client UUID
   * @param category - Optional category filter
   * @returns Total count
   */
  static async countActivities(
    clientId: string,
    category?: ActivityCategory
  ): Promise<number> {
    const conditions = [eq(portalActivities.clientId, clientId)];

    if (category && ACTIVITY_CATEGORIES.includes(category)) {
      conditions.push(eq(portalActivities.category, category));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(portalActivities)
      .where(and(...conditions));

    return Number(result?.count ?? 0);
  }
}
