/**
 * Clerk Webhook Handler
 * Handles user lifecycle events from Clerk authentication.
 *
 * SECURITY: Uses validated environment variables from env.ts
 * to ensure webhook signature verification never silently fails.
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
import { getClerkWebhookSecret } from '@/lib/env';

export async function POST(req: Request) {
  // SECURITY: Use validated env - this throws if secret is missing
  // rather than silently failing signature verification
  let WEBHOOK_SECRET: string;
  try {
    WEBHOOK_SECRET = getClerkWebhookSecret();
  } catch {
    console.error('[ClerkWebhook] CLERK_WEBHOOK_SECRET not configured - rejecting webhook');
    return new NextResponse('Webhook secret not configured', { status: 500 });
  }

  // Get Svix headers for signature verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('[ClerkWebhook] Missing svix headers');
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
    console.error('[ClerkWebhook] Signature verification failed:', err);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  const eventType = evt.type;

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
      console.log(`[ClerkWebhook] Unhandled event type: ${eventType}`);
  }

  return new NextResponse('OK', { status: 200 });
}

/**
 * Handle user.created event.
 * Sync new user to local database if needed.
 */
async function handleUserCreated(data: WebhookEvent['data']) {
  if (!('id' in data) || !data.id) return;

  console.log('[ClerkWebhook] User created:', data.id);

  // Extract user data for potential sync
  const userId = data.id;
  const email = 'email_addresses' in data
    ? data.email_addresses?.find((e: { id: string }) => e.id === data.primary_email_address_id)?.email_address
    : undefined;
  const firstName = 'first_name' in data ? data.first_name : undefined;
  const lastName = 'last_name' in data ? data.last_name : undefined;

  // Log user creation for monitoring (PII redacted for compliance)
  console.log('[ClerkWebhook] New user created:', {
    userId: userId.substring(0, 8) + '***',
    eventType: 'user.created',
    createdAt: new Date().toISOString(),
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

  console.log('[ClerkWebhook] User updated:', data.id);

  // Future: Update local user record
  // await updateLocalUser(data.id, { ...extractUserFields(data) });
}

/**
 * Handle user.deleted event.
 * Clean up user data and revoke access.
 */
async function handleUserDeleted(data: WebhookEvent['data']) {
  if (!('id' in data)) return;

  console.log('[ClerkWebhook] User deleted:', data.id);

  // Future: Clean up user data
  // - Remove from local users table
  // - Revoke active sessions
  // - Clean up workspace memberships
  // - Archive or anonymize user-owned content
  // await cleanupUserData(data.id);
}
