/**
 * Webhook processing utilities.
 * Phase 48-02: Contract & Payment - Webhook handling
 *
 * Provides shared webhook verification and idempotent processing logic.
 *
 * Security (H-59-02): Uses Redis SETNX to prevent race condition where
 * duplicate webhooks could be processed before DB idempotency write commits.
 */
import { db } from "@/db";
import { incomingWebhookEvents } from "@/db/webhook-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";
import { redis } from "@/server/lib/redis";

const log = createLogger({ module: "webhook-utils" });

// Redis key prefix for webhook idempotency locks
const WEBHOOK_LOCK_PREFIX = "webhook:lock:";
// Lock TTL in seconds (5 minutes - enough for processing + buffer)
const WEBHOOK_LOCK_TTL_SECONDS = 300;

// Dokobit IP whitelist (from API docs - verify with Dokobit support)
const DOKOBIT_IP_WHITELIST = [
  "185.44.192.0/24",
  "52.58.0.0/16", // AWS EU (Dokobit infrastructure)
];

export function isIpInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);

  const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
  const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);

  return (ipNum & mask) === (rangeNum & mask);
}

export function verifyDokobitIp(clientIp: string | null): boolean {
  if (!clientIp) return false;

  // In development, allow localhost
  if (process.env.NODE_ENV === "development" &&
      (clientIp === "127.0.0.1" || clientIp === "::1")) {
    return true;
  }

  return DOKOBIT_IP_WHITELIST.some(range => isIpInRange(clientIp, range));
}

export async function processWebhookIdempotently<T>(
  eventId: string,
  eventType: string,
  source: "dokobit" | "stripe" | "revolut",
  handler: () => Promise<T>
): Promise<T | null> {
  // H-59-02: Use Redis SETNX to acquire a distributed lock BEFORE any DB operations.
  // This closes the race window where duplicate webhooks could both pass the DB check
  // before either commits the "processing" status.
  const lockKey = `${WEBHOOK_LOCK_PREFIX}${eventId}`;

  // Try to acquire lock atomically with NX (only set if not exists) and EX (expiry)
  const lockAcquired = await redis.set(lockKey, "processing", "EX", WEBHOOK_LOCK_TTL_SECONDS, "NX");

  if (!lockAcquired) {
    // Another request is already processing this webhook
    log.info("Webhook already being processed (Redis lock exists)", { eventId, source });
    return null;
  }

  try {
    // Check if already processed in DB (for webhooks that completed before lock expired)
    const [existing] = await db
      .select()
      .from(incomingWebhookEvents)
      .where(eq(incomingWebhookEvents.eventId, eventId))
      .limit(1);

    if (existing?.status === "processed") {
      log.info("Skipping already processed webhook", { eventId, source });
      return null;
    }

    // Mark as processing in DB
    await db.insert(incomingWebhookEvents).values({
      eventId,
      eventType,
      source,
      status: "processing",
      receivedAt: new Date(),
    }).onConflictDoNothing();

    try {
      const result = await handler();

      // Mark as processed
      await db
        .update(incomingWebhookEvents)
        .set({ status: "processed", processedAt: new Date() })
        .where(eq(incomingWebhookEvents.eventId, eventId));

      return result;
    } catch (error) {
      // Mark as failed
      await db
        .update(incomingWebhookEvents)
        .set({
          status: "failed",
          error: String(error).slice(0, 2000),
          processedAt: new Date()
        })
        .where(eq(incomingWebhookEvents.eventId, eventId));
      throw error;
    }
  } finally {
    // Release the Redis lock after processing completes (success or failure)
    // The lock will auto-expire after TTL if this fails
    try {
      await redis.del(lockKey);
    } catch (redisError) {
      log.warn("Failed to release webhook Redis lock", { eventId, error: String(redisError) });
    }
  }
}
