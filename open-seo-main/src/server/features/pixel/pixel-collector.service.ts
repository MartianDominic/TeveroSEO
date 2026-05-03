/**
 * PixelCollectorService - Event collection and aggregation for TeveroPixel
 * Phase 66-02: Pixel Event Collection + Real-Time Verification
 *
 * Processes analytics events from browser pixels with <10ms target latency.
 * Uses Redis for real-time counters, batches writes to Postgres every 5 minutes.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pixelInstallations, pixelAnalyticsDaily } from "@/db/pixel-schema";
import { redis } from "@/server/lib/redis";
import { nanoid } from "nanoid";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "pixel-collector" });

// ============================================================================
// Types
// ============================================================================

export type PixelEventType = "pageview" | "scroll" | "click" | "cwv" | "ping";

export interface PixelEvent {
  siteId: string;
  event: PixelEventType;
  data: {
    url?: string;
    referrer?: string;
    userAgent?: string;
    // CWV metrics
    lcp?: number;
    cls?: number;
    inp?: number;
    // Scroll depth
    depth?: number;
    // Click data
    selector?: string;
    href?: string;
  };
  timestamp: number;
  sessionId: string;
}

export interface ProcessEventResult {
  success: boolean;
  error?: string;
  statusChanged?: boolean;
  newStatus?: string;
  processingTimeMs?: number;
}

export interface GeoData {
  city?: string;
  country?: string;
  countryCode?: string;
}

// ============================================================================
// Redis Key Helpers
// ============================================================================

function getDateKey(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function redisKey(type: string, installationId: string, suffix?: string): string {
  const date = getDateKey();
  return suffix
    ? `pixel:${type}:${installationId}:${date}:${suffix}`
    : `pixel:${type}:${installationId}:${date}`;
}

// ============================================================================
// PixelCollectorService
// ============================================================================

export class PixelCollectorService {
  /**
   * Main entry point for processing pixel events.
   * Validates siteId, updates installation status, dispatches to handlers.
   *
   * @param event - The pixel event from the browser
   * @returns Processing result with status change info
   */
  async processEvent(event: PixelEvent): Promise<ProcessEventResult> {
    const startTime = performance.now();

    try {
      // 1. Validate siteId exists in pixelInstallations
      const installations = await db
        .select()
        .from(pixelInstallations)
        .where(eq(pixelInstallations.siteId, event.siteId));

      if (installations.length === 0) {
        return {
          success: false,
          error: "SITE_NOT_FOUND",
          processingTimeMs: performance.now() - startTime,
        };
      }

      const installation = installations[0];
      const now = new Date();
      let statusChanged = false;
      let newStatus = installation.status;

      // 2. Update installation: lastPingAt, increment pingCount
      //    If firstPingAt is null, set it and change status to 'detected'
      const updateData: Record<string, unknown> = {
        lastPingAt: now,
        pingCount: sql`${pixelInstallations.pingCount} + 1`,
        updatedAt: now,
      };

      if (!installation.firstPingAt) {
        updateData.firstPingAt = now;
        updateData.status = "detected";
        statusChanged = true;
        newStatus = "detected";
      }

      await db
        .update(pixelInstallations)
        .set(updateData)
        .where(eq(pixelInstallations.id, installation.id));

      // 3. Dispatch to appropriate handler based on event type
      switch (event.event) {
        case "pageview":
          await this.handlePageview(installation.id, event);
          break;
        case "cwv":
          await this.handleCwv(installation.id, event);
          break;
        case "scroll":
          await this.handleScroll(installation.id, event);
          break;
        case "click":
          await this.handleClick(installation.id, event);
          break;
        case "ping":
          // Ping is just for verification, no additional handling needed
          break;
      }

      // 4. If status changed, publish to Redis for real-time notification
      if (statusChanged) {
        await this.notifyStatusChange(installation.id, event.siteId, newStatus);
      }

      return {
        success: true,
        statusChanged,
        newStatus: statusChanged ? newStatus : undefined,
        processingTimeMs: performance.now() - startTime,
      };
    } catch (error) {
      log.error("Error processing event", error instanceof Error ? error : new Error(String(error)), { siteId: event.siteId });
      return {
        success: false,
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        processingTimeMs: performance.now() - startTime,
      };
    }
  }

  /**
   * Handle pageview events - update daily aggregates.
   * Uses Redis for real-time counting, batch syncs to Postgres.
   */
  async handlePageview(installationId: string, event: PixelEvent): Promise<void> {
    const date = getDateKey();

    // Increment pageview counter in Redis
    await redis.incr(redisKey("pageviews", installationId));

    // Track unique sessions (visitors) in Redis set
    await redis.sadd(redisKey("sessions", installationId), event.sessionId);

    // Set TTL on keys (48 hours to allow for batch sync)
    await redis.expire(redisKey("pageviews", installationId), 172800);
    await redis.expire(redisKey("sessions", installationId), 172800);

    // Track URL-specific pageviews for top pages
    if (event.data.url) {
      const urlHash = Buffer.from(event.data.url).toString("base64").slice(0, 20);
      await redis.hincrby(
        redisKey("pages", installationId),
        urlHash,
        1
      );
      // Store URL mapping
      await redis.hset(
        redisKey("page_urls", installationId),
        urlHash,
        event.data.url
      );
      await redis.expire(redisKey("pages", installationId), 172800);
      await redis.expire(redisKey("page_urls", installationId), 172800);
    }
  }

  /**
   * Handle Core Web Vitals events - aggregate metrics.
   * Stores raw values in Redis sorted sets for p75 calculation.
   */
  async handleCwv(installationId: string, event: PixelEvent): Promise<void> {
    const timestamp = event.timestamp.toString();
    const { lcp, cls, inp } = event.data;

    // Store CWV values in sorted sets (score = value, member = unique ID)
    // This allows calculating percentiles later
    if (lcp !== undefined) {
      await redis.zadd(
        redisKey("cwv:lcp", installationId),
        lcp,
        `${timestamp}:${nanoid(6)}`
      );
    }

    if (cls !== undefined) {
      await redis.zadd(
        redisKey("cwv:cls", installationId),
        cls,
        `${timestamp}:${nanoid(6)}`
      );
    }

    if (inp !== undefined) {
      await redis.zadd(
        redisKey("cwv:inp", installationId),
        inp,
        `${timestamp}:${nanoid(6)}`
      );
    }

    // Set TTL on CWV sets
    await redis.expire(redisKey("cwv:lcp", installationId), 172800);
    await redis.expire(redisKey("cwv:cls", installationId), 172800);
    await redis.expire(redisKey("cwv:inp", installationId), 172800);
  }

  /**
   * Handle scroll depth events - track engagement milestones.
   */
  async handleScroll(installationId: string, event: PixelEvent): Promise<void> {
    const { depth } = event.data;

    if (depth === undefined) return;

    // Determine milestone bucket (25%, 50%, 75%, 100%)
    let milestone: number;
    if (depth >= 100) milestone = 100;
    else if (depth >= 75) milestone = 75;
    else if (depth >= 50) milestone = 50;
    else if (depth >= 25) milestone = 25;
    else return; // Ignore depths less than 25%

    // Increment scroll milestone counter
    await redis.incr(redisKey("scroll", installationId, milestone.toString()));
    await redis.expire(redisKey("scroll", installationId, milestone.toString()), 172800);
  }

  /**
   * Handle click events - track user interactions.
   */
  async handleClick(installationId: string, event: PixelEvent): Promise<void> {
    const { selector, href } = event.data;

    // Track total clicks
    await redis.incr(redisKey("clicks", installationId));
    await redis.expire(redisKey("clicks", installationId), 172800);

    // Track clicks by href if available (for CTA tracking)
    if (href) {
      const hrefHash = Buffer.from(href).toString("base64").slice(0, 20);
      await redis.hincrby(redisKey("click_hrefs", installationId), hrefHash, 1);
      await redis.hset(redisKey("click_href_urls", installationId), hrefHash, href);
      await redis.expire(redisKey("click_hrefs", installationId), 172800);
      await redis.expire(redisKey("click_href_urls", installationId), 172800);
    }
  }

  /**
   * Notify listeners when installation status changes.
   * Used for real-time verification UI updates.
   */
  async notifyStatusChange(
    installationId: string,
    siteId: string,
    newStatus: string,
    geoData?: GeoData
  ): Promise<void> {
    const message = JSON.stringify({
      installationId,
      siteId,
      status: newStatus,
      timestamp: Date.now(),
      geoData,
    });

    // Publish to site-specific channel for verification polling
    await redis.publish(`pixel:verified:${siteId}`, message);
  }

  /**
   * Calculate p75 for a metric from Redis sorted set.
   * Used during batch sync to Postgres.
   */
  async calculateP75(key: string): Promise<number | null> {
    const count = await redis.zcard(key);
    if (count === 0) return null;

    // p75 index (75th percentile)
    const p75Index = Math.ceil(count * 0.75) - 1;

    // Get value at p75 index
    const values = await redis.zrange(key, p75Index, p75Index, "WITHSCORES");
    if (values.length < 2) return null;

    return parseFloat(values[1]);
  }

  /**
   * Sync Redis counters to Postgres daily aggregates.
   * Called by background job every 5 minutes.
   */
  async syncDailyAggregates(installationId: string): Promise<void> {
    const date = getDateKey();
    const dateObj = new Date(date);

    // Get pageview count
    const pageviews = parseInt(
      (await redis.get(redisKey("pageviews", installationId))) || "0",
      10
    );

    // Get unique visitors (session count)
    const uniqueVisitors = await redis.scard(redisKey("sessions", installationId));

    // Calculate CWV p75 values
    const lcpP75 = await this.calculateP75(redisKey("cwv:lcp", installationId));
    const clsP75 = await this.calculateP75(redisKey("cwv:cls", installationId));
    const inpP75 = await this.calculateP75(redisKey("cwv:inp", installationId));

    // Get top pages
    const pageScores = await redis.hgetall(redisKey("pages", installationId));
    const pageUrls = await redis.hgetall(redisKey("page_urls", installationId));
    const topPages = Object.entries(pageScores)
      .map(([hash, count]) => ({
        url: pageUrls[hash] || hash,
        pageviews: parseInt(count, 10),
        uniqueVisitors: 0, // Would need per-page session tracking
      }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10);

    // Upsert into pixelAnalyticsDaily
    await db
      .insert(pixelAnalyticsDaily)
      .values({
        id: nanoid(),
        installationId,
        date: dateObj,
        pageviews,
        sessions: uniqueVisitors,
        uniqueVisitors,
        lcpP75: lcpP75?.toString() ?? null,
        clsP75: clsP75?.toString() ?? null,
        inpP75: inpP75?.toString() ?? null,
        topPages,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [pixelAnalyticsDaily.installationId, pixelAnalyticsDaily.date],
        set: {
          pageviews,
          sessions: uniqueVisitors,
          uniqueVisitors,
          lcpP75: lcpP75?.toString() ?? null,
          clsP75: clsP75?.toString() ?? null,
          inpP75: inpP75?.toString() ?? null,
          topPages,
          updatedAt: new Date(),
        },
      });
  }
}

// ============================================================================
// Singleton & Convenience Export
// ============================================================================

let collectorInstance: PixelCollectorService | null = null;

export function getPixelCollector(): PixelCollectorService {
  if (!collectorInstance) {
    collectorInstance = new PixelCollectorService();
  }
  return collectorInstance;
}

/**
 * Convenience function for processing a single event.
 * Uses the singleton collector instance.
 */
export async function processPixelEvent(
  event: PixelEvent
): Promise<ProcessEventResult> {
  return getPixelCollector().processEvent(event);
}
