/**
 * Activity Feed Module
 * Phase 62-07: Smart Alert Detection & Real-time Activity Feed
 *
 * Provides a unified interface for emitting activity events to workspace rooms.
 * All activity events are:
 * - Emitted via Socket.IO to connected clients
 * - Buffered for catch-up on reconnect
 * - Typed for type-safety
 */

import { nanoid } from "nanoid";
import { emitActivityEvent, type ActivityEvent } from "./socket-server";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "activityFeed" });

/**
 * Activity event types for the agency command center.
 */
export type ActivityType =
  // Entity lifecycle events
  | "prospect_created"
  | "prospect_qualified"
  | "prospect_converted"
  | "proposal_created"
  | "proposal_sent"
  | "proposal_viewed"
  | "proposal_accepted"
  | "proposal_declined"
  | "contract_created"
  | "contract_sent"
  | "contract_signed"
  | "contract_executed"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_paid"
  | "invoice_overdue"
  // Alert events
  | "alert_created"
  | "alert_dismissed"
  | "alert_resolved"
  // Follow-up events
  | "follow_up_created"
  | "follow_up_completed"
  | "follow_up_snoozed"
  // Workflow events
  | "workflow_started"
  | "workflow_step_executed"
  | "workflow_completed"
  | "workflow_paused"
  // Payment events
  | "payment_received"
  | "payment_failed"
  // Generic
  | "note_added"
  | "status_changed"
  | "custom";

/**
 * Entity types for activity events.
 */
export type EntityType =
  | "prospect"
  | "proposal"
  | "contract"
  | "invoice"
  | "client"
  | "alert"
  | "follow_up"
  | "workflow"
  | "payment";

/**
 * Activity event payload for creation.
 */
export interface CreateActivityEventPayload {
  type: ActivityType;
  entityType?: EntityType;
  entityId?: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Emit an activity event to a workspace's activity feed.
 * Events are received by all connected clients in that workspace.
 *
 * @param workspaceId - The workspace to emit to
 * @param payload - The activity event payload
 */
export function emitActivity(
  workspaceId: string,
  payload: CreateActivityEventPayload
): void {
  const event: ActivityEvent = {
    id: nanoid(),
    type: payload.type,
    clientId: payload.clientId,
    clientName: payload.clientName,
    data: {
      entityType: payload.entityType,
      entityId: payload.entityId,
      title: payload.title,
      description: payload.description,
      userId: payload.userId,
      userName: payload.userName,
      ...payload.metadata,
    },
    timestamp: new Date().toISOString(),
  };

  emitActivityEvent(workspaceId, event);

  log.debug("Activity event emitted", {
    workspaceId,
    type: payload.type,
    entityType: payload.entityType,
    entityId: payload.entityId,
  });
}

/**
 * Emit a prospect-related activity event.
 */
export function emitProspectActivity(
  workspaceId: string,
  type: Extract<
    ActivityType,
    "prospect_created" | "prospect_qualified" | "prospect_converted"
  >,
  prospectId: string,
  prospectName: string,
  additionalData?: Record<string, unknown>
): void {
  emitActivity(workspaceId, {
    type,
    entityType: "prospect",
    entityId: prospectId,
    title: getActivityTitle(type, prospectName),
    clientName: prospectName,
    metadata: additionalData,
  });
}

/**
 * Emit a proposal-related activity event.
 */
export function emitProposalActivity(
  workspaceId: string,
  type: Extract<
    ActivityType,
    | "proposal_created"
    | "proposal_sent"
    | "proposal_viewed"
    | "proposal_accepted"
    | "proposal_declined"
  >,
  proposalId: string,
  clientName: string,
  additionalData?: Record<string, unknown>
): void {
  emitActivity(workspaceId, {
    type,
    entityType: "proposal",
    entityId: proposalId,
    title: getActivityTitle(type, clientName),
    clientName,
    metadata: additionalData,
  });
}

/**
 * Emit a contract-related activity event.
 */
export function emitContractActivity(
  workspaceId: string,
  type: Extract<
    ActivityType,
    | "contract_created"
    | "contract_sent"
    | "contract_signed"
    | "contract_executed"
  >,
  contractId: string,
  clientName: string,
  additionalData?: Record<string, unknown>
): void {
  emitActivity(workspaceId, {
    type,
    entityType: "contract",
    entityId: contractId,
    title: getActivityTitle(type, clientName),
    clientName,
    metadata: additionalData,
  });
}

/**
 * Emit an invoice-related activity event.
 */
export function emitInvoiceActivity(
  workspaceId: string,
  type: Extract<
    ActivityType,
    "invoice_created" | "invoice_sent" | "invoice_paid" | "invoice_overdue"
  >,
  invoiceId: string,
  clientName: string,
  amount?: number,
  currency?: string
): void {
  emitActivity(workspaceId, {
    type,
    entityType: "invoice",
    entityId: invoiceId,
    title: getActivityTitle(type, clientName),
    clientName,
    metadata: { amount, currency },
  });
}

/**
 * Emit an alert-related activity event.
 */
export function emitAlertActivity(
  workspaceId: string,
  type: Extract<
    ActivityType,
    "alert_created" | "alert_dismissed" | "alert_resolved"
  >,
  alertId: string,
  alertTitle: string,
  severity?: string
): void {
  emitActivity(workspaceId, {
    type,
    entityType: "alert",
    entityId: alertId,
    title: getActivityTitle(type, alertTitle),
    metadata: { severity },
  });
}

/**
 * Get a human-readable title for an activity type.
 */
function getActivityTitle(type: ActivityType, entityName: string): string {
  const titles: Record<ActivityType, string> = {
    prospect_created: `New prospect: ${entityName}`,
    prospect_qualified: `${entityName} qualified`,
    prospect_converted: `${entityName} converted to client`,
    proposal_created: `Proposal created for ${entityName}`,
    proposal_sent: `Proposal sent to ${entityName}`,
    proposal_viewed: `${entityName} viewed proposal`,
    proposal_accepted: `${entityName} accepted proposal`,
    proposal_declined: `${entityName} declined proposal`,
    contract_created: `Contract created for ${entityName}`,
    contract_sent: `Contract sent to ${entityName}`,
    contract_signed: `${entityName} signed contract`,
    contract_executed: `Contract executed for ${entityName}`,
    invoice_created: `Invoice created for ${entityName}`,
    invoice_sent: `Invoice sent to ${entityName}`,
    invoice_paid: `${entityName} paid invoice`,
    invoice_overdue: `Invoice overdue for ${entityName}`,
    alert_created: `Alert: ${entityName}`,
    alert_dismissed: `Alert dismissed: ${entityName}`,
    alert_resolved: `Alert resolved: ${entityName}`,
    follow_up_created: `Follow-up scheduled for ${entityName}`,
    follow_up_completed: `Follow-up completed for ${entityName}`,
    follow_up_snoozed: `Follow-up snoozed for ${entityName}`,
    workflow_started: `Workflow started for ${entityName}`,
    workflow_step_executed: `Workflow step completed for ${entityName}`,
    workflow_completed: `Workflow completed for ${entityName}`,
    workflow_paused: `Workflow paused for ${entityName}`,
    payment_received: `Payment received from ${entityName}`,
    payment_failed: `Payment failed for ${entityName}`,
    note_added: `Note added for ${entityName}`,
    status_changed: `Status changed for ${entityName}`,
    custom: entityName,
  };

  return titles[type] ?? entityName;
}
