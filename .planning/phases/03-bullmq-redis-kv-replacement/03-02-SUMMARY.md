---
phase: 03-bullmq-redis-kv-replacement
plan: "02"
subsystem: open-seo-main/server-infra
tags: [redis, ioredis, kv, progress-kv, crawl-progress, audit]
dependency_graph:
  requires:
    - open-seo-main/src/server/lib/redis.ts (singleton from Plan 01)
  provides:
    - open-seo-main/src/server/lib/audit/progress-kv.ts (ioredis-backed AuditProgressKV)
  affects:
    - open-seo-main/src/server/workflows/siteAuditWorkflowCrawl.ts (pushCrawledUrls caller — unchanged)
    - open-seo-main/src/server/workflows/siteAuditWorkflowPhases.ts (clear caller — unchanged)
    - open-seo-main/src/server/features/audit/services/AuditService.ts (getCrawledUrls caller — unchanged)
tech_stack:
  added: []
  patterns:
    - Redis GET/SET with JSON serialization for list storage
    - Zod safeParse at Redis read boundary (T-03-05 mitigation)
    - Read-merge-write with MAX_ENTRIES=300 cap (T-03-06 mitigation)
    - EX 1800 TTL on every write (T-03-07 mitigation)
key_files:
  created: []
  modified:
    - open-seo-main/src/server/lib/audit/progress-kv.ts
decisions:
  - "SET + JSON serialization chosen over LPUSH/LTRIM — preserves newest-first merge semantics from Phase-2 Map stub in a single Redis op per write"
  - "readEntries uses zod crawledUrlArraySchema.safeParse + try/catch — returns [] on malformed JSON rather than throwing (T-03-05)"
  - "TTL refreshed on every pushCrawledUrls call — keeps active audits alive; orphaned audits auto-expire after 30 min (T-03-07)"
metrics:
  duration: ~5 minutes
  completed: 2026-04-17
  tasks_completed: 1
  files_created: 0
  files_modified: 1
---

# Phase 03 Plan 02: Redis-backed Crawl Progress KV Summary

**One-liner:** ioredis GET/SET JSON with `audit-progress:` prefix + 30-minute TTL replaces Phase-2 in-memory Map, preserving the AuditProgressKV four-method surface exactly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite progress-kv.ts against ioredis singleton | 7bdeab9 | open-seo-main/src/server/lib/audit/progress-kv.ts |

## What Was Built

### progress-kv.ts (rewritten)

Exports `AuditProgressKV` with four methods, identical signatures to Phase-2 stub:

- `pushCrawledUrl(auditId, entry)` — delegates to `pushCrawledUrls`
- `pushCrawledUrls(auditId, entries[])` — reads current array from Redis, prepends new entries, caps at MAX_ENTRIES=300, writes back with `redis.set(key, json, "EX", 1800)`
- `getCrawledUrls(auditId)` — calls `redis.get`, parses JSON via zod safeParse, returns `[]` on null/invalid
- `clear(auditId)` — calls `redis.del`

Key constants:
- `KV_PREFIX = "audit-progress:"` — all keys namespaced per KV-01
- `TTL_SECONDS = 1800` — 30 minutes, refreshed on every write
- `MAX_ENTRIES = 300` — preserved from Phase-2 Map stub

The Phase-2 in-memory `Map`, `Bucket` interface, `isExpired()` helper, and `TTL_MS` constant are all removed.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — the module is fully wired to the ioredis singleton.

## Threat Flags

None — no new network endpoints or trust boundaries introduced. All threat mitigations from the plan's threat model are implemented:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-03-05: Malformed JSON from Redis | `crawledUrlArraySchema.safeParse` + try/catch returns `[]` | Implemented |
| T-03-06: Unbounded entry accumulation | `MAX_ENTRIES = 300` slice on every write | Implemented |
| T-03-07: Crawl data TTL | `EX 1800` on every `redis.set` call | Implemented |
| T-03-08: auditId collisions | Accepted — crypto.randomUUID() used upstream | Accepted |

## Self-Check: PASSED

- open-seo-main/src/server/lib/audit/progress-kv.ts: FOUND (modified)
- `grep -c 'from "@/server/lib/redis"'`: 1 (PASS)
- `grep -c "audit-progress:"`: 2 (KV_PREFIX declaration + key() usage) (PASS)
- `grep -c "TTL_SECONDS = 30 * 60"`: 1 (PASS)
- `grep -c '"EX"'`: 1 (PASS)
- `grep -c "new Map"`: 0 (PASS — in-memory stub removed)
- `grep -c "cloudflare:workers"`: 0 (PASS)
- `grep -c "redis.get"`: 1 (PASS)
- `grep -c "redis.set"`: 1 (PASS)
- `grep -c "redis.del"`: 1 (PASS)
- `grep -c "export const AuditProgressKV"`: 1 (PASS)
- Commit 7bdeab9: FOUND
- pnpm exec tsc --noEmit: EXIT 0 (PASS)
