/**
 * Phase-3 replacement: the BullMQ worker at src/server/workers/audit-worker.ts
 * now drives the audit pipeline. This file is kept only as a type-only
 * re-export so any stale import of `AuditParams` outside this plan's scope
 * still type-checks.
 *
 * DO NOT import SiteAuditWorkflow class — it is deleted. Use
 * `auditQueue.add(auditId, jobData, { jobId: auditId })` (see AuditService).
 */
export type { AuditJobData as AuditParams } from "@/server/queues/auditQueue";
