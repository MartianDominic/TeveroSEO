---
phase: 06
plan: 02
subsystem: open-seo-main/database
tags: [drizzle, migration, schema, client-id, auth]
dependency_graph:
  requires: []
  provides: [audits.clientId column, 0001_audits_client_id migration]
  affects: [06-03-plan (AuditService client_id wiring)]
tech_stack:
  added: []
  patterns: [drizzle-kit generate, nullable foreign reference pattern]
key_files:
  created:
    - open-seo-main/drizzle/0001_audits_client_id.sql
    - open-seo-main/drizzle/meta/0001_snapshot.json
  modified:
    - open-seo-main/src/db/app.schema.ts
    - open-seo-main/drizzle/meta/_journal.json
decisions:
  - "clientId is nullable (no NOT NULL) so pre-Phase-6 audits remain valid"
  - "Composite index on (clientId, startedAt DESC) for history queries"
  - "No FK reference to alwrity.clients — cross-database FK not supported in PostgreSQL"
  - "drizzle-kit generate run with dummy DATABASE_URL (no live DB needed for generation)"
metrics:
  duration: ~10 minutes
  completed: 2026-04-17
  tasks_completed: 2
  files_modified: 4
---

# Phase 6 Plan 02: Audits Schema — client_id Column + Migration Summary

Nullable `client_id` text column + composite index added to the `audits` table via Drizzle schema edit and generated migration `0001_audits_client_id.sql`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add client_id column + index to audits schema | af7f48b | open-seo-main/src/db/app.schema.ts |
| 2 | Generate Drizzle migration 0001_audits_client_id | 15388b3 | drizzle/0001_audits_client_id.sql, drizzle/meta/_journal.json, drizzle/meta/0001_snapshot.json |

## What Was Built

- `audits.clientId: text("client_id")` — nullable column (no NOT NULL, no default). Existing rows get NULL, which Plan 03 treats as "unscoped".
- `audits_client_id_started_at_idx` — composite btree index on `(client_id, started_at DESC)` for efficient client history queries.
- `desc` imported from `drizzle-orm` to support the DESC ordering in the index definition.
- Migration file `drizzle/0001_audits_client_id.sql` generated via `drizzle-kit generate --name=audits_client_id`. SQL is additive-only:
  ```sql
  ALTER TABLE "audits" ADD COLUMN "client_id" text;
  CREATE INDEX "audits_client_id_started_at_idx" ON "audits" USING btree ("client_id","started_at" desc);
  ```

## Decisions Made

1. **Nullable, no default** — pre-Phase-6 audit rows have no owning client. NULL is a first-class "unscoped" value. Plan 03 queries MUST check `clientId IS NOT NULL` when filtering by header.
2. **No cross-DB FK** — `client_id` references `alwrity.clients.id` conceptually, but PostgreSQL cannot FK across databases. Validation happens at request time via Plan 03's `client-context.ts`.
3. **No cascade delete** — client deletion does not cascade to audits; orphan handling is a future concern.
4. **Generation without live DB** — `drizzle-kit generate` only reads the TypeScript schema, not the DB. A dummy `DATABASE_URL` was set to satisfy the config loader.

## Deviations from Plan

None — plan executed exactly as written. The `drizzle-kit migrate` step (applying to a live Postgres) was not executed because no local DB is available in this environment, consistent with the task context note: "Do NOT run drizzle-kit migrate against live DB (no DB available in this environment) — just generate the migration file."

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. The migration is additive-only DDL (ADD COLUMN nullable + CREATE INDEX). Threat T-06-06 mitigated: confirmed no DROP TABLE / DROP COLUMN / DROP INDEX in generated SQL.

## Known Stubs

None. No UI-facing data changes; migration is schema-only.

## Self-Check: PASSED

- open-seo-main/src/db/app.schema.ts: FOUND (contains clientId column and audits_client_id_started_at_idx)
- open-seo-main/drizzle/0001_audits_client_id.sql: FOUND (contains ALTER TABLE "audits" ADD COLUMN "client_id" text)
- open-seo-main/drizzle/meta/0001_snapshot.json: FOUND
- open-seo-main/drizzle/meta/_journal.json: FOUND (contains "0001_audits_client_id" entry)
- Commit af7f48b: EXISTS (Task 1)
- Commit 15388b3: EXISTS (Task 2)
- TypeScript: pnpm exec tsc --noEmit exits 0
