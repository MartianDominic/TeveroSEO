/**
 * Event Types and Schemas
 * Phase 68-03: API Contract Alignment
 */
export {
  ClientEventSchema,
  EVENT_TYPES,
  EVENT_SOURCES,
  CURRENT_API_VERSION,
  createClientEvent,
  validateClientEvent,
  safeValidateClientEvent,
} from "./client-events";

export type {
  ClientEvent,
  EventType,
  EventSource,
} from "./client-events";
