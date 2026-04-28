/**
 * Clerk webhook handler API route.
 * Phase 40: Authorization Cache Invalidation
 *
 * Handles Clerk webhook events for membership changes.
 * Invalidates authorization caches when users join or leave organizations.
 *
 * Supported events:
 * - organizationMembership.created - User joined organization
 * - organizationMembership.deleted - User left/removed from organization
 * - organization.deleted - Organization deleted (all members affected)
 */
import { createFileRoute } from "@tanstack/react-router";
import { createLogger } from "@/server/lib/logger";
import { verifyWebhookSignature } from "@/server/middleware/webhook-auth";
import {
  invalidateUserAccessCaches,
  invalidateAllClientAccessCaches,
} from "@/server/middleware/authz";
import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { eq } from "drizzle-orm";

const log = createLogger({ module: "api/clerk/webhook" });

/**
 * Clerk webhook event types we handle.
 */
type ClerkWebhookEvent =
  | {
      type: "organizationMembership.created";
      data: {
        id: string;
        organization: { id: string };
        public_user_data: { user_id: string };
      };
    }
  | {
      type: "organizationMembership.deleted";
      data: {
        id: string;
        organization: { id: string };
        public_user_data: { user_id: string };
      };
    }
  | {
      type: "organization.deleted";
      data: { id: string };
    };

/**
 * Handle organizationMembership.created event.
 * When a user joins an organization, their access cache needs to be refreshed
 * to pick up the new access rights.
 */
async function handleMembershipCreated(
  data: ClerkWebhookEvent & { type: "organizationMembership.created" }
): Promise<void> {
  const userId = data.data.public_user_data.user_id;
  const orgId = data.data.organization.id;

  log.info("Processing membership created event", { userId, orgId });

  // Invalidate user's access caches so new access is picked up on next request
  try {
    await invalidateUserAccessCaches(userId);
    log.info("Invalidated user access caches after membership created", {
      userId,
      orgId,
    });
  } catch (err) {
    log.warn("Failed to invalidate user access caches", {
      userId,
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Handle organizationMembership.deleted event.
 * CRITICAL: When a user is removed from an organization, their cached access
 * must be invalidated immediately to prevent unauthorized access.
 */
async function handleMembershipDeleted(
  data: ClerkWebhookEvent & { type: "organizationMembership.deleted" }
): Promise<void> {
  const userId = data.data.public_user_data.user_id;
  const orgId = data.data.organization.id;

  log.info("Processing membership deleted event", { userId, orgId });

  // CRITICAL: Invalidate user's access caches immediately
  try {
    await invalidateUserAccessCaches(userId);
    log.info("Invalidated user access caches after membership deleted", {
      userId,
      orgId,
    });
  } catch (err) {
    // Log at error level since this is a security-critical operation
    log.error(
      "SECURITY: Failed to invalidate user access caches after membership removal",
      err instanceof Error ? err : new Error(String(err)),
      { userId, orgId }
    );
  }
}

/**
 * Handle organization.deleted event.
 * When an organization is deleted, all clients in that org need their
 * access caches invalidated.
 */
async function handleOrganizationDeleted(
  data: ClerkWebhookEvent & { type: "organization.deleted" }
): Promise<void> {
  const orgId = data.data.id;

  log.info("Processing organization deleted event", { orgId });

  // Find all clients in this organization and invalidate their caches
  try {
    const orgClients = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.workspaceId, orgId));

    for (const client of orgClients) {
      await invalidateAllClientAccessCaches(client.id);
    }

    log.info("Invalidated client access caches for deleted organization", {
      orgId,
      clientCount: orgClients.length,
    });
  } catch (err) {
    log.error(
      "SECURITY: Failed to invalidate client caches after organization deletion",
      err instanceof Error ? err : new Error(String(err)),
      { orgId }
    );
  }
}

// @ts-expect-error Route type not yet in FileRoutesByPath - regenerate with `pnpm tanstack-router generate`
export const Route = createFileRoute("/api/clerk/webhook")({
  server: {
    handlers: {
      // POST /api/clerk/webhook - Handle Clerk webhook events
      POST: async ({ request }: { request: Request }) => {
        try {
          // Verify webhook signature using Svix
          const result = await verifyWebhookSignature("clerk", request);

          if (!result.verified) {
            log.warn("Clerk webhook signature verification failed", {
              error: result.error,
            });
            return new Response(result.error ?? "Invalid signature", {
              status: 401,
            });
          }

          // Parse the event
          const event = JSON.parse(result.payload!) as ClerkWebhookEvent;

          log.info("Received Clerk webhook", { type: event.type });

          // Process based on event type
          switch (event.type) {
            case "organizationMembership.created":
              await handleMembershipCreated(event);
              break;

            case "organizationMembership.deleted":
              await handleMembershipDeleted(event);
              break;

            case "organization.deleted":
              await handleOrganizationDeleted(event);
              break;

            default:
              // Ignore unhandled event types
              log.debug("Ignoring unhandled Clerk event type", {
                type: (event as { type: string }).type,
              });
          }

          return new Response("OK", { status: 200 });
        } catch (err) {
          log.error(
            "Clerk webhook handler failed",
            err instanceof Error ? err : new Error(String(err))
          );
          return new Response("Webhook handler failed", { status: 500 });
        }
      },
    },
  },
});
