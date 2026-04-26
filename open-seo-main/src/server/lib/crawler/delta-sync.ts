/**
 * Delta Sync Service
 *
 * Change detection using split hashes for efficient recurring crawls.
 * Per IMPLEMENTATION-FIXES.md Fix 1: Split content hash for delta crawling.
 *
 * Three separate hashes serve different purposes:
 * - seoContentHash: name + description + categories (stable, for delta crawling)
 * - inventoryHash: price + stock (volatile, for inventory tracking)
 * - fullHash: everything (for debugging/audit trail)
 */

import { createHash } from "crypto";
import {
  pageSnapshots,
  type PageSnapshot,
  type NewPageSnapshot,
} from "@/db/crawl-schema";
import { eq, and, gt } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

// Lazy-load db to enable pure function testing without DB connection
// Per 34-02 pattern: Lazy-load repository to enable pure function testing
let _db: typeof import("@/db").db | null = null;
function getDb(): typeof import("@/db").db {
  if (!_db) {
    // Dynamic import at runtime only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _db = require("@/db").db;
  }
  return _db!;
}

const _log = createLogger({ module: "delta-sync" }); // TODO: Add logging in Phase 43

/**
 * Change types for delta sync decision making.
 *
 * Per Fix 1 in IMPLEMENTATION-FIXES.md:
 * - SEO_MODIFY: name, description, or categories changed -> full re-extraction
 * - PRICE_UPDATE: only price/stock changed -> update node properties only
 * - UNCHANGED: skip entirely
 */
export enum ChangeType {
  ADD = "add",
  SEO_MODIFY = "seo_modify",
  PRICE_UPDATE = "price_update",
  DELETE = "delete",
  UNCHANGED = "unchanged",
}

export interface ProductData {
  name: string;
  description: string;
  categories: string[];
  brand?: string;
  price?: number;
  inStock?: boolean;
  sku?: string;
}

export interface HashSet {
  seoContentHash: string;
  inventoryHash: string;
  fullHash: string;
}

/**
 * Compute three separate hashes for different change detection needs.
 *
 * - seoContentHash: name + description + categories (stable, for delta crawling)
 * - inventoryHash: price + stock (volatile, for inventory tracking)
 * - fullHash: everything (for audit trail)
 */
export function computeHashes(data: ProductData): HashSet {
  // SEO content hash - EXCLUDES price/stock
  const seoParts = [
    data.name,
    data.description,
    data.categories.join("|"),
    data.brand ?? "",
  ];
  const seoContentHash = createHash("sha256")
    .update(seoParts.filter(Boolean).join("|"))
    .digest("hex")
    .slice(0, 16);

  // Inventory hash - ONLY price/stock
  const invParts = [
    String(data.price ?? ""),
    String(data.inStock ?? ""),
    data.sku ?? "",
  ];
  const inventoryHash = createHash("sha256")
    .update(invParts.join("|"))
    .digest("hex")
    .slice(0, 16);

  // Full hash - everything
  const fullHash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16);

  return { seoContentHash, inventoryHash, fullHash };
}

/**
 * Detect change type by comparing old and new hash sets.
 */
export function detectChange(
  oldHashes: HashSet | null,
  newHashes: HashSet
): ChangeType {
  if (!oldHashes) {
    return ChangeType.ADD;
  }

  if (oldHashes.seoContentHash !== newHashes.seoContentHash) {
    // Name, description, or categories changed
    // Requires full re-extraction + re-embedding
    return ChangeType.SEO_MODIFY;
  }

  if (oldHashes.inventoryHash !== newHashes.inventoryHash) {
    // Only price/stock changed
    // Just update node properties, skip NLP/embedding
    return ChangeType.PRICE_UPDATE;
  }

  return ChangeType.UNCHANGED;
}

/**
 * Delta sync service for managing crawl state and change detection.
 */
export class DeltaSyncService {
  /**
   * Get all snapshots for a tenant modified after a certain date.
   */
  async getSnapshots(
    tenantId: string,
    sinceDate?: Date
  ): Promise<PageSnapshot[]> {
    const db = getDb();
    if (sinceDate) {
      return db
        .select()
        .from(pageSnapshots)
        .where(
          and(
            eq(pageSnapshots.tenantId, tenantId),
            gt(pageSnapshots.lastCrawled, sinceDate)
          )
        );
    }
    return db
      .select()
      .from(pageSnapshots)
      .where(eq(pageSnapshots.tenantId, tenantId));
  }

  /**
   * Get snapshot for a specific URL.
   */
  async getSnapshot(
    tenantId: string,
    url: string
  ): Promise<PageSnapshot | null> {
    const db = getDb();
    const urlHash = this.hashUrl(url);
    const results = await db
      .select()
      .from(pageSnapshots)
      .where(
        and(
          eq(pageSnapshots.tenantId, tenantId),
          eq(pageSnapshots.urlHash, urlHash)
        )
      )
      .limit(1);
    return results[0] ?? null;
  }

  /**
   * Update or create snapshot for a URL.
   */
  async upsertSnapshot(snapshot: NewPageSnapshot): Promise<void> {
    const db = getDb();
    const urlHash = this.hashUrl(snapshot.url);
    const existing = await this.getSnapshot(snapshot.tenantId, snapshot.url);

    if (existing) {
      await db
        .update(pageSnapshots)
        .set({
          seoContentHash: snapshot.seoContentHash,
          inventoryHash: snapshot.inventoryHash,
          etag: snapshot.etag,
          lastModified: snapshot.lastModified,
          lastCrawled: new Date(),
        })
        .where(eq(pageSnapshots.id, existing.id));
    } else {
      await db.insert(pageSnapshots).values({
        ...snapshot,
        urlHash,
        lastCrawled: new Date(),
      });
    }
  }

  /**
   * Batch detect changes for multiple URLs.
   * Returns map of URL -> ChangeType.
   */
  async batchDetectChanges(
    tenantId: string,
    newData: Map<string, ProductData>
  ): Promise<Map<string, ChangeType>> {
    const results = new Map<string, ChangeType>();
    const urls = Array.from(newData.keys());

    // Get all existing snapshots for this tenant
    const snapshots = await this.getSnapshots(tenantId);
    const snapshotMap = new Map<string, PageSnapshot>();
    for (const s of snapshots) {
      snapshotMap.set(s.url, s);
    }

    for (const url of urls) {
      const data = newData.get(url)!;
      const newHashes = computeHashes(data);
      const existing = snapshotMap.get(url);

      const oldHashes = existing
        ? {
            seoContentHash: existing.seoContentHash,
            inventoryHash: existing.inventoryHash ?? "",
            fullHash: "", // Not stored, not needed for comparison
          }
        : null;

      results.set(url, detectChange(oldHashes, newHashes));
    }

    return results;
  }

  /**
   * Calculate unchanged ratio for a batch of changes.
   * Used to verify delta sync effectiveness (should be > 80% for stable sites).
   */
  getUnchangedRatio(changes: Map<string, ChangeType>): number {
    const total = changes.size;
    if (total === 0) return 0;

    let unchanged = 0;
    for (const type of changes.values()) {
      if (type === ChangeType.UNCHANGED) {
        unchanged++;
      }
    }
    return unchanged / total;
  }

  /**
   * Hash a URL for storage and lookup.
   * Normalizes URL before hashing.
   */
  private hashUrl(url: string): string {
    // Normalize URL before hashing
    const normalized = url.toLowerCase().replace(/\/$/, "");
    return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  }
}

/**
 * Detect changes for a list of extracted products.
 * Convenience function for pipeline integration.
 */
export async function detectChanges(
  tenantId: string,
  products: Array<{ url: string; data: ProductData }>
): Promise<Map<string, ChangeType>> {
  const service = new DeltaSyncService();
  const dataMap = new Map<string, ProductData>();
  for (const { url, data } of products) {
    dataMap.set(url, data);
  }
  return service.batchDetectChanges(tenantId, dataMap);
}
