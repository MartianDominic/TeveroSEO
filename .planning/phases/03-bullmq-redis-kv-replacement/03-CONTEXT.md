---
phase: 3
title: BullMQ + Redis KV Replacement
type: infrastructure
discuss_skipped: true
discuss_skip_reason: All success criteria are technical (queue/worker/Redis checks) — no user-facing behavior or UX decisions required
---

# Phase 3 Context: BullMQ + Redis KV Replacement

## Goal

Site audit jobs are queued and executed via BullMQ on Redis; audit crawl progress is stored in Redis KV — no Cloudflare runtime references remain in the audit path.

## Success Criteria

- Triggering a site audit enqueues a BullMQ job and the worker picks it up and executes all steps to completion
- Audit crawl progress reads/writes via ioredis with correct TTL semantics (30-min expiry, `audit-progress:` prefix)
- Redis connection failure at startup prints a clear error and exits (not a silent hang)
- A failed audit job that exhausts retries appears in the `failed-audits` dead-letter queue

## Phase 2 Stubs to Replace

These stubs were intentionally left by Phase 2 for Phase 3 to wire:

- `src/server/lib/audit/progress-kv.ts` — in-memory Map stub → replace with ioredis singleton
- `src/server/workflows/SiteAuditWorkflow.ts` — Phase-2 stub class → delete; replace with BullMQ worker
- `src/server/features/audit/services/AuditService.ts` — `startAudit` throws "Phase 3 stub" error → wire `auditQueue.add(...)`
- `src/server/workflows/siteAuditWorkflowPhases.ts` + `siteAuditWorkflowCrawl.ts` — contain CF `WorkflowStep` type shim → replace with BullMQ step pattern

## Key Decisions (Claude's Discretion)

- Use ioredis singleton for KV operations; separate connections for Queue and Worker (per BullMQ best practice)
- KV prefix: `audit-progress:`, TTL: 1800 seconds (30 min)
- Worker: `src/server/workers/audit-worker.ts` — processes `audit-queue` jobs
- Step-level retry semantics: `job.data.step` enum tracks current step; on retry the worker resumes from last saved step
- `lockDuration` ≥ 120,000ms; `maxStalledCount: 2`; graceful shutdown with 25s timeout
- Failed jobs → `failed-audits` dead-letter queue
- `src/server.ts` starts both HTTP server and BullMQ worker (or worker started separately)
- Package versions from CLAUDE.md: `bullmq@5.74.1`, `ioredis@5.10.1` (already installed in Phase 2)
