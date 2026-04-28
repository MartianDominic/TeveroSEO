/**
 * Webhook schema for multi-tenant webhook infrastructure.
 * Phase 18.5: External integrations via webhooks.
 */
import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const webhookScopeEnum = pgEnum("webhook_scope", [
  "global",
  "workspace",
  "client",
]);

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: webhookScopeEnum("scope").notNull(),
    scopeId: text("scope_id"),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    events: jsonb("events").notNull().$type<string[]>(),
    enabled: boolean("enabled").notNull().default(true),
    headers: jsonb("headers").$type<Record<string, string>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("webhooks_scope_scope_id_idx").on(t.scope, t.scopeId),
    index("webhooks_enabled_idx").on(t.enabled),
  ],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    idempotencyKey: text("idempotency_key"),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastResponseStatus: integer("last_response_status"),
    lastResponseBody: text("last_response_body"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_webhook_id_idx").on(t.webhookId),
    index("webhook_deliveries_status_idx").on(t.status),
    index("webhook_deliveries_event_id_idx").on(t.eventId),
    index("webhook_deliveries_created_at_idx").on(t.createdAt),
    index("webhook_deliveries_idempotency_key_idx").on(t.webhookId, t.idempotencyKey),
  ],
);

export const webhookEvents = pgTable("webhook_events", {
  type: text("type").primaryKey(),
  category: text("category").notNull(),
  tier: integer("tier").notNull().default(1),
  description: text("description").notNull(),
  samplePayload: jsonb("sample_payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
