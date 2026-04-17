---
phase: 02-cf-bindings-removal-schema-migration
plan: "02"
subsystem: open-seo-main
tags: [schema-migration, postgresql, drizzle, pg-core, sqlite-core-removal]
dependency_graph:
  requires: [02-01]
  provides: [drizzle-pg-schema, pg-table-definitions, pg-boolean-columns, pg-jsonb-columns, pg-timestamp-columns]
  affects:
    - open-seo-main/src/db/better-auth-schema.ts
    - open-seo-main/src/db/app.schema.ts
tech_stack:
  added: []
  removed: [drizzle-orm/sqlite-core dialect usage]
  patterns: [drizzle-pg-core, native-boolean, jsonb-columns, timestamp-with-timezone, generatedAlwaysAsIdentity]
key_files:
  modified:
    - open-seo-main/src/db/better-auth-schema.ts
    - open-seo-main/src/db/app.schema.ts
decisions:
  - All timestamp columns use single-line format for grep-verifiability of withTimezone/mode options
  - audits.config default changed from string '{}' to object literal {} for correct jsonb semantics
  - organization.metadata kept as text() per better-auth schema generator conventions (not structured JSON)
  - text enum columns (status, strategy, currentPhase) kept as text with app-level enum — matches CLAUDE.md guidance
metrics:
  duration: "~8 minutes"
  completed: "2026-04-17"
  tasks_completed: 2
  files_modified: 2
---

# Phase 2 Plan 02: Drizzle Schema SQLite→PostgreSQL Migration Summary

**One-liner:** Rewrote both Drizzle schema files from sqlite-core to pg-core — 14 tables total, native boolean columns, jsonb for JSON-shaped data, timestamp({ withTimezone: true }) for all timestamp columns, and generatedAlwaysAsIdentity for the keyword_metrics auto-increment PK.

## What Was Built

This plan migrates the canonical Drizzle ORM schema from SQLite dialect to PostgreSQL dialect. Without this change, `drizzle-kit generate` cannot emit PostgreSQL migrations and the node-postgres driver throws type errors.

### Task 1 — better-auth-schema.ts (`83c18cd`)

Rewrote all 7 better-auth tables (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`) from `sqliteTable` to `pgTable`:

- Replaced `integer("email_verified", { mode: "boolean" })` with `boolean("email_verified")` (native PG boolean)
- Replaced all `integer("...", { mode: "timestamp_ms" })` columns with `timestamp("...", { withTimezone: true, mode: "date" })`
- Replaced `sql\`(cast(unixepoch('subsecond') * 1000 as integer))\`` defaults with `.defaultNow()`
- Removed `sql` import from `drizzle-orm` (no longer needed)
- Preserved all 7 indexes (`session_userId_idx`, `account_userId_idx`, `verification_identifier_idx`, `member_organizationId_idx`, `member_userId_idx`, `invitation_organizationId_idx`, `invitation_email_idx`), 1 uniqueIndex (`organization_slug_uidx`), and all 6 relations blocks
- `organization.metadata` kept as `text()` per better-auth schema generator conventions

### Task 2 — app.schema.ts (`10f5c07`)

Rewrote all 7 app tables (`delegatedUsers`, `projects`, `savedKeywords`, `keywordMetrics`, `audits`, `auditPages`, `auditLighthouseResults`) from `sqliteTable` to `pgTable`:

- Replaced `integer("...", { mode: "boolean" })` with `boolean()` for `has_structured_data` and `is_indexable`
- Replaced JSON text columns with `jsonb()`: `monthly_searches`, `config`, `heading_order_json`, `images_json`, `hreflang_tags_json`
- Replaced `text("...")` and `sql\`(current_timestamp)\`` timestamp columns with `timestamp({ withTimezone: true, mode: "date" }).defaultNow()`
- Replaced `integer("id").primaryKey({ autoIncrement: true })` with `integer("id").primaryKey().generatedAlwaysAsIdentity()` for `keywordMetrics.id`
- Changed `audits.config` default from string `"{}"` to object `{}` for correct jsonb semantics
- `completedAt` kept nullable (no `.defaultNow()`) as it represents an optional completion time
- Preserved all FK references (organization.id ×1, projects.id ×3, audits.id ×2, auditPages.id ×1), all 8 named indexes/uniqueIndexes
- Removed `sql` import from `drizzle-orm`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Both files are pure schema definitions — no data flows to UI rendering from these files directly.

## Threat Flags

None. Schema files define table structure only; no new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

| Item | Result |
|------|--------|
| open-seo-main/src/db/better-auth-schema.ts | FOUND |
| open-seo-main/src/db/app.schema.ts | FOUND |
| commit 83c18cd (task 1) | FOUND |
| commit 10f5c07 (task 2) | FOUND |
| Zero sqlite-core/sqliteTable/timestamp_ms/unixepoch in src/db/ | CONFIRMED |
| Two pg-core imports in src/db/ | CONFIRMED |
