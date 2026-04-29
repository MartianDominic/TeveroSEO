import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { sortBy } from "remeda";

export const CACHE_TTL = {
  /** Related keyword research results */
  researchResult: 86400,
} as const;

const CACHE_ROOT = path.resolve(process.cwd(), ".data", "dataforseo-cache");

interface CacheEnvelope<T> {
  expiresAt: number; // ms epoch
  data: T;
}

export async function buildCacheKey(
  prefix: string,
  params: Record<string, unknown>,
): Promise<string> {
  const raw = JSON.stringify(
    Object.fromEntries(sortBy(Object.entries(params), ([key]) => key)),
  );
  return `${prefix}:${sha256Hex(raw)}`;
}

function keyToPath(key: string): string {
  let safe = key.replace(/[\0]/g, "_");

  // Recursively remove path traversal sequences (handles ....// -> ../ cases)
  let prev = "";
  while (prev !== safe) {
    prev = safe;
    safe = safe.replace(/\.\.\//g, "_").replace(/\.\.\\/g, "_");
  }

  // Replace remaining path separators and colons
  safe = safe.replace(/[/:\\]/g, "__");

  // Final validation: resolve and check it stays within CACHE_ROOT
  const resolved = path.resolve(CACHE_ROOT, `${safe}.json`);
  if (!resolved.startsWith(path.resolve(CACHE_ROOT))) {
    throw new Error("Path traversal detected in cache key");
  }

  return resolved;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(CACHE_ROOT, { recursive: true });
}

export async function getCached(key: string): Promise<unknown> {
  try {
    const raw = await fs.readFile(keyToPath(key), "utf8");
    const envelope = JSON.parse(raw) as CacheEnvelope<unknown>;
    if (typeof envelope.expiresAt !== "number" || envelope.expiresAt < Date.now()) {
      return null;
    }
    return envelope.data;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
}

export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  await ensureDir();
  const envelope: CacheEnvelope<T> = {
    expiresAt: Date.now() + ttlSeconds * 1000,
    data,
  };
  const filePath = keyToPath(key);
  const tempPath = `${filePath}.${randomUUID()}.tmp`;

  // Atomic write pattern: write to temp file, then rename
  // This prevents concurrent reads from getting partial data
  try {
    await fs.writeFile(tempPath, JSON.stringify(envelope), "utf8");
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// ============================================================================
// Cache File Cleanup
// ============================================================================

import { readdir, unlink } from "node:fs/promises";

/**
 * Clean up expired cache files from the local filesystem.
 * Should be called periodically (e.g., daily cron job) to prevent disk exhaustion.
 *
 * @returns Number of files cleaned up
 */
export async function cleanupExpiredCacheFiles(): Promise<number> {
  let cleaned = 0;

  try {
    await fs.access(CACHE_ROOT);
  } catch {
    // Cache directory doesn't exist yet - nothing to clean
    return 0;
  }

  try {
    const files = await readdir(CACHE_ROOT);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(CACHE_ROOT, file);
      try {
        const content = await fs.readFile(filePath, "utf8");
        const envelope = JSON.parse(content) as CacheEnvelope<unknown>;

        // Check if expired
        if (typeof envelope.expiresAt === "number" && envelope.expiresAt < Date.now()) {
          await unlink(filePath);
          cleaned++;
        }
      } catch {
        // Skip corrupted or unreadable files - don't delete them
        // as they might be in-progress writes
      }
    }
  } catch (err) {
    // Log but don't throw - cleanup is best-effort
    console.error("[r2-cache] Failed to cleanup expired files:", err);
  }

  return cleaned;
}

/**
 * Get count of cache files for monitoring.
 */
export async function getCacheFileCount(): Promise<number> {
  try {
    await fs.access(CACHE_ROOT);
    const files = await readdir(CACHE_ROOT);
    return files.filter((f) => f.endsWith(".json")).length;
  } catch {
    return 0;
  }
}
