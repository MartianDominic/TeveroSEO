/**
 * Clerk Webhook Handler
 * Handles user lifecycle events from Clerk authentication.
 *
 * SECURITY: Uses validated environment variables from env.ts
 * to ensure webhook signature verification never silently fails.
 *
 * H-VAL-01 FIX: Added Zod schema validation for webhook payloads
 * to ensure type safety and prevent malformed data from being processed.
 *
 * Events:
 * - user.created: New user signup
 * - user.updated: User profile changes
 * - user.deleted: User deletion
 */
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getClerkWebhookSecret } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * H-VAL-01 FIX: Zod schemas for Clerk webhook payload validation.
 * These ensure we only process well-formed webhook events.
 */
const emailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string().email(),
});

const userDataSchema = z.object({
  id: z.string().min(1),
  email_addresses: z.array(emailAddressSchema).optional(),
  primary_email_address_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
});

const webhookEventSchema = z.object({
  type: z.enum(['user.created', 'user.updated', 'user.deleted']),
  data: userDataSchema,
});

// For unhandled event types, we still validate basic structure
const genericWebhookEventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  // SECURITY: Use validated env - this throws if secret is missing
  // rather than silently failing signature verification
  let WEBHOOK_SECRET: string;
  try {
    WEBHOOK_SECRET = getClerkWebhookSecret();
  } catch {
    logger.error('[ClerkWebhook] CLERK_WEBHOOK_SECRET not configured - rejecting webhook');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  // Get Svix headers for signature verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    logger.error('[ClerkWebhook] Missing svix headers');
    return new NextResponse('Missing svix headers', { status: 400 });
  }

  // Get the raw body for signature verification
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    logger.error('[ClerkWebhook] Signature verification failed', err instanceof Error ? err : { error: String(err) });
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const eventType = evt.type;

  // H-VAL-01 FIX: Validate payload structure before processing
  // This prevents malformed data from causing runtime errors
  if (['user.created', 'user.updated', 'user.deleted'].includes(eventType)) {
    const validationResult = webhookEventSchema.safeParse(evt);
    if (!validationResult.success) {
      logger.error('[ClerkWebhook] Payload validation failed', {
        eventType,
        errors: validationResult.error.issues,
      });
      return new NextResponse('Invalid payload structure', { status: 400 });
    }
  } else {
    // For unknown event types, validate basic structure
    const genericResult = genericWebhookEventSchema.safeParse(evt);
    if (!genericResult.success) {
      logger.error('[ClerkWebhook] Generic payload validation failed', {
        eventType,
        errors: genericResult.error.issues,
      });
      return new NextResponse('Invalid payload structure', { status: 400 });
    }
  }

  // Handle different event types
  switch (eventType) {
    case 'user.created':
      await handleUserCreated(evt.data);
      break;
    case 'user.updated':
      await handleUserUpdated(evt.data);
      break;
    case 'user.deleted':
      await handleUserDeleted(evt.data);
      break;
    default:
      logger.debug(`[ClerkWebhook] Unhandled event type: ${eventType}`);
  }

  return new NextResponse('OK', { status: 200 });
}

/**
 * Handle user.created event.
 * Sync new user to local database if needed.
 */
async function handleUserCreated(data: WebhookEvent['data']) {
  if (!('id' in data) || !data.id) return;

  logger.info('[ClerkWebhook] User created', { userId: data.id });

  // Extract user data for potential sync
  const userId = data.id;
  const email = 'email_addresses' in data
    ? data.email_addresses?.find((e: { id: string }) => e.id === data.primary_email_address_id)?.email_address
    : undefined;
  const firstName = 'first_name' in data ? data.first_name : undefined;
  const lastName = 'last_name' in data ? data.last_name : undefined;

  // Log user creation for monitoring (PII redacted for compliance)
  logger.info('[ClerkWebhook] New user created', {
    userId: userId.substring(0, 8) + '***',
    eventType: 'user.created',
  });

  // Future: Sync to local users table if needed for cross-service identity
  // await syncUserToDatabase({ userId, email, firstName, lastName });
}

/**
 * Handle user.updated event.
 * Update local user record if synced.
 */
async function handleUserUpdated(data: WebhookEvent['data']) {
  if (!('id' in data)) return;

  logger.info('[ClerkWebhook] User updated', { userId: data.id });

  // Future: Update local user record
  // await updateLocalUser(data.id, { ...extractUserFields(data) });
}

/**
 * Handle user.deleted event.
 * Clean up user data and revoke access.
 *
 * FIX H-AUTH-03: Propagate session invalidation to other services.
 */
async function handleUserDeleted(data: WebhookEvent['data']) {
  if (!('id' in data) || !data.id) return;

  const userId = data.id;
  logger.info('[ClerkWebhook] User deleted', { userId });

  // FIX H-AUTH-03: Notify other services to invalidate cached sessions
  // This ensures that even if a token is cached, it will be rejected
  await propagateSessionInvalidation(userId);

  // Future: Clean up user data
  // - Remove from local users table
  // - Clean up workspace memberships
  // - Archive or anonymize user-owned content
  // await cleanupUserData(data.id);
}

/**
 * FIX H-AUTH-03: Propagate session invalidation to backend services.
 *
 * When a user is deleted from Clerk, we need to notify all backend services
 * to invalidate any cached sessions or tokens for that user. This prevents
 * continued access if tokens are cached in Redis or memory.
 */
async function propagateSessionInvalidation(userId: string): Promise<void> {
  const openSeoUrl = process.env.OPEN_SEO_URL || 'http://localhost:13001';
  const aiWriterUrl = process.env.AI_WRITER_URL || 'http://localhost:8000';
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!internalApiKey) {
    logger.warn('[ClerkWebhook] INTERNAL_API_KEY not set, skipping session invalidation propagation');
    return;
  }

  const invalidationPayload = {
    userId,
    reason: 'user_deleted',
    timestamp: new Date().toISOString(),
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Api-Key': internalApiKey,
    'X-Source-Service': 'apps-web',
  };

  // Notify services in parallel (fire-and-forget with logging)
  const results = await Promise.allSettled([
    // Notify open-seo-main
    fetch(`${openSeoUrl}/api/internal/session-invalidation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidationPayload),
      signal: AbortSignal.timeout(5000), // 5s timeout
    }).then(res => {
      if (!res.ok) {
        logger.warn('[ClerkWebhook] open-seo-main session invalidation failed', { status: res.status });
      }
      return res;
    }),

    // Notify AI-Writer
    fetch(`${aiWriterUrl}/api/internal/session-invalidation`, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidationPayload),
      signal: AbortSignal.timeout(5000), // 5s timeout
    }).then(res => {
      if (!res.ok) {
        logger.warn('[ClerkWebhook] AI-Writer session invalidation failed', { status: res.status });
      }
      return res;
    }),
  ]);

  // Log results for monitoring
  const openSeoResult = results[0];
  const aiWriterResult = results[1];

  if (openSeoResult.status === 'rejected') {
    logger.error('[ClerkWebhook] Failed to notify open-seo-main of session invalidation', {
      error: openSeoResult.reason instanceof Error ? openSeoResult.reason.message : String(openSeoResult.reason),
    });
  }

  if (aiWriterResult.status === 'rejected') {
    logger.error('[ClerkWebhook] Failed to notify AI-Writer of session invalidation', {
      error: aiWriterResult.reason instanceof Error ? aiWriterResult.reason.message : String(aiWriterResult.reason),
    });
  }

  logger.info('[ClerkWebhook] Session invalidation propagated', {
    userId: userId.substring(0, 8) + '***',
    openSeo: openSeoResult.status,
    aiWriter: aiWriterResult.status,
  });
}
