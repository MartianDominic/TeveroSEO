/**
 * Webhook processing utilities.
 * Phase 48-02: Contract & Payment - Webhook handling
 *
 * Provides shared webhook verification and idempotent processing logic.
 */
import { db } from "@/db";
import { incomingWebhookEvents } from "@/db/webhook-schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "webhook-utils" });

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
  source: "dokobit" | "stripe",
  handler: () => Promise<T>
): Promise<T | null> {
  // Check if already processed
  const [existing] = await db
    .select()
    .from(incomingWebhookEvents)
    .where(eq(incomingWebhookEvents.eventId, eventId))
    .limit(1);

  if (existing?.status === "processed") {
    log.info("Skipping already processed webhook", { eventId, source });
    return null;
  }

  // Mark as processing
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
}
