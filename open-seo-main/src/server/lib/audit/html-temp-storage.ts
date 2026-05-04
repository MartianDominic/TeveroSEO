/**
 * Temporary HTML storage for audit crawl phase.
 *
 * H-AUDIT-02: Addresses memory exhaustion on large sites by streaming
 * HTML to Redis instead of holding in memory.
 *
 * - Stores HTML in Redis with TTL (auto-cleanup)
 * - Max memory impact reduced from 2GB+ to ~50MB
 * - Supports batch operations for efficiency
 */
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "html-temp-storage" });

// TTL for stored HTML (1 hour - enough for audit to complete)
const HTML_TTL_SECONDS = 3600;

// Max HTML size to store (5MB per page - truncate larger)
const MAX_HTML_SIZE = 5 * 1024 * 1024;

// Key prefix for HTML storage
const KEY_PREFIX = "audit:html:";

/**
 * Build Redis key for a page's HTML
 */
function buildKey(auditId: string, pageId: string): string {
  return `${KEY_PREFIX}${auditId}:${pageId}`;
}

/**
 * Store HTML for a crawled page in Redis.
 * Truncates HTML if it exceeds max size.
 */
export async function storePageHtml(
  auditId: string,
  pageId: string,
  html: string,
): Promise<void> {
  const redis = getSharedBullMQConnection("html-storage");
  const key = buildKey(auditId, pageId);

  // Truncate if too large
  const htmlToStore = html.length > MAX_HTML_SIZE
    ? html.slice(0, MAX_HTML_SIZE)
    : html;

  try {
    await redis.setex(key, HTML_TTL_SECONDS, htmlToStore);
  } catch (error) {
    log.warn("Failed to store HTML in Redis", {
      auditId,
      pageId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - falling back to in-memory is acceptable
  }
}

/**
 * Store HTML for multiple pages in a batch.
 * Uses Redis pipeline for efficiency.
 */
export async function storePageHtmlBatch(
  auditId: string,
  pages: Array<{ pageId: string; html: string }>,
): Promise<void> {
  if (pages.length === 0) return;

  const redis = getSharedBullMQConnection("html-storage");
  const pipeline = redis.pipeline();

  for (const { pageId, html } of pages) {
    const key = buildKey(auditId, pageId);
    const htmlToStore = html.length > MAX_HTML_SIZE
      ? html.slice(0, MAX_HTML_SIZE)
      : html;
    pipeline.setex(key, HTML_TTL_SECONDS, htmlToStore);
  }

  try {
    await pipeline.exec();
  } catch (error) {
    log.warn("Failed to store HTML batch in Redis", {
      auditId,
      pageCount: pages.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Retrieve HTML for a page from Redis.
 * Returns null if not found or expired.
 */
export async function getPageHtml(
  auditId: string,
  pageId: string,
): Promise<string | null> {
  const redis = getSharedBullMQConnection("html-storage");
  const key = buildKey(auditId, pageId);

  try {
    return await redis.get(key);
  } catch (error) {
    log.warn("Failed to get HTML from Redis", {
      auditId,
      pageId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Retrieve HTML for multiple pages in a batch.
 * Returns a Map of pageId -> html (null for missing pages).
 */
export async function getPageHtmlBatch(
  auditId: string,
  pageIds: string[],
): Promise<Map<string, string | null>> {
  if (pageIds.length === 0) return new Map();

  const redis = getSharedBullMQConnection("html-storage");
  const keys = pageIds.map((pageId) => buildKey(auditId, pageId));
  const result = new Map<string, string | null>();

  try {
    const values = await redis.mget(...keys);
    for (let i = 0; i < pageIds.length; i++) {
      result.set(pageIds[i], values[i]);
    }
  } catch (error) {
    log.warn("Failed to get HTML batch from Redis", {
      auditId,
      pageCount: pageIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty results on error
    for (const pageId of pageIds) {
      result.set(pageId, null);
    }
  }

  return result;
}

/**
 * Delete all HTML for an audit.
 * Called after audit completes to free up Redis memory.
 */
export async function clearAuditHtml(auditId: string): Promise<void> {
  const redis = getSharedBullMQConnection("html-storage");
  const pattern = `${KEY_PREFIX}${auditId}:*`;

  try {
    // Use SCAN to find keys (safer than KEYS for large datasets)
    let cursor = "0";
    const keysToDelete: string[] = [];

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== "0");

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete);
      log.info("Cleared audit HTML from Redis", {
        auditId,
        keysDeleted: keysToDelete.length,
      });
    }
  } catch (error) {
    log.warn("Failed to clear audit HTML from Redis", {
      auditId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const HtmlTempStorage = {
  storePageHtml,
  storePageHtmlBatch,
  getPageHtml,
  getPageHtmlBatch,
  clearAuditHtml,
} as const;
