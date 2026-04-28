/**
 * Sandboxed processor for webhook delivery.
 * Phase 18.5: Delivers webhooks with HMAC signing.
 */
import { createHmac } from "crypto";
import type { Job } from "bullmq";
import { createLogger } from "@/server/lib/logger";
import type { WebhookDeliveryJobData } from "@/server/queues/webhookQueue";
import { updateDeliveryStatus } from "@/services/webhooks";
import { validateWebhookUrl } from "@/server/lib/webhook-url-policy";

const log = createLogger({ module: "webhook-processor" });

const TIMEOUT_MS = 30000; // 30 second timeout

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 */
function generateSignature(
  secret: string,
  timestamp: number,
  payload: string,
): string {
  const signedPayload = `${timestamp}.${payload}`;
  return createHmac("sha256", secret).update(signedPayload).digest("hex");
}

/**
 * Deliver a webhook with retry handling.
 */
async function deliverWebhook(
  job: Job<WebhookDeliveryJobData>,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const { deliveryId, url, secret, headers, payload } = job.data;

  // SECURITY: Re-validate URL at delivery time to prevent SSRF
  // This catches any bypass from webhook URL being modified after creation
  try {
    await validateWebhookUrl(url);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "URL validation failed";
    log.warn("Webhook URL validation failed", { deliveryId, url, error: errorMessage });
    return { success: false, error: `SSRF protection: ${errorMessage}` };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payloadString = JSON.stringify(payload);

  // Generate HMAC signature
  const signature = generateSignature(secret, timestamp, payloadString);

  // Build headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Tevero-Webhooks/1.0",
    "X-Webhook-Id": payload.id,
    "X-Webhook-Timestamp": timestamp.toString(),
    "X-Webhook-Signature": `v1=${signature}`,
    ...headers,
  };

  log.info("Delivering webhook", {
    deliveryId,
    url,
    eventType: payload.type,
    attempt: job.attemptsMade + 1,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: requestHeaders,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => "");

    if (response.ok) {
      log.info("Webhook delivered successfully", {
        deliveryId,
        statusCode: response.status,
      });
      return { success: true, statusCode: response.status };
    }

    log.warn("Webhook delivery failed", {
      deliveryId,
      statusCode: response.status,
      responseBody: responseBody.slice(0, 500),
    });

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";

    if (errorMessage.includes("abort")) {
      log.warn("Webhook delivery timed out", { deliveryId, url });
      return { success: false, error: `Timeout after ${TIMEOUT_MS}ms` };
    }

    log.error(
      "Webhook delivery error",
      err instanceof Error ? err : new Error(errorMessage),
      { deliveryId, url },
    );

    return { success: false, error: errorMessage };
  }
}

/**
 * Main processor function.
 */
export default async function processor(
  job: Job<WebhookDeliveryJobData>,
): Promise<{ delivered: boolean }> {
  const { deliveryId } = job.data;
  const jobLogger = createLogger({ module: "webhook-processor", jobId: job.id });

  jobLogger.info("Processing webhook delivery", {
    deliveryId,
    attempt: job.attemptsMade + 1,
    maxAttempts: job.opts.attempts ?? 3,
  });

  const result = await deliverWebhook(job);

  if (result.success) {
    // Mark as delivered
    await updateDeliveryStatus(deliveryId, "delivered", {
      responseStatus: result.statusCode,
    });
    return { delivered: true };
  }

  // Check if this was the last attempt
  const maxAttempts = job.opts.attempts ?? 3;
  const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

  if (isLastAttempt) {
    // Mark as exhausted (moved to DLQ)
    await updateDeliveryStatus(deliveryId, "exhausted", {
      responseStatus: result.statusCode,
      error: result.error,
    });
    jobLogger.warn("Webhook delivery exhausted", {
      deliveryId,
      attempts: job.attemptsMade + 1,
    });
    return { delivered: false };
  }

  // Mark as failed (will retry)
  await updateDeliveryStatus(deliveryId, "failed", {
    responseStatus: result.statusCode,
    error: result.error,
  });

  // Throw to trigger BullMQ retry
  throw new Error(`Webhook delivery failed: ${result.error}`);
}
