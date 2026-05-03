/**
 * Pixel Components
 * Phase 66-07: DOM Change Approval System
 *
 * Components for managing pixel DOM changes:
 * - PendingChanges: List of changes awaiting approval
 * - ChangeApproval: Full review/approve/reject view
 * - ChangeHistory: Table of all changes with pagination
 */

export { PendingChanges } from "./pending-changes";
export type { PendingChangesProps, PendingChange } from "./pending-changes";

export { ChangeApproval } from "./change-approval";
export type { ChangeApprovalProps, ChangeForApproval } from "./change-approval";

export { ChangeHistory } from "./change-history";
export type { ChangeHistoryProps, HistoryChange } from "./change-history";
