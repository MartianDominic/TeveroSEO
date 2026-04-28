import { PostHog } from "posthog-node";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "posthog" });

/** Returns a one-shot PostHog client, or null if the key is missing. Caller must shut down after use. */
function getServerPostHogClient(): PostHog | null {
  const apiKey = process.env.POSTHOG_PUBLIC_KEY?.trim();
  const host = process.env.POSTHOG_HOST?.trim();
  if (!apiKey || !host) return null;

  return new PostHog(apiKey, {
    host,
    flushAt: 20,
    flushInterval: 10_000,
  });
}

export async function captureServerError(
  error: unknown,
  properties: Record<string, string | null | undefined> = {},
) {
  const client = getServerPostHogClient();
  if (!client) return;

  try {
    await client.captureExceptionImmediate(error, undefined, {
      source: "server",
      ...properties,
    });
  } catch (posthogError) {
    log.error("Server capture failed", posthogError instanceof Error ? posthogError : new Error(String(posthogError)));
  } finally {
    await client.shutdown().catch(() => {});
  }
}

export async function captureServerEvent(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  organizationId: string;
}) {
  const client = getServerPostHogClient();
  if (!client) return;

  try {
    client.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties,
      groups: {
        organization: args.organizationId,
      },
    });
  } catch (posthogError) {
    log.error("Server capture failed", posthogError instanceof Error ? posthogError : new Error(String(posthogError)));
  } finally {
    await client.shutdown().catch(() => {});
  }
}
