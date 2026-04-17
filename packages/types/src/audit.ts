/**
 * Audit run lifecycle. Mirrors open-seo-main's BullMQ audit job states
 * projected to the UI: running (queued or in-flight), completed, failed.
 */
export type AuditStatus = "running" | "completed" | "failed";
