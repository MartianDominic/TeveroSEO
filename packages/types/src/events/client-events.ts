/**
 * Unified Client Event Schema
 * Phase 68-03: API Contract Alignment
 *
 * All events across services use this standardized format with snake_case keys.
 * This ensures consistent event structure for webhooks and internal messaging.
 */
import { z } from "zod";

/**
 * Source services that can emit events.
 */
export const EVENT_SOURCES = ["open-seo", "ai-writer", "apps-web"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/**
 * Standardized event types across all services.
 * Use dot notation: {entity}.{action}
 */
export const EVENT_TYPES = {
  // Client lifecycle events
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_DELETED: "client.deleted",

  // Audit events
  AUDIT_STARTED: "audit.started",
  AUDIT_COMPLETED: "audit.completed",
  AUDIT_FAILED: "audit.failed",

  // Content events
  CONTENT_DRAFTED: "content.drafted",
  CONTENT_PUBLISHED: "content.published",
  CONTENT_UPDATED: "content.updated",

  // Proposal events
  PROPOSAL_CREATED: "proposal.created",
  PROPOSAL_SENT: "proposal.sent",
  PROPOSAL_VIEWED: "proposal.viewed",
  PROPOSAL_ACCEPTED: "proposal.accepted",
  PROPOSAL_REJECTED: "proposal.rejected",

  // Contract events
  CONTRACT_CREATED: "contract.created",
  CONTRACT_SIGNED: "contract.signed",
  CONTRACT_EXECUTED: "contract.executed",

  // Connection events
  CONNECTION_ESTABLISHED: "connection.established",
  CONNECTION_REVOKED: "connection.revoked",
  CONNECTION_REFRESHED: "connection.refreshed",

  // Ranking events
  RANKING_IMPROVED: "ranking.improved",
  RANKING_DROPPED: "ranking.dropped",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/**
 * Current API version for event schema.
 * Increment when making breaking changes to the event structure.
 */
export const CURRENT_API_VERSION = "2026-05-01" as const;

/**
 * Unified client event schema with snake_case keys.
 * All services must emit events conforming to this schema.
 */
export const ClientEventSchema = z.object({
  /** Event type using dot notation (e.g., "client.created") */
  event_type: z.string(),

  /** Client UUID this event relates to */
  client_id: z.string().uuid(),

  /** Workspace/organization ID */
  workspace_id: z.string(),

  /** ISO 8601 timestamp when event occurred */
  timestamp: z.string().datetime(),

  /** API version for schema compatibility */
  api_version: z.literal(CURRENT_API_VERSION),

  /** Source service that emitted the event */
  source: z.enum(EVENT_SOURCES),

  /** Event-specific payload data */
  payload: z.record(z.string(), z.unknown()),

  /** Optional correlation ID for request tracing */
  correlation_id: z.string().uuid().optional(),

  /** Optional idempotency key for deduplication */
  idempotency_key: z.string().optional(),
});

export type ClientEvent = z.infer<typeof ClientEventSchema>;

/**
 * Create a new client event with required fields populated.
 */
export function createClientEvent(
  eventType: string,
  clientId: string,
  workspaceId: string,
  source: EventSource,
  payload: Record<string, unknown>,
  options?: {
    correlationId?: string;
    idempotencyKey?: string;
  }
): ClientEvent {
  return {
    event_type: eventType,
    client_id: clientId,
    workspace_id: workspaceId,
    timestamp: new Date().toISOString(),
    api_version: CURRENT_API_VERSION,
    source,
    payload,
    correlation_id: options?.correlationId,
    idempotency_key: options?.idempotencyKey,
  };
}

/**
 * Validate an event against the schema.
 * Returns the validated event or throws on validation error.
 */
export function validateClientEvent(event: unknown): ClientEvent {
  return ClientEventSchema.parse(event);
}

/**
 * Safely validate an event, returning null on failure.
 */
export function safeValidateClientEvent(
  event: unknown
): ClientEvent | null {
  const result = ClientEventSchema.safeParse(event);
  return result.success ? result.data : null;
}
