/**
 * Redis-backed crawl progress store (Phase 3).
 *
 * Replaces the Phase-2 in-memory Map stub. Entries are persisted under the
 * key `audit-progress:<auditId>` as a JSON array of CrawledUrlEntry objects,
 * with a 30-minute TTL refreshed on every push.
 *
 * The merge + cap semantics (newest-first, MAX_ENTRIES=300) are preserved
 * from Phase 2 because callers in siteAuditWorkflowCrawl.ts and
 * siteAuditWorkflowPhases.ts rely on this ordering.
 */
import { z } from "zod";
import { redis } from "@/server/lib/redis";

const KV_PREFIX = "audit-progress:" as const;
const TTL_SECONDS = 30 * 60; // 30 minutes — matches Phase-2 in-memory TTL
const MAX_ENTRIES = 300;

const crawledUrlEntrySchema = z.object({
  url: z.string(),
  statusCode: z.number(),
  title: z.string(),
  crawledAt: z.number(),
});

type CrawledUrlEntry = z.infer<typeof crawledUrlEntrySchema>;

const crawledUrlArraySchema = z.array(crawledUrlEntrySchema);

function key(auditId: string): string {
  return `${KV_PREFIX}${auditId}`;
}

async function readEntries(auditId: string): Promise<CrawledUrlEntry[]> {
  const raw = await redis.get(key(auditId));
  if (raw === null) return [];
  try {
    const parsed = JSON.parse(raw);
    const result = crawledUrlArraySchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

async function pushCrawledUrl(auditId: string, entry: CrawledUrlEntry): Promise<void> {
  await pushCrawledUrls(auditId, [entry]);
}

async function pushCrawledUrls(
  auditId: string,
  nextEntries: CrawledUrlEntry[],
): Promise<void> {
  if (nextEntries.length === 0) return;
  const current = await readEntries(auditId);
  const merged = [...nextEntries, ...current].slice(0, MAX_ENTRIES);
  await redis.set(key(auditId), JSON.stringify(merged), "EX", TTL_SECONDS);
}

async function getCrawledUrls(auditId: string): Promise<CrawledUrlEntry[]> {
  return readEntries(auditId);
}

async function clear(auditId: string): Promise<void> {
  await redis.del(key(auditId));
}

export const AuditProgressKV = {
  pushCrawledUrl,
  pushCrawledUrls,
  getCrawledUrls,
  clear,
} as const;
